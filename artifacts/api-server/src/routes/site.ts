import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { topics, topicComments } from "@workspace/db/schema";
import { desc, inArray, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { OG_PNG_BASE64 } from "../ogImage";
import {
  renderPage,
  renderInsightsPage,
  renderTopicPage,
  renderCreatePage,
  renderNotFound,
  type SiteTopic,
  type SiteComment,
  type AspectVotes,
  type RankingOption,
  type RankingVotes,
} from "./siteRender";

const router: IRouter = Router();

const cache: Record<string, { at: number; html: string }> = {};
const CACHE_MS = 15000;

// The polls to surface in the homepage "LIVE" section (actively promoted). Other
// polls appear below under "Other opinions". Set SITE_FEATURED_TOPIC_IDS
// (comma-separated) to change which are featured, or "all" for a single feed.
export const FEATURED_TOPIC_IDS = (
  process.env.SITE_FEATURED_TOPIC_IDS ??
  "4108e5c0-dea3-41e4-9923-106b70d2484d,073a404c-adad-47b6-88ad-03cb8e3c48ef"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const FEATURE_ALL =
  FEATURED_TOPIC_IDS.length === 0 ||
  FEATURED_TOPIC_IDS.some((s) => s.toLowerCase() === "all");

// One shape, one mapping — the feed and the per-topic page read rows the same way.
function mapRow(r: any, commentCount: number, latestComment: SiteTopic["latestComment"]): SiteTopic {
  return {
    id: r.id,
    topicNumber: r.topicNumber ?? null,
    title: r.title,
    description: r.description ?? null,
    category: r.category,
    votingType: r.votingType,
    rankingOptions: (r.rankingOptions as RankingOption[]) ?? null,
    aspects: (r.aspects as string[]) ?? null,
    hashtags: (r.hashtags as string[]) ?? null,
    createdByName: r.createdByName ?? null,
    voiceType: r.voiceType ?? null,
    createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    yesCount: r.yesCount ?? 0,
    noCount: r.noCount ?? 0,
    totalRating: r.totalRating ?? 0,
    ratingCount: r.ratingCount ?? 0,
    rankingVotes: (r.rankingVotes as RankingVotes) ?? {},
    aspectVotes: (r.aspectVotes as AspectVotes) ?? {},
    // Demographic breakdown is premium-only, so it's never baked into the public
    // HTML. Premium viewers unlock it client-side via /api/topics/:id/insights.
    demoBreakdown: {},
    commentCount,
    latestComment,
  };
}

// Leftover demo/seed topics (createdBy "system") carry fake vote counts, so they
// never show on the public site.
function isHidden(r: any): boolean {
  return r.createdBy === "system";
}

async function loadTopics(): Promise<SiteTopic[]> {
  const rows = (await db.select().from(topics).orderBy(desc(topics.createdAt))).filter((r: any) => !isHidden(r));
  if (rows.length === 0) return [];

  const ids = rows.map((r: any) => r.id);
  const comments = await db.select().from(topicComments).where(inArray(topicComments.topicId, ids));

  const counts: Record<string, number> = {};
  const latest: Record<string, { at: number; authorName: string | null; text: string }> = {};
  for (const c of comments as any[]) {
    counts[c.topicId] = (counts[c.topicId] ?? 0) + 1;
    const at = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    if (!latest[c.topicId] || at > latest[c.topicId].at) {
      latest[c.topicId] = { at, authorName: c.authorName ?? null, text: c.text };
    }
  }

  return (rows as any[]).map((r) =>
    mapRow(r, counts[r.id] ?? 0, latest[r.id] ? { authorName: latest[r.id].authorName, text: latest[r.id].text } : null),
  );
}

// The ids to surface in the homepage "LIVE" section (the polls being promoted).
// Empty / "all" → no special LIVE section, just one feed.
const LIVE_IDS = FEATURE_ALL ? [] : FEATURED_TOPIC_IDS;

async function loadTopic(id: string): Promise<{ topic: SiteTopic; comments: SiteComment[] } | null> {
  const rows = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  if (rows.length === 0) return null;

  const commentRows = await db
    .select()
    .from(topicComments)
    .where(eq(topicComments.topicId, id))
    .orderBy(desc(topicComments.createdAt));

  const comments: SiteComment[] = (commentRows as any[]).map((c) => ({
    authorName: c.authorName ?? null,
    text: c.text,
    createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
  }));

  const latest = comments[0] ? { authorName: comments[0].authorName, text: comments[0].text } : null;
  return { topic: mapRow(rows[0], comments.length, latest), comments };
}

function page(key: string, render: (list: SiteTopic[]) => string) {
  return async (req: any, res: any) => {
    try {
      // `?fresh=` (used by the client right after a vote) bypasses the cache so
      // the new result shows immediately instead of up to CACHE_MS later.
      const fresh = req.query && req.query.fresh;
      const hit = cache[key];
      if (!fresh && hit && Date.now() - hit.at < CACHE_MS) {
        return res.type("html").send(hit.html);
      }
      const html = render(await loadTopics());
      cache[key] = { at: Date.now(), html };
      res.type("html").send(html);
    } catch (err) {
      // These are Play-reviewer-facing URLs, so they must never 500 — fall back
      // to the static shell with an empty feed.
      logger.error({ err, key }, "site render error");
      res.type("html").send(render([]));
    }
  };
}

router.get("/", page("home", (list) => renderPage(list, LIVE_IDS)));
router.get("/insights", page("insights", renderInsightsPage));
router.get("/create", (_req, res) => res.type("html").send(renderCreatePage()));

// Owner-only helper: connects the business's existing WhatsApp Business app number
// to the Cloud API without leaving the app ("coexistence"), via Meta's Embedded
// Signup. Only a Meta business admin can complete it, so the page holds no secrets.
// Usage: /connect-whatsapp?config=<Facebook Login for Business configuration id>
router.get("/connect-whatsapp", (req: any, res: any) => {
  const config = String(req.query?.config ?? "").replace(/[^0-9]/g, "");
  res.set("Cache-Control", "no-store");
  res.type("html").send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Connect WhatsApp · Factinion</title>
<style>
  body { margin: 0; font-family: system-ui, sans-serif; background: #070a14; color: #e7ecf5; display: grid; place-items: center; min-height: 100vh; padding: 16px; box-sizing: border-box; }
  .card { max-width: 480px; width: 100%; background: #111827; border: 1px solid #1f2937; border-radius: 16px; padding: 28px; }
  h1 { font-size: 20px; margin: 0 0 8px; } p { color: #9ca3af; line-height: 1.5; font-size: 14px; }
  button { font: inherit; font-weight: 600; background: #1877f2; color: #fff; border: 0; border-radius: 10px; padding: 12px 18px; cursor: pointer; width: 100%; margin-top: 8px; }
  button:disabled { opacity: .5; cursor: default; }
  pre { background: #0b1220; border-radius: 10px; padding: 12px; white-space: pre-wrap; word-break: break-all; font-size: 12px; color: #a7f3d0; }
</style></head>
<body><div class="card">
  <h1>Connect the Factinion WhatsApp number</h1>
  <p>Links your WhatsApp Business app number to the Factinion agent. You keep using the app on your phone — chats stay in sync. Have that phone ready to scan a QR code.</p>
  <button id="go" disabled>${config ? "Loading…" : "Missing ?config= id"}</button>
  <pre id="out" hidden></pre>
</div>
<script>
  var CONFIG_ID = "${config}";
  var out = document.getElementById("out");
  var btn = document.getElementById("go");
  function show(label, obj) { out.hidden = false; out.textContent += label + ": " + JSON.stringify(obj, null, 2) + "\\n\\n"; }
  window.addEventListener("message", function (event) {
    if (!/facebook\\.com$/.test(new URL(event.origin).hostname)) return;
    try { var data = JSON.parse(event.data); if (data.type === "WA_EMBEDDED_SIGNUP") show("Result", data); } catch (e) {}
  });
  window.fbAsyncInit = function () {
    FB.init({ appId: "2114019372817828", autoLogAppEvents: true, xfbml: true, version: "v23.0" });
    if (CONFIG_ID) { btn.disabled = false; btn.textContent = "Connect WhatsApp"; }
  };
  btn.addEventListener("click", function () {
    FB.login(function (response) {
      show("Login", response && response.authResponse ? { ok: true } : { ok: false, status: response && response.status });
    }, {
      config_id: CONFIG_ID,
      response_type: "code",
      override_default_response_type: true,
      extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" }
    });
  });
</script>
<script async defer crossorigin="anonymous" src="https://connect.facebook.net/en_US/sdk.js"></script>
</body></html>`);
});

// The branded link-preview image (Open Graph / Twitter), referenced by og:image.
const OG_PNG = Buffer.from(OG_PNG_BASE64, "base64");
router.get("/og.png", (_req, res) => {
  res.set("Content-Type", "image/png");
  res.set("Cache-Control", "public, max-age=86400");
  res.send(OG_PNG);
});

router.get("/topic/:id", async (req: any, res: any) => {
  const id = String(req.params.id);
  const key = `topic:${id}`;
  try {
    const fresh = req.query && req.query.fresh;
    const hit = cache[key];
    if (!fresh && hit && Date.now() - hit.at < CACHE_MS) {
      return res.type("html").send(hit.html);
    }
    const data = await loadTopic(id);
    if (!data) return res.status(404).type("html").send(renderNotFound());
    const html = renderTopicPage(data.topic, data.comments);
    cache[key] = { at: Date.now(), html };
    res.type("html").send(html);
  } catch (err) {
    logger.error({ err, id }, "topic render error");
    res.status(404).type("html").send(renderNotFound());
  }
});

export default router;
