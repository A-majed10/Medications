import { q } from "./db.js";

// Number of stations a user can complete free before they must subscribe.
export const FREE_LIMIT = Number(process.env.FREE_STATION_LIMIT || 3);

// Payments are only enforced when 2Checkout is configured. Without it the app
// runs with everyone allowed, so local/dev use needs no payment setup at all.
export const billingEnabled = () => !!process.env.TWOCHECKOUT_BUY_LINK;

const isActive = (status) => status === "active" || status === "trialing";

// Works out a user's membership state: their plan status, how many free
// stations they've used, and whether they're currently allowed to run one.
export async function membershipFor(u) {
  // Faculty are staff — they never pay.
  if (u.role === "faculty") {
    return { billingEnabled: billingEnabled(), status: "faculty", exempt: true, freeUsed: 0, freeLimit: FREE_LIMIT, freeLeft: FREE_LIMIT, eligible: true, hasStripe: false };
  }
  if (!billingEnabled()) {
    return { billingEnabled: false, status: "disabled", freeUsed: 0, freeLimit: FREE_LIMIT, freeLeft: FREE_LIMIT, eligible: true, hasStripe: false };
  }
  const { rows } = await q("SELECT count(*)::int AS n FROM attempts WHERE user_id = $1", [u.id]);
  const freeUsed = rows[0] ? rows[0].n : 0;
  const status = u.subscription_status || "none";
  const active = isActive(status);
  return {
    billingEnabled: true,
    status,
    freeUsed,
    freeLimit: FREE_LIMIT,
    freeLeft: Math.max(0, FREE_LIMIT - freeUsed),
    eligible: active || freeUsed < FREE_LIMIT,
    hasStripe: !!u.stripe_customer_id,
  };
}
