import { Router, type IRouter } from "express";
import { verifyToken } from "@clerk/backend";
import { db } from "@workspace/db";
import { topics, topicVotes, topicComments, users } from "@workspace/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { randomUUID } from "crypto";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const CATEGORIES = [
  "food", "tech", "movies", "music", "sports", "politics",
  "gaming", "science", "lifestyle", "travel", "automobiles", "other",
];
const VOTING_TYPES = ["yesno", "rating", "ranking", "aspects", "choice"];

const MAX_TITLE = 120;
const MAX_DESC = 500;
const MAX_COMMENT = 500;

type DemoBreakdown = Record<string, Record<string, number>>;
type Demo = Record<string, string>;

async function getUserId(req: any): Promise<string | null> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    const payload = await verifyToken(authHeader.slice(7), { secretKey: process.env.CLERK_SECRET_KEY });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

// Voter identity for casting/reading votes: a signed-in Clerk user id when
// present, otherwise an anonymous id the client sends via the x-anon-id header
// (namespaced "anon_" so it can never collide with a Clerk id). This lets people
// vote on the web with one tap, no sign-up — while topic creation and comments
// still require a real account. The header is validated to a safe id shape.
async function getVoterId(req: any): Promise<string | null> {
  const userId = await getUserId(req);
  if (userId) return userId;
  const anon = req.headers["x-anon-id"];
  if (typeof anon === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(anon)) {
    return "anon_" + anon;
  }
  return null;
}

// Premium (paid insights) is a secure server flag on our users table — never the
// client-editable Clerk metadata. Only premium users receive the demographic
// breakdown ("who voted"); everyone else gets an empty breakdown + an upsell.
async function isPremiumUser(userId: string | null): Promise<boolean> {
  if (!userId || userId.startsWith("anon_")) return false;
  try {
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    return !!u?.isPremium;
  } catch {
    return false;
  }
}

// Strip the demographic breakdown from a topic row unless the viewer is premium.
function gateInsights<T extends { demoBreakdown?: any }>(row: T, premium: boolean): T {
  if (premium) return row;
  return { ...row, demoBreakdown: {} };
}

// Port of applyDemoToBreakdown from the app's AppContext: add/remove one voter's
// demographics from a topic's running breakdown.
function applyDemo(breakdown: DemoBreakdown, demo: Demo | null | undefined, delta: 1 | -1): DemoBreakdown {
  if (!demo) return breakdown;
  const result: DemoBreakdown = { ...breakdown };
  for (const field of ["ageRange", "gender", "country", "occupation"]) {
    const val = demo[field];
    if (!val) continue;
    const current = { ...(result[field] ?? {}) };
    current[val] = Math.max(0, (current[val] ?? 0) + delta);
    result[field] = current;
  }
  return result;
}

function demoHasKeys(demo: Demo | null | undefined): boolean {
  return !!demo && Object.keys(demo).some((k) => demo[k]);
}

// Attach each topic's comments (one extra query, grouped in JS).
async function withComments(rows: any[]) {
  if (rows.length === 0) return [];
  const ids = rows.map((t) => t.id);
  const comments = await db.select().from(topicComments).where(inArray(topicComments.topicId, ids));
  const byTopic: Record<string, any[]> = {};
  for (const c of comments) {
    (byTopic[c.topicId] ??= []).push({
      id: c.id,
      topicId: c.topicId,
      text: c.text,
      authorId: c.authorId,
      authorName: c.authorName,
      createdAt: c.createdAt ? new Date(c.createdAt).getTime() : Date.now(),
    });
  }
  return rows.map((t) => ({
    ...t,
    createdAt: t.createdAt ? new Date(t.createdAt).getTime() : Date.now(),
    comments: (byTopic[t.id] ?? []).sort((a, b) => a.createdAt - b.createdAt),
  }));
}

