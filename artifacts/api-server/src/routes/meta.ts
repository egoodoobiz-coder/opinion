// Meta webhook: the Factinion social agents for WhatsApp and Instagram, on Meta's
// official APIs (WhatsApp Cloud API + Instagram API with Instagram Login).
//
//   WhatsApp  — "hi"/"polls" → list of live polls; pick one → vote with buttons or
//               a list right inside the chat (counted exactly like a web vote via
//               applyVote); results come straight back. Free text → AI reply.
//   Instagram — comment a keyword (e.g. "DBC") → private DM with the poll link +
//               public "check your DMs" reply. DMs → keyword link or AI reply.
//
// Meta only lets a business reply inside 24h of the user's last message (and DM a
// commenter once), so this agent never starts conversations — it only answers.
//
// Env (all optional; each channel switches on once its vars are set):
//   META_VERIFY_TOKEN         any secret string; pasted into Meta's webhook setup
//   META_APP_SECRET           Meta app secret (verifies WhatsApp webhook signatures)
//   IG_APP_SECRET             Instagram app secret (verifies Instagram signatures)
//   WA_TOKEN, WA_PHONE_NUMBER_ID   WhatsApp Cloud API system-user token + number id
//   IG_TOKEN, IG_USER_ID      Instagram long-lived token + professional account id
//   ANTHROPIC_API_KEY         enables AI replies (AGENT_MODEL to override the model)
//   AGENT_KEYWORDS            JSON {"keyword":"topicId"} for comment→DM triggers
import express, { Router, type IRouter } from "express";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { topics } from "@workspace/db/schema";
import { desc, eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { applyVote } from "./topics";
import { FEATURED_TOPIC_IDS } from "./site";

const router: IRouter = Router();

const GRAPH = process.env.META_GRAPH_VERSION || "v23.0";
const SITE = "https://factinion.com";
const PLAY_URL = "https://play.google.com/store/apps/details?id=app.askopinion";
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "";
const APP_SECRETS = [process.env.META_APP_SECRET, process.env.IG_APP_SECRET].filter(Boolean) as string[];
const WA_TOKEN = process.env.WA_TOKEN || "";
const WA_PHONE_ID = process.env.WA_PHONE_NUMBER_ID || "";
const IG_TOKEN = process.env.IG_TOKEN || "";
const IG_USER_ID = process.env.IG_USER_ID || "";
const IG_USERNAME = (process.env.IG_USERNAME || "factinion.app").toLowerCase();
const IG_DM_NOTICE = "Sent you the link in DM 📩";
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || "";
const AI_MODEL = process.env.AGENT_MODEL || "claude-haiku-4-5-20251001";

const DBC_ID = "4108e5c0-dea3-41e4-9923-106b70d2484d";
const KOHLI_ID = "073a404c-adad-47b6-88ad-03cb8e3c48ef";
const KEYWORDS: Record<string, string> = (() => {
  try {
    if (process.env.AGENT_KEYWORDS) return JSON.parse(process.env.AGENT_KEYWORDS);
  } catch (err) {
    logger.error({ err }, "AGENT_KEYWORDS is not valid JSON; using defaults");
  }
  return { dbc: DBC_ID, "death by chocolate": DBC_ID, kohli: KOHLI_ID, goat: KOHLI_ID };
})();

// ---------- webhook endpoints ----------

// Meta calls this once when you save the webhook URL, to prove you own it.
router.get("/", (req, res) => {
  const q = req.query as Record<string, string>;
  if (q["hub.mode"] === "subscribe" && VERIFY_TOKEN && q["hub.verify_token"] === VERIFY_TOKEN) {
    return res.status(200).send(String(q["hub.challenge"] ?? ""));
  }
  res.sendStatus(403);
});

// Raw body so the HMAC signature can be checked against the exact bytes Meta sent.
router.post("/", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
  if (!validSignature(raw, req.headers["x-hub-signature-256"])) {
    logger.warn("meta webhook: bad or missing signature");
    return res.sendStatus(401);
  }
  // Ack immediately — Meta retries anything slower than a few seconds.
  res.sendStatus(200);
  let payload: any;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return;
  }
  handlePayload(payload).catch((err) => logger.error({ err }, "meta webhook handling error"));
});

