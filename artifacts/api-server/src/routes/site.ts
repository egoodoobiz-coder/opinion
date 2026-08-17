import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { topics, topicComments } from "@workspace/db/schema";
import { desc, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  renderPage,
  type SiteTopic,
  type AspectVotes,
  type DemoBreakdown,
  type RankingOption,
  type RankingVotes,
} from "./siteRender";

const router: IRouter = Router();

let cache: { at: number; html: string } | null = null;
const CACHE_MS = 15000;

async function loadTopics(): Promise<SiteTopic[]> {
  const rows = await db.select().from(topics).orderBy(desc(topics.createdAt));
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

  return (rows as any[]).map((r) => ({
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
    createdAt: r.createdAt ? new Date(r.createdAt).getTime() : Date.now(),
    yesCount: r.yesCount ?? 0,
    noCount: r.noCount ?? 0,
    totalRating: r.totalRating ?? 0,
    ratingCount: r.ratingCount ?? 0,
    rankingVotes: (r.rankingVotes as RankingVotes) ?? {},
    aspectVotes: (r.aspectVotes as AspectVotes) ?? {},
    demoBreakdown: (r.demoBreakdown as DemoBreakdown) ?? {},
    commentCount: counts[r.id] ?? 0,
    latestComment: latest[r.id] ? { authorName: latest[r.id].authorName, text: latest[r.id].text } : null,
  }));
}

router.get("/", async (_req, res) => {
  try {
    if (cache && Date.now() - cache.at < CACHE_MS) {
      return res.type("html").send(cache.html);
    }
    const html = renderPage(await loadTopics());
    cache = { at: Date.now(), html };
    res.type("html").send(html);
  } catch (err) {
    // The homepage must never 500 for a Play reviewer, so fall back to the
    // static shell with an empty feed.
    logger.error({ err }, "site render error");
    res.type("html").send(renderPage([]));
  }
});

export default router;
