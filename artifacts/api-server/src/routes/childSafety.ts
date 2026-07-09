import { Router, type IRouter } from "express";

const router: IRouter = Router();

// Published child safety standards, required by Google Play for apps in the
// Social category. Must stay at a stable, publicly reachable, non-editable URL.
const CHILD_SAFETY_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Opinion — Child Safety Standards</title>
<style>
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 0 auto; padding: 32px 20px 80px; color: #1a1a1a; line-height: 1.65; }
  h1 { font-size: 28px; margin-bottom: 4px; }
  .updated { color: #666; font-size: 14px; margin-bottom: 32px; }
  h2 { font-size: 19px; margin-top: 32px; }
  li { margin-bottom: 6px; }
  a { color: #1d9bf0; }
  .callout { background: #fdeaea; border: 1px solid #f3c1c1; border-radius: 10px; padding: 14px 16px; margin: 24px 0; }
</style>
</head>
<body>
<h1>Child Safety Standards — Opinion</h1>
<p class="updated">Last updated: 9 July 2026</p>

<p>Opinion ("the app") is a polling and opinions app operated by an individual developer. We have zero tolerance for child sexual abuse and exploitation (CSAE) and for child sexual abuse material (CSAM). This page sets out the standards we hold ourselves and our users to, as required by Google Play's Child Safety Standards policy.</p>

<div class="callout">
  <strong>Reporting an urgent child safety concern:</strong> email
  <a href="mailto:akshay21790@gmail.com?subject=URGENT%20child%20safety%20report">akshay21790@gmail.com</a>.
  Reports of suspected CSAE are treated as the highest priority and are reviewed ahead of all other reports.
  If a child is in immediate danger, contact your local emergency services first.
</div>

<h2>What is prohibited</h2>
<p>The following are strictly forbidden anywhere in Opinion, including in poll titles, descriptions, hashtags, links, and comments:</p>
<ul>
  <li>Child sexual abuse material (CSAM) in any form.</li>
  <li>Content that sexualises, endangers, or otherwise exploits a minor.</li>
  <li>Grooming, sextortion, trafficking, or any other predatory behaviour directed at a minor.</li>
  <li>Content that normalises, promotes, or encourages the sexual abuse of children.</li>
  <li>Links to external sites hosting any of the above.</li>
</ul>

<h2>In-app reporting</h2>
<p>Every poll and every comment in Opinion can be reported from within the app. Open the poll and use the report control in the top-right corner, or tap the report icon beside any comment. "Child safety" is offered as an explicit reporting reason and is listed first.</p>
<ul>
  <li>Reporting does not require an account — signed-out users can report content.</li>
  <li>Reported content is hidden from the reporter's view immediately.</li>
  <li>Reports are delivered to the app's moderation queue, which the developer reviews directly.</li>
</ul>

<h2>How we respond</h2>
<ul>
  <li>Reports flagged as child safety concerns are reviewed as a priority, ahead of other report categories.</li>
  <li>Confirmed CSAE content is removed and the account responsible is permanently banned.</li>
  <li>Confirmed CSAM is reported to the National Center for Missing &amp; Exploited Children (NCMEC) and, where applicable, to the relevant national authority in the user's jurisdiction. In India this includes the National Cyber Crime Reporting Portal.</li>
  <li>We preserve relevant records as required by law to assist any subsequent investigation.</li>
</ul>

<h2>Compliance with laws</h2>
<p>Opinion complies with applicable child safety laws in the jurisdictions where it is distributed, including reporting obligations to regional and national authorities. We cooperate fully with law enforcement requests relating to child safety.</p>

<h2>Designated point of contact</h2>
<p>The developer of Opinion is the designated point of contact for child safety matters and is able to speak to the app's CSAM prevention practices and compliance:</p>
<ul>
  <li>Email: <a href="mailto:akshay21790@gmail.com">akshay21790@gmail.com</a></li>
</ul>

<h2>Age of users</h2>
<p>Opinion is not directed at children. Accounts are created through our authentication provider and the app is rated for a teen and adult audience. We do not knowingly collect personal information from children under 13. If we learn that we have, the account and its data are deleted.</p>

<h2>Related policies</h2>
<ul>
  <li><a href="/privacy">Privacy Policy</a></li>
  <li><a href="/delete-account">Delete your account and data</a></li>
</ul>

<p style="margin-top:40px;color:#777;font-size:13px;">These standards are published at <strong>https://askopinion.app/child-safety</strong> and are not user-editable.</p>
</body>
</html>`;

router.get("/child-safety", (_req, res) => {
  res.type("html").send(CHILD_SAFETY_HTML);
});

export default router;
