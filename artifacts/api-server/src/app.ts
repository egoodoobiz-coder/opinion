import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import privacyRouter from "./routes/privacy";
import deleteAccountRouter from "./routes/deleteAccount";
import childSafetyRouter from "./routes/childSafety";
import siteRouter from "./routes/site";
import metaRouter from "./routes/meta";
import { WebhookHandlers } from "./webhookHandlers";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Stripe webhook MUST be registered before express.json()
// It needs raw Buffer, not parsed JSON
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({ error: "Missing stripe-signature" });
    }

    try {
      const sig = Array.isArray(signature) ? signature[0] : signature;

      if (!Buffer.isBuffer(req.body)) {
        logger.error("Webhook body is not a Buffer — check middleware order");
        return res.status(500).json({ error: "Webhook processing error" });
      }

      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (error: any) {
      logger.error({ err: error }, "Webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

// WhatsApp + Instagram agents. Also needs the raw body (signature check), so it
// is mounted before express.json() too.
app.use("/api/meta/webhook", metaRouter);

const allowedOrigins =process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()) ?? [];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) {
        return callback(null, true);
      }
      if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rebrand: permanently redirect the old askopinion.app website to factinion.com.
// We skip /api so the already-shipped v5 app (which still calls askopinion.app/api)
// keeps working — only human-facing pages are redirected.
app.use((req, res, next) => {
  const host = (req.headers.host || "").split(":")[0].toLowerCase();
  if ((host === "askopinion.app" || host === "www.askopinion.app") && !req.path.startsWith("/api")) {
    return res.redirect(301, "https://factinion.com" + req.originalUrl);
  }
  next();
});

app.use("/api", router);
app.use(privacyRouter);
app.use(deleteAccountRouter);
app.use(childSafetyRouter);
app.use(siteRouter);

export default app;