function validSignature(raw: Buffer, header: unknown): boolean {
  if (APP_SECRETS.length === 0) return false; // fail closed until configured
  if (typeof header !== "string" || !header.startsWith("sha256=")) return false;
  const got = Buffer.from(header.slice(7), "hex");
  return APP_SECRETS.some((secret) => {
    const want = createHmac("sha256", secret).update(raw).digest();
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

async function handlePayload(p: any) {
  if (p?.object === "whatsapp_business_account") {
    for (const entry of p.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") continue;
        for (const m of change.value?.messages ?? []) await safe(() => onWhatsApp(m));
      }
    }
  } else if (p?.object === "instagram") {
    for (const entry of p.entry ?? []) {
      for (const ev of entry.messaging ?? []) await safe(() => onInstagramMessage(ev));
      for (const change of entry.changes ?? []) {
        if (change.field === "comments") await safe(() => onInstagramComment(change.value));
      }
    }
  }
}

async function safe(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (err) {
    logger.error({ err }, "meta agent event failed");
  }
}

// Meta may deliver the same event more than once; remember recent ids.
const seen = new Set<string>();
function firstTime(id: string | undefined): boolean {
  if (!id) return true;
  if (seen.has(id)) return false;
  seen.add(id);
  if (seen.size > 5000) seen.delete(seen.values().next().value as string);
  return true;
}

// ---------- polls ----------

type Opt = { id: string; label: string };

let pollCache: { at: number; rows: any[] } | null = null;
async function livePolls(): Promise<any[]> {
  if (pollCache && Date.now() - pollCache.at < 60_000) return pollCache.rows;
  const rows = (await db.select().from(topics).orderBy(desc(topics.createdAt)))
    .filter((r: any) => r.createdBy !== "system");
  const rank = (r: any) => {
    const i = FEATURED_TOPIC_IDS.indexOf(r.id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  rows.sort((a: any, b: any) => rank(a) - rank(b)); // stable: featured first, then newest
  pollCache = { at: Date.now(), rows: rows.slice(0, 10) };
  return pollCache.rows;
}

async function getPoll(id: string): Promise<any | null> {
  const [row] = await db.select().from(topics).where(eq(topics.id, id));
  return row && row.createdBy !== "system" ? row : null;
}

const link = (id: string) => `${SITE}/topic/${id}`;
const clip = (s: string, n: number) => (s.length <= n ? s : s.slice(0, n - 1) + "…");
const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

function resultsText(t: any): string {
  if (t.votingType === "yesno") {
    const total = (t.yesCount ?? 0) + (t.noCount ?? 0);
    return `Yes ${pct(t.yesCount, total)}% · No ${pct(t.noCount, total)}%  (${total} votes)`;
  }
  if (t.votingType === "choice") {
    const opts: Opt[] = (t.rankingOptions as Opt[]) ?? [];
    const counts = (t.rankingVotes ?? {}) as Record<string, number>;
    const total = opts.reduce((s, o) => s + (Number(counts[o.id]) || 0), 0);
    const lines = [...opts]
      .sort((a, b) => (Number(counts[b.id]) || 0) - (Number(counts[a.id]) || 0))
      .slice(0, 5)
      .map((o, i) => `${i + 1}. ${o.label} — ${pct(Number(counts[o.id]) || 0, total)}%`);
    return `${lines.join("\n")}\n(${total} votes)`;
  }
  return "";
}

function matchKeyword(text: string): string | null {
  const t = text.toLowerCase();
  for (const [k, id] of Object.entries(KEYWORDS)) {
    const re = new RegExp(`(^|[^a-z0-9])${k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
    if (re.test(t)) return id;
  }
  return null;
}

// ---------- WhatsApp ----------

async function waSend(to: string, payload: Record<string, unknown>) {
  if (!WA_TOKEN || !WA_PHONE_ID) return logger.warn("WhatsApp agent not configured (WA_TOKEN / WA_PHONE_NUMBER_ID)");
  const r = await fetch(`https://graph.facebook.com/${GRAPH}/${WA_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  if (!r.ok) logger.error({ status: r.status, body: await r.text() }, "WhatsApp send failed");
}

const waText = (to: string, body: string) =>
  waSend(to, { type: "text", text: { body: clip(body, 4000), preview_url: true } });

async function onWhatsApp(m: any) {
  if (!firstTime(m?.id)) return;
  const from = String(m.from ?? "");
  if (!from) return;
  // Votes are keyed by a hash of the phone number — the number itself is never stored.
  const voter = "wa_" + createHash("sha256").update(from).digest("hex").slice(0, 32);

  const action =
    m.type === "interactive" ? (m.interactive?.list_reply?.id ?? m.interactive?.button_reply?.id) :
    m.type === "button" ? m.button?.payload : null;
  if (action) return waAction(from, voter, String(action));

  if (m.type !== "text") return waText(from, "I can only read text for now 🙂 Reply *POLLS* to vote right here.");
  const text = String(m.text?.body ?? "").trim();
  if (!text || /^(hi+|hello|hey|hii+|polls?|vote|menu|start)\b/i.test(text)) return waMenu(from);
  const kw = matchKeyword(text);
  if (kw) return waPoll(from, kw);
  return waText(from, await aiReply("whatsapp", from, text));
}

async function waMenu(to: string) {
  const polls = await livePolls();
  if (!polls.length) return waText(to, `Welcome to Factinion 👋 See what people think at ${SITE}`);
  return waSend(to, {
    type: "interactive",
    interactive: {
      type: "list",
      body: { text: "Welcome to *Factinion* 👋\nPick a poll and vote right here — results update live." },
      footer: { text: "factinion.com" },
      action: {
        button: "See polls",
        sections: [{
          title: "Live polls",
          rows: polls.map((p) => ({ id: `t:${p.id}`, title: clip(p.title, 24), description: clip(p.title, 72) })),
        }],
      },
    },
  });
}

async function waPoll(to: string, topicId: string) {
  const t = await getPoll(topicId);
  if (!t) return waText(to, "That poll isn't available any more. Reply *POLLS* to see the live ones.");
  const body = clip(`*${t.title}*${t.description ? "\n\n" + t.description : ""}`, 1000);
  if (t.votingType === "yesno") {
    return waSend(to, {
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: body },
        action: { buttons: [
          { type: "reply", reply: { id: `y:${t.id}:yes`, title: "Yes" } },
          { type: "reply", reply: { id: `y:${t.id}:no`, title: "No" } },
        ] },
      },
    });
  }
  const opts: Opt[] = (t.rankingOptions as Opt[]) ?? [];
  if (t.votingType === "choice" && opts.length > 0 && opts.length <= 10) {
    return waSend(to, {
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: body },
        action: {
          button: "Choose",
          sections: [{ title: "Options", rows: opts.map((o, i) => ({ id: `c:${t.id}:${i}`, title: clip(o.label, 24) })) }],
        },
      },
    });
  }
  // Rating / ranking / aspects need the full screen.
  return waText(to, `*${t.title}*\n\nThis one needs the full screen — vote here 👇\n${link(t.id)}`);
}

async function waAction(to: string, voter: string, action: string) {
  if (action === "menu") return waMenu(to);
  const [kind, topicId, arg] = action.split(":");
  if (kind === "t" && topicId) return waPoll(to, topicId);

  let body: any = null;
  let picked = "";
  if (kind === "y" && (arg === "yes" || arg === "no")) {
    body = { kind: "yesno", value: arg };
    picked = arg === "yes" ? "Yes" : "No";
  } else if (kind === "c") {
    const t = await getPoll(topicId);
    const opt = ((t?.rankingOptions as Opt[]) ?? [])[Number(arg)];
    if (!opt) return waText(to, "That option isn't available any more. Reply *POLLS* to try again.");
    body = { kind: "choice", value: opt.id };
    picked = opt.label;
  }
  if (!body) return waMenu(to);

  const result: any = await applyVote(topicId, voter, body);
  // A 400 on a repeat tap of the same choice just means "already your pick".
  if (result?.error === 404) return waText(to, "That poll isn't available any more. Reply *POLLS* to see the live ones.");
  const t = await getPoll(topicId);
  if (!t) return;
  const head = result?.error ? `You already picked *${picked}* 👍` : `✅ Vote counted: *${picked}*`;
  return waSend(to, {
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: clip(`${head}\n\n*${t.title}*\n${resultsText(t)}\n\nComments & full results 👇\n${link(t.id)}`, 1024) },
      action: { buttons: [{ type: "reply", reply: { id: "menu", title: "More polls" } }] },
    },
  });
}

