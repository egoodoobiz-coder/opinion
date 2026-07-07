import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opinion — Privacy Policy</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; color: #1a1a1a; line-height: 1.65; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .updated { color: #666; font-size: 14px; margin-bottom: 32px; }
  h2 { font-size: 19px; margin-top: 32px; }
  li { margin-bottom: 6px; }
  a { color: #1d9bf0; }
</style>
</head>
<body>
<h1>Privacy Policy — Opinion</h1>
<p class="updated">Last updated: 7 July 2026</p>

<p>Opinion ("the app") is a polling and opinions app operated by an individual developer. This policy explains what information the app handles and how.</p>

<h2>Information we collect</h2>
<ul>
  <li><strong>Account information:</strong> when you create an account, your email address and optional name are collected and stored by our authentication provider, Clerk (clerk.com).</li>
  <li><strong>Optional profile details:</strong> you may choose to add demographic details (age range, gender, occupation) to personalise your experience. These are optional and stored with your account.</li>
  <li><strong>Verification requests:</strong> if you apply for a verified Voice badge, your email, name, and the note you write are stored on our server so the request can be reviewed.</li>
  <li><strong>Posts and votes:</strong> polls you create and votes you cast are currently stored locally on your device.</li>
</ul>

<h2>What we do NOT do</h2>
<ul>
  <li>We do not sell your personal information.</li>
  <li>We do not show third-party advertising.</li>
  <li>We do not collect your precise location, contacts, photos, or files.</li>
</ul>

<h2>Service providers</h2>
<p>The app relies on the following providers, which process data on our behalf:</p>
<ul>
  <li><strong>Clerk</strong> — sign-in and account management</li>
  <li><strong>Railway</strong> — server and database hosting</li>
  <li><strong>Expo</strong> — app build and delivery infrastructure</li>
</ul>

<h2>Data retention and deletion</h2>
<p>Account data is retained while your account exists. To delete your account and associated data, email
<a href="mailto:akshay21790@gmail.com">akshay21790@gmail.com</a> from the address linked to your account and we will remove it within 30 days.</p>

<h2>Children</h2>
<p>Opinion is not directed at children under 13, and we do not knowingly collect personal information from them.</p>

<h2>Changes</h2>
<p>If this policy changes, the updated version will be posted at this address with a new "last updated" date.</p>

<h2>Contact</h2>
<p>Questions about this policy: <a href="mailto:akshay21790@gmail.com">akshay21790@gmail.com</a></p>
</body>
</html>`;

router.get("/privacy", (_req, res) => {
  res.type("html").send(PRIVACY_HTML);
});

export default router;
