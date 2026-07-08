import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { deletionRequests } from "@workspace/db/schema";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

function page(title: string, inner: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Opinion</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px 80px; color: #1a1a1a; line-height: 1.65; }
  h1 { font-size: 26px; margin-bottom: 8px; }
  p, li { color: #444; }
  form { margin-top: 24px; display: flex; flex-direction: column; gap: 12px; }
  input[type=email] { padding: 12px 14px; font-size: 16px; border: 1px solid #ccc; border-radius: 10px; }
  button { padding: 13px; font-size: 16px; font-weight: 600; color: #fff; background: #f4212e; border: none; border-radius: 10px; cursor: pointer; }
  .ok { background: #e7f7ef; border: 1px solid #b7e4cd; border-radius: 10px; padding: 14px 16px; color: #0a6b3d; }
  .err { background: #fdeaea; border: 1px solid #f3c1c1; border-radius: 10px; padding: 14px 16px; color: #a12626; }
  a { color: #1d9bf0; }
  .small { font-size: 13px; color: #777; margin-top: 24px; }
</style>
</head>
<body>${inner}</body>
</html>`;
}

const FORM_PAGE = page(
  "Delete your account",
  `<h1>Delete your Opinion account</h1>
<p>Enter the email address linked to your Opinion account. We will delete your account and associated data (your profile, verification requests, and server-side records) within 30 days, and confirm by email when it's done.</p>
<ul>
  <li>Polls and votes stored only on your device are removed by uninstalling the app.</li>
  <li>Deletion is permanent and cannot be undone.</li>
</ul>
<form method="POST" action="/delete-account">
  <input type="email" name="email" placeholder="you@example.com" required maxlength="254" />
  <button type="submit">Request account deletion</button>
</form>
<p class="small">You can also email <a href="mailto:akshay21790@gmail.com?subject=Delete%20my%20Opinion%20account">akshay21790@gmail.com</a> from your account address. See our <a href="/privacy">Privacy Policy</a>.</p>`
);

router.get("/delete-account", (_req, res) => {
  res.type("html").send(FORM_PAGE);
});

router.post("/delete-account", async (req, res) => {
  try {
    const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_REGEX.test(email)) {
      return res.status(400).type("html").send(
        page("Delete your account", `<h1>Invalid email</h1><div class="err">That doesn't look like a valid email address. <a href="/delete-account">Go back and try again</a>.</div>`)
      );
    }

    await db.insert(deletionRequests).values({ id: randomUUID(), email });
    logger.info({ email }, "Account deletion requested");

    res.type("html").send(
      page("Request received", `<h1>Request received</h1><div class="ok">Your deletion request for <strong>${email.replace(/</g, "&lt;")}</strong> has been recorded. Your account and associated data will be deleted within 30 days, and you'll receive a confirmation email once complete.</div><p class="small"><a href="/">Back to askopinion.app</a></p>`)
    );
  } catch (err) {
    logger.error({ err }, "delete-account POST error");
    res.status(500).type("html").send(
      page("Error", `<h1>Something went wrong</h1><div class="err">We couldn't record your request. Please try again, or email <a href="mailto:akshay21790@gmail.com">akshay21790@gmail.com</a> directly.</div>`)
    );
  }
});

export default router;