// ---------- Instagram ----------

async function igSend(recipient: Record<string, string>, text: string) {
  if (!IG_TOKEN) return logger.warn("Instagram agent not configured (IG_TOKEN)");
  const r = await fetch(`https://graph.instagram.com/${GRAPH}/${IG_USER_ID || "me"}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${IG_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient, message: { text: clip(text, 1000) } }),
  });
  if (!r.ok) logger.error({ status: r.status, body: await r.text() }, "Instagram send failed");
}

async function igReplyToComment(commentId: string, message: string) {
  if (!IG_TOKEN) return;
  const r = await fetch(`https://graph.instagram.com/${GRAPH}/${commentId}/replies`, {
    method: "POST",
    headers: { Authorization: `Bearer ${IG_TOKEN}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ message }).toString(),
  });
  if (!r.ok) logger.error({ status: r.status, body: await r.text() }, "Instagram comment reply failed");
}

// Someone commented on a post: if it has a keyword (or asks for the link), DM them
// the poll link — Instagram allows one private reply per comment, within 7 days.
async function onInstagramComment(v: any) {
  const commentId = v?.id;
  if (!commentId || !firstTime("igc:" + commentId)) return;
  // Never answer our own comments (incl. the "check your DMs" reply below, which
  // contains the trigger word "link") — matched by id, username and exact text.
  if (IG_USER_ID && v.from?.id === IG_USER_ID) return;
  if (IG_USERNAME && String(v.from?.username ?? "").toLowerCase() === IG_USERNAME) return;
  const text = String(v.text ?? "");
  if (text.trim() === IG_DM_NOTICE) return;
  const topicId = matchKeyword(text);
  if (!topicId && !/\b(link|vote|poll)\b/i.test(text)) return;
  const url = topicId ? link(topicId) : SITE;
  await igSend({ comment_id: commentId }, `Here's your link to vote 👇\n${url}\n\nOne tap, no sign-up — results update live!`);
  await igReplyToComment(commentId, IG_DM_NOTICE);
}

async function onInstagramMessage(ev: any) {
  const msg = ev?.message;
  if (!msg || msg.is_echo || !firstTime("igm:" + msg.mid)) return;
  const sender = ev.sender?.id;
  if (!sender || sender === IG_USER_ID) return;
  const text = String(msg.text ?? "").trim();
  if (!text) return igSend({ id: sender }, `Thanks! 🙌 Vote on today's live polls at ${SITE}`);
  const kw = matchKeyword(text);
  if (kw) return igSend({ id: sender }, `Vote here 👇\n${link(kw)}\n\nOne tap, no sign-up.`);
  return igSend({ id: sender }, await aiReply("instagram", sender, text));
}

// ---------- AI replies ----------

type Turn = { role: "user" | "assistant"; content: string };
const history = new Map<string, Turn[]>();
const usage = new Map<string, { day: string; n: number }>();
const DAILY_AI_LIMIT = 25;

async function aiReply(channel: "whatsapp" | "instagram", userKey: string, text: string): Promise<string> {
  const fallback = channel === "whatsapp"
    ? `Thanks for the message! 🙌 Reply *POLLS* to vote right here, or see everything at ${SITE}`
    : `Thanks for the message! 🙌 Vote on today's live polls at ${SITE}`;
  if (!ANTHROPIC_KEY) return fallback;

  const key = `${channel}:${userKey}`;
  const day = new Date().toISOString().slice(0, 10);
  const u = usage.get(key);
  const n = u && u.day === day ? u.n : 0;
  if (n >= DAILY_AI_LIMIT) return fallback;
  usage.set(key, { day, n: n + 1 });

  const polls = await livePolls();
  const pollLines = polls
    .map((p) => `- "${p.title}" — ${link(p.id)}${resultsText(p) ? " — now: " + resultsText(p).replace(/\n/g, "; ") : ""}`)
    .join("\n");
  const system = [
    `You are the assistant for Factinion (${SITE}), a polling app where people vote on everyday debates and see live results. Voting on the website takes one tap with no sign-up. The Android app is on Google Play: ${PLAY_URL}`,
    `You are chatting with someone on ${channel === "whatsapp" ? "WhatsApp" : "Instagram DMs"}.${channel === "whatsapp" ? " They can reply POLLS to vote inside WhatsApp." : ""}`,
    "Rules: reply in 1-3 short sentences of plain text (no markdown), at most one emoji. Reply in the user's language (English, Hindi, Kannada, Hinglish are all fine). Be warm and helpful; where it fits, share the single most relevant poll link. Only state facts given here — if you don't know, say so and point to the website. Never pretend to be a human; if asked, you're Factinion's assistant. Don't give your own opinion on the poll questions or on politics. If someone reports a problem, abuse, or asks about their data, or wants a person, say the founder will reply here personally.",
    `Live polls:\n${pollLines || "(none right now)"}`,
  ].join("\n\n");

  const turns = [...(history.get(key) ?? []), { role: "user" as const, content: clip(text, 1500) }];
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 300, system, messages: turns }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) {
      logger.error({ status: r.status, body: await r.text() }, "agent AI call failed");
      return fallback;
    }
    const j: any = await r.json();
    const answer = String((j.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("")).trim();
    if (!answer) return fallback;
    history.set(key, [...turns, { role: "assistant" as const, content: answer }].slice(-8));
    if (history.size > 1000) history.delete(history.keys().next().value as string);
    if (/founder will reply/i.test(answer)) logger.info({ channel, userKey, text }, "agent: conversation needs a human");
    return answer;
  } catch (err) {
    logger.error({ err }, "agent AI call error");
    return fallback;
  }
}

export default router;