// GET /topics — the shared feed (public: app + website both read). The
// demographic breakdown is premium-only, so it's stripped for non-premium
// viewers (including anonymous ones).
router.get("/topics", async (req: any, res) => {
  try {
    const premium = await isPremiumUser(await getUserId(req));
    const rows = await db.select().from(topics).orderBy(desc(topics.createdAt));
    const list = await withComments(rows);
    res.json({ topics: premium ? list : list.map((t) => gateInsights(t, false)) });
  } catch (err) {
    logger.error({ err }, "topics GET error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /topics/me/votes — the signed-in user's votes, keyed by topic id.
router.get("/topics/me/votes", async (req: any, res) => {
  try {
    const userId = await getVoterId(req);
    if (!userId) return res.json({ votes: {} });
    const rows = await db.select().from(topicVotes).where(eq(topicVotes.userId, userId));
    const votes: Record<string, any> = {};
    for (const v of rows) {
      votes[v.topicId] = {
        topicId: v.topicId,
        yesno: v.yesno ?? undefined,
        rating: v.rating ?? undefined,
        ranking: v.ranking ?? undefined,
        aspectChoices: v.aspectChoices ?? undefined,
        voterDemo: v.voterDemo ?? undefined,
      };
    }
    res.json({ votes });
  } catch (err) {
    logger.error({ err }, "topics votes GET error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /me — the signed-in user's profile card data: verification/premium flags
// (server-authoritative) plus lightweight activity counts. Identity fields
// (name, email, avatar) come from Clerk on the client.
router.get("/me", async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const [u] = await db.select().from(users).where(eq(users.id, userId));
    const votes = await db.select().from(topicVotes).where(eq(topicVotes.userId, userId));
    const created = await db.select().from(topics).where(eq(topics.createdBy, userId));
    const comments = await db.select().from(topicComments).where(eq(topicComments.authorId, userId));
    res.json({
      isPremium: !!u?.isPremium,
      isVerified: !!u?.isVerified,
      voiceType: u?.voiceType ?? null,
      voteCount: votes.length,
      topicCount: created.length,
      commentCount: comments.length,
    });
  } catch (err) {
    logger.error({ err }, "me GET error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /topics/:id — a single topic (public). Breakdown gated to premium.
router.get("/topics/:id", async (req: any, res) => {
  try {
    const premium = await isPremiumUser(await getUserId(req));
    const [row] = await db.select().from(topics).where(eq(topics.id, req.params.id));
    if (!row) return res.status(404).json({ error: "Topic not found" });
    const [withC] = await withComments([row]);
    res.json({ topic: gateInsights(withC, premium) });
  } catch (err) {
    logger.error({ err }, "topic GET error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /topics/:id/insights — the demographic breakdown, premium only. Used by
// the website to unlock the "Who voted" panel for signed-in premium viewers.
router.get("/topics/:id/insights", async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!(await isPremiumUser(userId))) return res.status(403).json({ error: "Premium required" });
    const [row] = await db.select().from(topics).where(eq(topics.id, req.params.id));
    if (!row) return res.status(404).json({ error: "Topic not found" });
    res.json({ demoBreakdown: row.demoBreakdown ?? {} });
  } catch (err) {
    logger.error({ err }, "topic insights GET error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /topics — create a topic (auth required).
router.post("/topics", async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const b = req.body ?? {};
    if (typeof b.title !== "string" || !b.title.trim() || b.title.length > MAX_TITLE) {
      return res.status(400).json({ error: "Invalid title" });
    }
    if (!CATEGORIES.includes(b.category)) return res.status(400).json({ error: "Invalid category" });
    if (!VOTING_TYPES.includes(b.votingType)) return res.status(400).json({ error: "Invalid voting type" });
    if (b.description && (typeof b.description !== "string" || b.description.length > MAX_DESC)) {
      return res.status(400).json({ error: "Invalid description" });
    }

    if (b.votingType === "choice" || b.votingType === "ranking") {
      const opts = Array.isArray(b.rankingOptions) ? b.rankingOptions : [];
      if (opts.length < 2) return res.status(400).json({ error: "This poll type needs at least 2 options" });
    }

    const aspects = Array.isArray(b.aspects) ? b.aspects.slice(0, 10) : null;
    const aspectVotes: Record<string, { up: number; down: number }> = {};
    if (b.votingType === "aspects" && aspects) {
      for (const a of aspects) aspectVotes[a] = { up: 0, down: 0 };
    }

    // The verified-badge type is derived from the author's real account, never
    // trusted from the request body (which a web client could forge).
    const [author] = await db.select().from(users).where(eq(users.id, userId));
    const voiceType = author?.isVerified ? (author.voiceType ?? null) : null;

    const [row] = await db
      .insert(topics)
      .values({
        id: randomUUID(),
        title: b.title.trim(),
        description: typeof b.description === "string" ? b.description.trim() : "",
        category: b.category,
        votingType: b.votingType,
        rankingOptions: Array.isArray(b.rankingOptions) ? b.rankingOptions : null,
        aspects,
        hashtags: Array.isArray(b.hashtags) ? b.hashtags.slice(0, 10) : null,
        linkUrl: typeof b.linkUrl === "string" && b.linkUrl ? b.linkUrl : null,
        targetDemographics: b.targetDemographics ?? null,
        createdBy: userId,
        createdByName: typeof b.createdByName === "string" ? b.createdByName.slice(0, 80) : null,
        voiceType,
        aspectVotes,
      })
      .returning();

    const [withC] = await withComments([row]);
    res.json({ topic: withC });
  } catch (err) {
    logger.error({ err }, "topic POST error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cast or change one voter's vote. Transactional so the denormalised aggregates
// stay consistent. Shared by the HTTP route below and the WhatsApp agent, so a
// vote counts identically wherever it comes from. Body kinds mirror the app's
// voteYesNo / voteRating / voteRanking / voteAspect / voteChoice.
export async function applyVote(topicId: string, userId: string, body: any) {
  const kind = body?.kind;
  const voterDemo: Demo | null = body?.voterDemo ?? null;
  return db.transaction(async (tx) => {
    const [topic] = await tx.select().from(topics).where(eq(topics.id, topicId));
    if (!topic) return { error: 404 as const };
    const [prev] = await tx.select().from(topicVotes).where(and(eq(topicVotes.topicId, topicId), eq(topicVotes.userId, userId)));

    const patch: any = {};
    const votePatch: any = { yesno: prev?.yesno ?? null, rating: prev?.rating ?? null, ranking: prev?.ranking ?? null, aspectChoices: prev?.aspectChoices ?? null };

    if (kind === "yesno") {
      const value = body.value === "yes" ? "yes" : body.value === "no" ? "no" : null;
      if (!value) return { error: 400 as const };
      let { yesCount, noCount } = topic;
      if (prev?.yesno === "yes") yesCount--;
      if (prev?.yesno === "no") noCount--;
      if (value === "yes") yesCount++; else noCount++;
      let demo = (topic.demoBreakdown as DemoBreakdown) ?? {};
      if (prev?.voterDemo) demo = applyDemo(demo, prev.voterDemo as Demo, -1);
      if (demoHasKeys(voterDemo)) demo = applyDemo(demo, voterDemo, 1);
      patch.yesCount = Math.max(0, yesCount);
      patch.noCount = Math.max(0, noCount);
      patch.demoBreakdown = demo;
      votePatch.yesno = value;
    } else if (kind === "rating") {
      const value = Number(body.value);
      if (!Number.isFinite(value) || value < 1 || value > 5) return { error: 400 as const };
      let { totalRating, ratingCount } = topic;
      const hadRating = prev?.rating != null;
      if (hadRating) { totalRating -= prev!.rating!; ratingCount--; }
      totalRating += value; ratingCount++;
      let demo = (topic.demoBreakdown as DemoBreakdown) ?? {};
      if (!hadRating && demoHasKeys(voterDemo)) demo = applyDemo(demo, voterDemo, 1);
      patch.totalRating = Math.max(0, totalRating);
      patch.ratingCount = Math.max(0, ratingCount);
      patch.demoBreakdown = demo;
      votePatch.rating = value;
    } else if (kind === "ranking") {
      const ordered: string[] = Array.isArray(body.value) ? body.value : [];
      if (!ordered.length) return { error: 400 as const };
      const rankingVotes: Record<string, number[]> = { ...((topic.rankingVotes as any) ?? {}) };
      const prevRanking: string[] | null = (prev?.ranking as any) ?? null;
      if (prevRanking) {
        prevRanking.forEach((optId, idx) => {
          const rank = idx + 1;
          if (rankingVotes[optId]) rankingVotes[optId] = rankingVotes[optId].filter((r) => r !== rank);
        });
      }
      ordered.forEach((optId, idx) => {
        const rank = idx + 1;
        (rankingVotes[optId] ??= []).push(rank);
      });
      let demo = (topic.demoBreakdown as DemoBreakdown) ?? {};
      if (prev?.voterDemo && !prevRanking) demo = applyDemo(demo, prev.voterDemo as Demo, -1);
      if (!prevRanking && demoHasKeys(voterDemo)) demo = applyDemo(demo, voterDemo, 1);
      patch.rankingVotes = rankingVotes;
      patch.demoBreakdown = demo;
      votePatch.ranking = ordered;
    } else if (kind === "aspect") {
      const aspect = body.aspect;
      const choice = body.choice === "up" ? "up" : body.choice === "down" ? "down" : null;
      if (typeof aspect !== "string" || !choice) return { error: 400 as const };
      const aspectVotes: Record<string, { up: number; down: number }> = { ...((topic.aspectVotes as any) ?? {}) };
      const cur = { ...(aspectVotes[aspect] ?? { up: 0, down: 0 }) };
      const prevChoices: Record<string, "up" | "down"> = (prev?.aspectChoices as any) ?? {};
      const prevChoice = prevChoices[aspect];
      if (prevChoice === choice) {
        cur[choice] = Math.max(0, cur[choice] - 1);
      } else {
        if (prevChoice === "up") cur.up = Math.max(0, cur.up - 1);
        if (prevChoice === "down") cur.down = Math.max(0, cur.down - 1);
        cur[choice]++;
      }
      aspectVotes[aspect] = cur;
      const isFirstAspectVote = Object.keys(prevChoices).length === 0;
      let demo = (topic.demoBreakdown as DemoBreakdown) ?? {};
      if (isFirstAspectVote && demoHasKeys(voterDemo)) demo = applyDemo(demo, voterDemo, 1);
      const nextChoices = { ...prevChoices };
      if (prevChoice === choice) delete nextChoices[aspect]; else nextChoices[aspect] = choice;
      patch.aspectVotes = aspectVotes;
      patch.demoBreakdown = demo;
      votePatch.aspectChoices = nextChoices;
    } else if (kind === "choice") {
      // Single-select poll ("pick one of many"). Options live in rankingOptions;
      // tallies are stored in rankingVotes as { optionId: count }; the voter's
      // pick is stored in topicVotes.ranking as a single-element array [optionId].
      const optId = typeof body.value === "string" ? body.value : null;
      if (!optId) return { error: 400 as const };
      const choiceVotes: Record<string, number> = { ...((topic.rankingVotes as any) ?? {}) };
      const prevPick: string | null = Array.isArray(prev?.ranking) ? ((prev!.ranking as any)[0] ?? null) : null;
      if (prevPick === optId) return { error: 400 as const }; // no-op: already their pick
      if (prevPick && choiceVotes[prevPick]) choiceVotes[prevPick] = Math.max(0, choiceVotes[prevPick] - 1);
      choiceVotes[optId] = (Number(choiceVotes[optId]) || 0) + 1;
      let demo = (topic.demoBreakdown as DemoBreakdown) ?? {};
      if (!prevPick && demoHasKeys(voterDemo)) demo = applyDemo(demo, voterDemo, 1);
      patch.rankingVotes = choiceVotes as any;
      patch.demoBreakdown = demo;
      votePatch.ranking = [optId];
    } else {
      return { error: 400 as const };
    }

    await tx.update(topics).set(patch).where(eq(topics.id, topicId));

    if (prev) {
      await tx.update(topicVotes).set({ ...votePatch, voterDemo, updatedAt: new Date() })
        .where(eq(topicVotes.id, prev.id));
    } else {
      await tx.insert(topicVotes).values({ id: randomUUID(), topicId, userId, ...votePatch, voterDemo });
    }
    return { ok: true as const };
  });
}

// POST /topics/:id/vote — cast or change a vote (Clerk user or anonymous id).
router.post("/topics/:id/vote", async (req: any, res) => {
  try {
    const userId = await getVoterId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const topicId = req.params.id;
    const result = await applyVote(topicId, userId, req.body ?? {});

    if ("error" in result) {
      const code = result.error as number;
      return res.status(code).json({ error: code === 404 ? "Topic not found" : "Invalid vote" });
    }

    const [row] = await db.select().from(topics).where(eq(topics.id, topicId));
    const [withC] = await withComments([row]);
    const [myVote] = await db.select().from(topicVotes).where(and(eq(topicVotes.topicId, topicId), eq(topicVotes.userId, userId)));
    res.json({
      topic: withC,
      userVote: myVote && {
        topicId, yesno: myVote.yesno ?? undefined, rating: myVote.rating ?? undefined,
        ranking: myVote.ranking ?? undefined, aspectChoices: myVote.aspectChoices ?? undefined,
      },
    });
  } catch (err) {
    logger.error({ err }, "vote POST error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /topics/:id/comments — add a comment (auth required).
router.post("/topics/:id/comments", async (req: any, res) => {
  try {
    const userId = await getUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
    const authorName = typeof req.body?.authorName === "string" ? req.body.authorName : "Anonymous";
    if (!text || text.length > MAX_COMMENT) return res.status(400).json({ error: "Invalid comment" });

    const [topic] = await db.select().from(topics).where(eq(topics.id, req.params.id));
    if (!topic) return res.status(404).json({ error: "Topic not found" });

    const [row] = await db.insert(topicComments).values({
      id: randomUUID(), topicId: req.params.id, authorId: userId, authorName, text,
    }).returning();

    res.json({
      comment: {
        id: row.id, topicId: row.topicId, text: row.text, authorId: row.authorId,
        authorName: row.authorName, createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
      },
    });
  } catch (err) {
    logger.error({ err }, "comment POST error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
