import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { topics, topicComments } from "@workspace/db/schema";
import { desc, inArray, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
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
const FEATURED_TOPIC_IDS = (
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
