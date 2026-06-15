import { Router } from "express";
import crypto from "crypto";
import { q } from "../db.js";
import { requireAuth } from "../auth-util.js";
import { membershipFor } from "../billing-util.js";

// ---- 2Checkout / Verifone (merchant of record) ----
// You never see or store card numbers: the shopper enters card details on
// 2Checkout's own hosted page, 2Checkout charges them, pays you to your bank,
// and tells us (via the IPN webhook) to mark the account active.
const appUrl = () => (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");
const BUY_LINK = process.env.TWOCHECKOUT_BUY_LINK || "";
const IPN_SECRET = process.env.TWOCHECKOUT_IPN_SECRET || "";

const router = Router();

// Current membership state for the signed-in user.
router.get("/status", requireAuth, async (req, res) => {
  const { rows } = await q("SELECT * FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ membership: await membershipFor(rows[0]) });
});

// Build the 2Checkout hosted-checkout URL for this user and return it; the
// browser redirects there to pay. We tag it with the user's email/id so the
// webhook can match the payment back to the account.
router.post("/checkout", requireAuth, async (req, res) => {
  if (!BUY_LINK) return res.status(400).json({ error: "Payments are not configured on the server" });
  const { rows } = await q("SELECT email FROM users WHERE id = $1", [req.user.id]);
  const email = rows[0] ? rows[0].email : "";
  const sep = BUY_LINK.includes("?") ? "&" : "?";
  const url =
    `${BUY_LINK}${sep}` +
    `customer-ext-ref=${encodeURIComponent(req.user.id)}` +
    `&order-ext-ref=${encodeURIComponent("u" + req.user.id)}` +
    `&customer-email=${encodeURIComponent(email)}` +
    `&return-url=${encodeURIComponent(appUrl() + "?sub=success")}` +
    `&return-type=redirect`;
  res.json({ url });
});

// Shoppers manage / cancel their subscription in 2Checkout's myAccount portal.
router.post("/portal", requireAuth, (req, res) => {
  res.json({ url: process.env.TWOCHECKOUT_PORTAL_URL || "https://secure.2checkout.com/myaccount/" });
});

// 2Checkout's IPN signs the payload by concatenating, for each field (except
// the signature fields), its byte-length followed by its value, then HMAC-SHA256
// with your IPN secret. (Confirm against your account in sandbox — share a
// failing payload and we'll match the exact field handling.)
function verifyIpn(body) {
  if (!IPN_SECRET) return true; // no secret set = verification disabled (dev only)
  const provided = body.SIGNATURE_SHA2_256 || body.HASH;
  if (!provided) return false;
  const skip = new Set(["SIGNATURE_SHA2_256", "SIGNATURE_SHA3_256", "HASH"]);
  let str = "";
  for (const [k, v] of Object.entries(body)) {
    if (skip.has(k)) continue;
    const val = Array.isArray(v) ? v.join("") : v == null ? "" : String(v);
    str += Buffer.byteLength(val, "utf8") + val;
  }
  const h = crypto.createHmac("sha256", IPN_SECRET).update(str, "utf8").digest("hex");
  return h.toLowerCase() === String(provided).toLowerCase();
}

const ACTIVE = ["ORDER_CREATED", "PAYMENT_AUTHORIZED", "RECURRING_INSTALLMENT_SUCCESS", "FRAUD_APPROVED"];
const ENDED = ["RECURRING_STOPPED", "RECURRING_COMPLETE", "SUBSCRIPTION_CANCELED", "REFUND_ISSUED", "CHARGEBACK_OPENED"];
const FAILED = ["RECURRING_INSTALLMENT_FAILED", "PAYMENT_REFUSED"];

// IPN webhook — mounted with a urlencoded body parser in index.js.
export async function webhookHandler(req, res) {
  const body = req.body || {};
  if (!verifyIpn(body)) return res.status(400).send("invalid signature");

  const email = (body.CUSTOMEREMAIL || body.customer_email || body.email || "").toLowerCase();
  const type = body.MESSAGE_TYPE || body.message_type || "";

  let status = null;
  if (ACTIVE.includes(type)) status = "active";
  else if (FAILED.includes(type)) status = "past_due";
  else if (ENDED.includes(type)) status = "canceled";

  try {
    if (email && status) {
      await q("UPDATE users SET subscription_status = $1 WHERE email = $2", [status, email]);
    }
  } catch (e) { /* 2Checkout retries on non-2xx; ignore transient errors */ }

  res.status(200).send("OK");
}

export default router;
