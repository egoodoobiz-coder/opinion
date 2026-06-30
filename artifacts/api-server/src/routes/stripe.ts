import { Router, type IRouter } from "express";
import { storage } from "../storage";
import { stripeService } from "../stripeService";
import { getUncachableStripeClient, isStripeConfigured } from "../stripeClient";

const router: IRouter = Router();

/**
 * Derives the base URL for Stripe redirect URLs.
 * Prefers EXPO_PUBLIC_API_URL (set locally), falls back to REPLIT_DOMAINS,
 * then falls back to localhost for local dev.
 */
function getBaseUrl(): string {
  // Explicit override takes priority (local dev)
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL;
  // Replit environment
  const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (replitDomain) return `https://${replitDomain}`;
  // Local fallback
  const port = process.env.PORT ?? "3000";
  return `http://localhost:${port}`;
}

// ── GET /subscription ─────────────────────────────────────────────────────────
router.get("/subscription", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user?.stripeCustomerId) {
      return res.json({ subscription: null, isPremium: false });
    }

    const subscription = await storage.getSubscriptionByCustomerId(
      user.stripeCustomerId
    );

    return res.json({
      subscription,
      isPremium: !!subscription && subscription.status === "active",
      accountType: user.accountType ?? null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch subscription" });
  }
});

// ── POST /checkout ────────────────────────────────────────────────────────────
router.post("/checkout", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error: "Stripe is not configured on this server.",
      hint: "Set STRIPE_SECRET_KEY to enable payments.",
    });
  }

  const { userId, email, priceId, accountType } = req.body;

  if (!userId || !priceId) {
    return res.status(400).json({ error: "userId and priceId are required" });
  }

  // Validate accountType explicitly — don't silently default to "company"
  if (accountType && !["company", "celebrity"].includes(accountType)) {
    return res.status(400).json({ error: "Invalid accountType" });
  }

  try {
    let user = await storage.upsertUser({ id: userId, email });

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer(email || "", userId);
      user = await storage.updateUserStripeInfo(userId, {
        stripeCustomerId: customer.id,
        accountType: accountType ?? undefined,
      });
      customerId = customer.id!;
    }

    const baseUrl = getBaseUrl();
    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${baseUrl}/checkout-success`,
      `${baseUrl}/checkout-cancel`
    );

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Checkout failed" });
  }
});

// ── GET /products-with-prices ─────────────────────────────────────────────────
router.get("/products-with-prices", async (_req, res) => {
  try {
    const products = await storage.listProductsWithPrices();
    return res.json({ data: products });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to fetch products" });
  }
});

// ── POST /customer-portal ─────────────────────────────────────────────────────
router.post("/customer-portal", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error: "Stripe is not configured on this server.",
      hint: "Set STRIPE_SECRET_KEY to enable the customer portal.",
    });
  }

  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  try {
    const user = await storage.getUser(userId);
    if (!user?.stripeCustomerId) {
      return res.status(404).json({ error: "No subscription found" });
    }

    const baseUrl = getBaseUrl();
    const session = await stripeService.createCustomerPortalSession(
      user.stripeCustomerId,
      baseUrl
    );

    return res.json({ url: session.url });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message ?? "Could not create portal session" });
  }
});

// ── GET /checkout-verify ──────────────────────────────────────────────────────
router.get("/checkout-verify", async (req, res) => {
  if (!isStripeConfigured()) {
    return res.status(503).json({
      error: "Stripe is not configured on this server.",
    });
  }

  const { sessionId, userId, accountType } = req.query as {
    sessionId: string;
    userId: string;
    accountType?: string;
  };

  if (!sessionId || !userId) {
    return res
      .status(400)
      .json({ error: "sessionId and userId are required" });
  }

  // Validate accountType
  const resolvedType =
    accountType && ["company", "celebrity"].includes(accountType)
      ? accountType
      : "company";

  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.status === "complete" && session.subscription) {
      await storage.updateUserStripeInfo(userId, {
        stripeSubscriptionId: String(session.subscription),
        isPremium: true,
        accountType: resolvedType,
      });
      return res.json({ success: true, isPremium: true });
    }

    return res.json({ success: false, isPremium: false });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err.message ?? "Checkout verification failed" });
  }
});

export default router;
