import { getStripeSync, isStripeConfigured } from "./stripeClient";
import app from "./app";
import { logger } from "./lib/logger";

async function initStripe() {
  if (!isStripeConfigured()) {
    logger.warn(
      "STRIPE_SECRET_KEY not set — Stripe features disabled. " +
        "Set STRIPE_SECRET_KEY in your .env to enable payments."
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    logger.warn("DATABASE_URL not set — skipping Stripe schema migration");
    return;
  }

  try {
    // Dynamically import so the module doesn't blow up when Stripe isn't connected
    const { runMigrations } = await import("stripe-replit-sync");
    logger.info("Initializing Stripe schema...");
    await runMigrations({ databaseUrl, schema: "stripe" });
    logger.info("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const replitDomain = process.env.REPLIT_DOMAINS?.split(",")[0];
    if (replitDomain) {
      logger.info("Setting up managed webhook...");
      const webhookBaseUrl = `https://${replitDomain}`;
      await (stripeSync as any).findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      logger.info("Webhook configured");
    } else {
      logger.warn(
        "REPLIT_DOMAINS not set — skipping webhook registration. " +
          "Set API_BASE_URL and register your webhook manually for local dev."
      );
    }

    logger.info("Syncing Stripe data...");
    (stripeSync as any)
      .syncBackfill?.()
      .then(() => logger.info("Stripe data synced"))
      .catch((err: unknown) =>
        logger.error({ err }, "Error syncing Stripe data")
      );
  } catch (error: any) {
    logger.error({ err: error }, "Failed to initialize Stripe");
    // Don't re-throw — let the server start without Stripe
  }
}

// Default to 3000 locally if PORT is not set
const rawPort = process.env.PORT ?? "3000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

await initStripe();

const server = app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down gracefully...");
  server.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
