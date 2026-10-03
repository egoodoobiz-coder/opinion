import { Router, type IRouter } from "express";

const router: IRouter = Router();

const PRIVACY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Factinion — Privacy Policy</title>
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
<h1>Privacy Policy — Factinion</h1>
<p class="updated">Last updated: 3 October 2026</p>

<p>Factinion ("the app", "the service") is a polling and opinions service — the Android app, the website factinion.com, and the Factinion accounts on WhatsApp and Instagram. It is operated by <strong>EGOODOO PRIVATE LIMITED</strong> (CIN U51909AP2020PTC115477), India ("we", "us"). Factinion and EGOODOO are trademarks of EGOODOO PRIVATE LIMITED. This policy explains what information the service handles and how.</p>

<h2>Information we collect</h2>
<ul>
  <li><strong>Account information:</strong> when you create an account, your email address and optional name are collected and stored by our authentication provider, Clerk (clerk.com).</li>
  <li><strong>Optional profile details:</strong> you may choose to add demographic details (age range, gender, occupation) to personalise your experience. These are optional and stored with your account.</li>
  <li><strong>Verification requests:</strong> if you apply for a verified Voice badge, your email, name, and the note you write are stored on our server so the request can be reviewed.</li>
  <li><strong>Posts, votes and comments:</strong> polls you create, votes you cast and comments you post are stored on our server so results can be shown to everyone. Results are shown only as totals and percentages.</li>
  <li><strong>Voting without an account:</strong> on the website you can vote without signing up. Your browser stores a random identifier so the same browser can't vote twice; it is not linked to your name or email.</li>
  <li><strong>WhatsApp:</strong> if you message Factinion on WhatsApp, we receive your phone number, WhatsApp profile name and your messages through the WhatsApp Business Platform (Meta) in order to reply and record your votes. Votes are stored against a one-way hashed form of your number, not the number itself.</li>
  <li><strong>Instagram:</strong> if you comment on a Factinion post or message our Instagram account, we receive your Instagram-scoped user ID, username and the text of your comment or message through the Instagram Platform (Meta), so we can reply — for example by sending you a poll link.</li>
</ul>

<h2>How we use information</h2>
<ul>
  <li>To run polls, count votes and show results.</li>
  <li>To reply to messages and comments you send us on WhatsApp and Instagram. Some replies are written automatically by an AI assistant; the text of your message and the list of current polls are sent to our AI provider to produce the reply.</li>
  <li>To keep the service safe (preventing duplicate votes, spam and abuse).</li>
</ul>
<p>We only reply to people who contact us first, and we do not send unsolicited marketing messages.</p>

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
  <li><strong>Meta Platforms</strong> — WhatsApp Business Platform and Instagram Platform, for messaging</li>
  <li><strong>Anthropic</strong> — AI model that drafts automatic replies to messages</li>
</ul>

<h2>Data retention and deletion</h2>
<p>Account data is retained while your account exists. To delete your account and associated data, use the
<a href="/delete-account">account deletion page</a>, or email
<a href="mailto:akshay21790@gmail.com">akshay21790@gmail.com</a> from the address linked to your account. Requests are completed within 30 days. For data from WhatsApp or Instagram, message us there or email us with your number or username and we will delete it. Message history used for automatic replies is kept only briefly in server memory and is not stored in our database.</p>

<h2>Children</h2>
<p>Factinion is not directed at children under 13, and we do not knowingly collect personal information from them.</p>

<h2>Changes</h2>
<p>If this policy changes, the updated version will be posted at this address with a new "last updated" date.</p>

<h2>Contact</h2>
<p>EGOODOO PRIVATE LIMITED (CIN U51909AP2020PTC115477), India.<br>
Questions about this policy: <a href="mailto:akshay21790@gmail.com">akshay21790@gmail.com</a></p>
</body>
</html>`;

router.get("/privacy", (_req, res) => {
  res.type("html").send(PRIVACY_HTML);
});

export default router;
