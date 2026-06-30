import Stripe from "stripe";

let _stripe: Stripe | null = null;

/**
 * Returns a Stripe client initialised from STRIPE_SECRET_KEY.
 * Throws a clear error if the key is missing, rather than the
 * cryptic "Stripe is not yet connected" message from the placeholder.
 */
export async function getUncachableStripeClient(): Promise<Stripe> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. " +
        "Add it to your .env file (or environment) to enable Stripe features."
    );
  }
  // Always return a fresh client (uncachable = no module-level singleton)
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

/**
 * Returns a cached Stripe client for use in non-request contexts
 * (e.g. webhook sync, background jobs). Throws if key is missing.
 */
export async function getStripeSync(): Promise<Stripe> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. " +
        "Add it to your .env file to enable Stripe webhook sync."
    );
  }
  if (!_stripe) {
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

/**
 * Returns true if Stripe is configured (STRIPE_SECRET_KEY is set).
 * Use this to guard optional Stripe features gracefully.
 */
export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
