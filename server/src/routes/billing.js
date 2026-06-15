import { Router } from "express";
import Stripe from "stripe";
import { q } from "../db.js";
import { requireAuth } from "../auth-util.js";
import { membershipFor } from "../billing-util.js";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const appUrl = () => (process.env.APP_URL || "http://localhost:5173").replace(/\/$/, "");

const router = Router();

// Current membership state for the signed-in user.
router.get("/status", requireAuth, async (req, res) => {
  const { rows } = await q("SELECT * FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0]) return res.status(404).json({ error: "User not found" });
  res.json({ membership: await membershipFor(rows[0]) });
});

// Start a Stripe Checkout subscription and return its hosted URL. The browser
// redirects there; Stripe Checkout shows every payment method enabled in your
// Stripe dashboard (cards, Apple Pay, Google Pay, local methods — no crypto).
router.post("/checkout", requireAuth, async (req, res) => {
  if (!stripe || !process.env.STRIPE_PRICE_ID) {
    return res.status(400).json({ error: "Payments are not configured on the server" });
  }
  const { rows } = await q("SELECT * FROM users WHERE id = $1", [req.user.id]);
  const u = rows[0];
  let customer = u.stripe_customer_id;
  if (!customer) {
    const c = await stripe.customers.create({ email: u.email, metadata: { userId: String(u.id) } });
    customer = c.id;
    await q("UPDATE users SET stripe_customer_id = $1 WHERE id = $2", [customer, u.id]);
  }
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${appUrl()}?sub=success`,
      cancel_url: `${appUrl()}?sub=cancel`,
    });
    res.json({ url: session.url });
  } catch (e) {
    res.status(400).json({ error: e.message || "Could not start checkout" });
  }
});

// Stripe-hosted billing portal so members can update card / cancel.
router.post("/portal", requireAuth, async (req, res) => {
  if (!stripe) return res.status(400).json({ error: "Payments are not configured" });
  const { rows } = await q("SELECT stripe_customer_id FROM users WHERE id = $1", [req.user.id]);
  const customer = rows[0] && rows[0].stripe_customer_id;
  if (!customer) return res.status(400).json({ error: "No subscription on file" });
  const session = await stripe.billingPortal.sessions.create({ customer, return_url: appUrl() });
  res.json({ url: session.url });
});

// Stripe webhook — keeps subscription_status in sync. Mounted with a raw body
// parser in index.js so the signature can be verified.
export async function webhookHandler(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(400).end();
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers["stripe-signature"], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }
  const obj = event.data.object;
  try {
    if (event.type === "checkout.session.completed") {
      await q("UPDATE users SET subscription_status = 'active' WHERE stripe_customer_id = $1", [obj.customer]);
    } else if (event.type.startsWith("customer.subscription.")) {
      await q("UPDATE users SET subscription_status = $1 WHERE stripe_customer_id = $2", [obj.status, obj.customer]);
    } else if (event.type === "invoice.payment_failed") {
      await q("UPDATE users SET subscription_status = 'past_due' WHERE stripe_customer_id = $1", [obj.customer]);
    }
  } catch (e) { /* ignore — Stripe will retry */ }
  res.json({ received: true });
}

export default router;
