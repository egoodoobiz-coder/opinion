import { Router, type IRouter } from "express";
import { storage } from "../storage";
import { stripeService } from "../stripeService";
import { getUncachableStripeClient } from "../stripeClient";

const router: IRouter = Router();

// Get subscription status for a user
router.get("/subscription", async (req, res) => {
  const userId = req.query.userId as string;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

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
    accountType: user.accountType,
  });
});

// Create checkout session for premium upgrade
router.post("/checkout", async (req, res) => {
  const { userId, email, priceId, accountType } = req.body;

  if (!userId || !priceId) {
    return res.status(400).json({ error: "userId and priceId are required" });
  }

  // Upsert user in database
  let user = await storage.upsertUser({ id: userId, email });

  // Create or reuse Stripe customer
  let customerId = user.stripeCustomerId;
  if (!customerId) {
    const customer = await stripeService.createCustomer(
      email || "",
      userId
    );
    user = await storage.updateUserStripeInfo(userId, {
      stripeCustomerId: customer.id,
      accountType,
    });
    customerId = customer.id;
  }

  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;

  const session = await stripeService.createCheckoutSession(
    customerId,
    priceId,
    `${baseUrl}/checkout-success`,
    `${baseUrl}/checkout-cancel`
  );

  return res.json({ url: session.url, sessionId: session.id });
});

// List products with prices (for pricing screen)
router.get("/products-with-prices", async (_req, res) => {
  const rows = await storage.listProductsWithPrices();

  const productsMap = new Map<string, any>();
  for (const row of rows as any[]) {
    if (!productsMap.has(row.product_id)) {
      productsMap.set(row.product_id, {
        id: row.product_id,
        name: row.product_name,
        description: row.product_description,
        active: row.product_active,
        metadata: row.product_metadata,
        prices: [],
      });
    }
    if (row.price_id) {
      productsMap.get(row.product_id).prices.push({
        id: row.price_id,
        unit_amount: row.unit_amount,
        currency: row.currency,
        recurring: row.recurring,
        active: row.price_active,
      });
    }
  }

  return res.json({ data: Array.from(productsMap.values()) });
});

// Customer portal (manage subscription)
router.post("/customer-portal", async (req, res) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = await storage.getUser(userId);
  if (!user?.stripeCustomerId) {
    return res.status(404).json({ error: "No subscription found" });
  }

  const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(",")[0]}`;
  const session = await stripeService.createCustomerPortalSession(
    user.stripeCustomerId,
    baseUrl
  );

  return res.json({ url: session.url });
});

// Verify checkout session completed
router.get("/checkout-verify", async (req, res) => {
  const { sessionId, userId, accountType } = req.query as {
    sessionId: string;
    userId: string;
    accountType: string;
  };

  if (!sessionId || !userId) {
    return res.status(400).json({ error: "sessionId and userId are required" });
  }

  const stripe = await getUncachableStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (session.status === "complete" && session.subscription) {
    await storage.updateUserStripeInfo(userId, {
      stripeSubscriptionId: String(session.subscription),
      isPremium: true,
      accountType: accountType || "company",
    });
    return res.json({ success: true, isPremium: true });
  }

  return res.json({ success: false, isPremium: false });
});

export default router;
