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

const LANDING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opinion — ask anything, vote on everything</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; background: #000; color: #e7e9ea; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; text-align: center; }
  h1 { font-size: 44px; margin: 16px 0 8px; letter-spacing: -1px; }
  p { color: #71767b; font-size: 17px; max-width: 420px; line-height: 1.6; }
  .soon { display: inline-block; margin-top: 20px; background: #16181c; border: 1px solid #2f3336; border-radius: 100px; padding: 10px 22px; color: #1d9bf0; font-weight: 600; }
  a { color: #536471; font-size: 13px; margin-top: 48px; text-decoration: none; }
</style>
</head>
<body>
<svg width="88" height="88" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="42" fill="#16181c" stroke="#2f3336" stroke-width="1"/>
  <path d="M50 8 A42 42 0 0 1 50 92 A21 21 0 0 1 50 50 A21 21 0 0 0 50 8 Z" fill="#00ba7c"/>
  <path d="M50 8 A42 42 0 0 0 50 92 A21 21 0 0 0 50 50 A21 21 0 0 1 50 8 Z" fill="#f4212e"/>
  <circle cx="50" cy="29" r="8" fill="#000"/>
  <circle cx="50" cy="71" r="8" fill="#000"/>
</svg>
<h1>Opinion</h1>
<p>Ask anything, vote on everything. Quick polls, ratings, and honest opinions.</p>
<span class="soon">Coming soon to Google Play</span>
<a href="/privacy">Privacy Policy</a>
</body>
</html>`;

router.get("/", (_req, res) => {
  res.type("html").send(LANDING_HTML);
});

export default router;
