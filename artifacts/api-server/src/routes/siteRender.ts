// The marketing/results site shares the app's vote-colour language (green yes,
// red no, gold stars) and logo, but carries its own elevated "opinion newsroom"
// identity: a deep-navy canvas with gradient depth and a cyan accent.
const C = {
  bg: "#070a14",
  bg2: "#0b1020",
  card: "#0f1524",
  cardHi: "#131b2e",
  border: "#1e2740",
  muted: "#182036",
  fg: "#eef1f7",
  dim: "#8b95ad",
  primary: "#3b82f6",
  accent: "#22d3ee",
  accent2: "#818cf8",
  yes: "#00d68f",
  no: "#ff4d5e",
  star: "#ffd400",
};

const PLAY_URL = "https://play.google.com/store/apps/details?id=app.askopinion";

// Web sign-in uses the same Clerk production instance as the app, so a person has
// one identity across web and app. The publishable key is public by design; it
// only works on factinion.com (production keys refuse other origins).
const CLERK_PK = "pk_live_Y2xlcmsuZmFjdGluaW9uLmNvbSQ";
const CLERK_JS = "https://clerk.factinion.com/npm/@clerk/clerk-js@latest/dist/clerk.browser.js";
// Clerk's hosted Account Portal sign-in — robust across browsers, unlike the
// embedded modal. We redirect here and come back to the same page after sign-in.
const ACCOUNTS_SIGNIN = "https://accounts.factinion.com/sign-in";

const CATEGORY_CONFIG: Record<string, { label: string; color: string }> = {
  food: { label: "Food", color: "#f97316" },
  tech: { label: "Tech", color: "#3b82f6" },
  movies: { label: "Movies", color: "#ec4899" },
  music: { label: "Music", color: "#8b5cf6" },
  sports: { label: "Sports", color: "#22c55e" },
  politics: { label: "Politics", color: "#ef4444" },
  gaming: { label: "Gaming", color: "#eab308" },
  science: { label: "Science", color: "#06b6d4" },
  lifestyle: { label: "Lifestyle", color: "#f59e0b" },
  travel: { label: "Travel", color: "#14b8a6" },
  automobiles: { label: "Autos", color: "#f43f5e" },
  other: { label: "Other", color: "#94a3b8" },
};

const TYPE_LABEL: Record<string, string> = {
  yesno: "Yes / No",
  rating: "Rating",
  ranking: "Ranking",
  aspects: "Aspects",
  choice: "Multiple choice",
};

// Everything below renders user-authored text, so nothing reaches the page
// without going through this.
function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export type AspectVotes = Record<string, { up: number; down: number }>;
export type RankingVotes = Record<string, number[]>;
export type RankingOption = { id: string; label: string };
export type DemoBreakdown = Record<string, Record<string, number>>;

export interface SiteComment {
  authorName: string | null;
  text: string;
  createdAt: number;
}

export interface SiteTopic {
  id: string;
  topicNumber: number | null;
  title: string;
  description: string | null;
  category: string;
  votingType: string;
  rankingOptions: RankingOption[] | null;
  aspects: string[] | null;
  hashtags: string[] | null;
  createdByName: string | null;
  voiceType: string | null;
  createdAt: number;
  yesCount: number;
  noCount: number;
  totalRating: number;
  ratingCount: number;
  rankingVotes: RankingVotes;
  aspectVotes: AspectVotes;
  demoBreakdown: DemoBreakdown;
  commentCount: number;
  latestComment: { authorName: string | null; text: string } | null;
}

// How many people took part, counted only through the topic's own voting type —
// the same counter the app reads for that type.
// Single-select poll tallies share the rankingVotes column, stored as
// { optionId: count } instead of ranking's { optionId: positions[] }.
function choiceCounts(t: SiteTopic): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries((t.rankingVotes as any) ?? {})) out[k] = Number(v) || 0;
  return out;
}

function participation(t: SiteTopic): number {
  if (t.votingType === "yesno") return t.yesCount + t.noCount;
  if (t.votingType === "rating") return t.ratingCount;
  if (t.votingType === "choice") {
    return Object.values(choiceCounts(t)).reduce((a, b) => a + b, 0);
  }
  if (t.votingType === "ranking") {
    return Math.max(0, ...Object.values(t.rankingVotes).map((v) => v.length));
  }
  return Math.max(0, ...Object.values(t.aspectVotes).map((v) => v.up + v.down));
}

function avgRank(t: SiteTopic, optionId: string): number | null {
  const votes = t.rankingVotes[optionId];
  if (!votes || votes.length === 0) return null;
  return votes.reduce((a, b) => a + b, 0) / votes.length;
}

/* ---------------------------------------------------------------- rendering */

function bar(percent: number, color: string, track: string, height = 8): string {
  return `<div class="track" style="--track:${track};--h:${height}px">
    <div class="fill" style="--w:${percent}%;--c:${color}"></div>
  </div>`;
}

function renderYesNo(t: SiteTopic): string {
  const total = t.yesCount + t.noCount;
  if (total === 0) return `<p class="novotes">No votes yet — be the first.</p>`;
  const yes = Math.round((t.yesCount / total) * 100);
  return `<div class="verdict">
    <div class="big" style="--c:${yes >= 50 ? C.yes : C.no}">${yes}<span>%</span></div>
    <div class="verdict-label">said <strong>yes</strong><br><span class="dim">${fmt(total)} votes</span></div>
  </div>
  ${bar(yes, C.yes, C.no, 10)}
  <div class="legend">
    <span><i style="background:${C.yes}"></i>Yes ${fmt(t.yesCount)}</span>
    <span><i style="background:${C.no}"></i>No ${fmt(t.noCount)}</span>
  </div>`;
}

function renderRating(t: SiteTopic): string {
  if (t.ratingCount === 0) return `<p class="novotes">No ratings yet.</p>`;
  const avg = t.totalRating / t.ratingCount;
  return `<div class="verdict">
    <div class="big" style="--c:${C.star}">${avg.toFixed(1)}</div>
    <div class="verdict-label">
      <span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fg" style="--w:${(avg / 5) * 100}%">★★★★★</span></span>
      <br><span class="dim">${fmt(t.ratingCount)} ratings</span>
    </div>
  </div>`;
}

function renderRanking(t: SiteTopic): string {
  const options = t.rankingOptions ?? [];
  const ranked = options
    .map((o) => ({ ...o, avg: avgRank(t, o.id) }))
    .filter((o) => o.avg !== null)
    .sort((a, b) => (a.avg as number) - (b.avg as number));
  if (ranked.length === 0) return `<p class="novotes">No rankings yet.</p>`;

  const worst = Math.max(...ranked.map((o) => o.avg as number));
  return `<ol class="ranks">${ranked
    .map((o, i) => {
      // Best average rank fills the bar; the bar shrinks as the average worsens.
      const width = worst > 1 ? 100 - (((o.avg as number) - 1) / worst) * 70 : 100;
      return `<li>
        <span class="rank-pos${i === 0 ? " rank-top" : ""}">${i + 1}</span>
        <span class="rank-body">
          <span class="rank-label">${esc(o.label)}</span>
          ${bar(width, i === 0 ? C.accent : "#3a5f78", C.muted, 6)}
        </span>
        <span class="rank-avg">${(o.avg as number).toFixed(1)}</span>
      </li>`;
    })
    .join("")}</ol>
  <p class="hint">Average position across ${fmt(participation(t))} ballots — lower is better.</p>`;
}

function renderAspects(t: SiteTopic): string {
  const aspects = t.aspects ?? [];
  if (aspects.length === 0) return `<p class="novotes">No aspects yet.</p>`;
  const rows = aspects.map((a) => {
    const v = t.aspectVotes[a] ?? { up: 0, down: 0 };
    const total = v.up + v.down;
    const up = total > 0 ? Math.round((v.up / total) * 100) : null;
    return `<li>
      <span class="aspect-label">${esc(a)}</span>
      ${up === null ? `<span class="aspect-none">—</span>` : bar(up, C.yes, C.no, 6)}
      <span class="aspect-pct"${up === null ? "" : ` style="color:${up >= 50 ? C.yes : C.no}"`}>${up === null ? "" : up + "%"}</span>
    </li>`;
  });
  return `<ul class="aspects">${rows.join("")}</ul>`;
}

function renderChoice(t: SiteTopic): string {
  const options = t.rankingOptions ?? [];
  const counts = choiceCounts(t);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return `<p class="novotes">No votes yet — be the first.</p>`;
  const rows = options
    .map((o) => ({ ...o, n: counts[o.id] ?? 0 }))
    .sort((a, b) => b.n - a.n);
  const top = rows[0]?.n ?? 0;
  return `<ul class="choices">${rows
    .map((o) => {
      const pct = total > 0 ? Math.round((o.n / total) * 100) : 0;
      const lead = o.n === top && o.n > 0;
      return `<li class="choice-row${lead ? " choice-lead" : ""}">
        <span class="choice-label">${esc(o.label)}</span>
        ${bar(pct, lead ? C.accent : "#3a5f78", C.muted, 7)}
        <span class="choice-pct">${pct}%</span>
      </li>`;
    })
    .join("")}</ul>
  <p class="hint">${fmt(total)} ${total === 1 ? "vote" : "votes"}</p>`;
}

function vizFor(t: SiteTopic): string {
  return t.votingType === "yesno"
    ? renderYesNo(t)
    : t.votingType === "rating"
      ? renderRating(t)
      : t.votingType === "ranking"
        ? renderRanking(t)
        : t.votingType === "choice"
          ? renderChoice(t)
          : renderAspects(t);
}

// Open demographic breakdown for a single topic (used on the analysis page).
function renderDemoPanel(t: SiteTopic): string {
  const fields = Object.entries(t.demoBreakdown ?? {}).filter(([, buckets]) =>
    Object.values(buckets ?? {}).some((n) => n > 0),
  );
  if (fields.length === 0) return "";
  const FIELD_LABEL: Record<string, string> = {
    ageRange: "Age",
    gender: "Gender",
    country: "Country",
    occupation: "Work",
  };
  return `<div class="demogrid">${fields
    .map(([field, buckets]) => {
      const entries = Object.entries(buckets)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((sum, [, n]) => sum + n, 0);
      return `<div class="demobox">
        <h3>${esc(FIELD_LABEL[field] ?? field)}</h3>
        ${entries
          .map(([bucket, n]) => {
            const pct = Math.round((n / total) * 100);
            return `<div class="demo-row">
              <span class="demo-bucket">${esc(bucket)}</span>
              ${bar(pct, C.primary, C.muted, 6)}
              <span class="demo-n">${pct}%</span>
            </div>`;
          })
          .join("")}
      </div>`;
    })
    .join("")}</div>`;
}

// Interactive one-tap vote widget for the topic page. Controls carry data-*
// attributes; the client script (in shell) POSTs the vote and re-renders results
// from the server. Results (vizFor) are always shown beneath the controls.
function renderVoteWidget(t: SiteTopic): string {
  let controls = "";
  if (t.votingType === "yesno") {
    controls = `<div class="vote-controls yn-controls">
      <button class="vbtn vbtn-yes" data-value="yes" type="button">Yes</button>
      <button class="vbtn vbtn-no" data-value="no" type="button">No</button>
    </div>`;
  } else if (t.votingType === "rating") {
    controls = `<div class="vote-controls rate-controls" aria-label="Rate 1 to 5">
      ${[1, 2, 3, 4, 5]
        .map((n) => `<button class="rbtn" data-value="${n}" type="button" aria-label="${n} star">★</button>`)
        .join("")}
    </div>`;
  } else if (t.votingType === "aspects") {
    const aspects = t.aspects ?? [];
    controls = `<div class="vote-controls aspect-vcontrols">
      ${aspects
        .map(
          (a) => `<div class="aspect-vrow">
        <span class="aspect-vlabel">${esc(a)}</span>
        <span class="aspect-vbtns">
          <button class="abtn abtn-up" data-aspect="${esc(a)}" data-choice="up" type="button">👍</button>
          <button class="abtn abtn-down" data-aspect="${esc(a)}" data-choice="down" type="button">👎</button>
        </span>
      </div>`,
        )
        .join("")}
    </div>`;
  } else if (t.votingType === "choice") {
    const opts = t.rankingOptions ?? [];
    controls = `<div class="vote-controls choice-controls">
      ${opts
        .map((o) => `<button class="cbtn" data-opt="${esc(o.id)}" type="button">${esc(o.label)}</button>`)
        .join("")}
    </div>`;
  } else if (t.votingType === "ranking") {
    const opts = t.rankingOptions ?? [];
    controls = `<div class="vote-controls rank-vcontrols">
      <p class="rank-vhint">Tap the options in your order — best first.</p>
      <div class="rank-opts">
        ${opts
          .map(
            (o) => `<button class="ropt" data-opt="${esc(o.id)}" type="button"><b class="ropt-num"></b><span>${esc(o.label)}</span></button>`,
          )
          .join("")}
      </div>
      <div class="rank-actions">
        <button class="rank-reset" type="button">Reset</button>
        <button class="rank-send" type="button" disabled>Submit ranking</button>
      </div>
    </div>`;
  }
  return `<div class="vote-panel panel" data-topic="${esc(t.id)}" data-kind="${esc(t.votingType)}">
    ${controls}
    <div class="vote-status" aria-live="polite"></div>
    <div class="vote-results">${vizFor(t)}</div>
  </div>`;
}

const VOICE_LABELS: Record<string, string> = {
  expert: "Expert", brand: "Brand", public: "Public figure", creator: "Creator",
};

// Twitter-style author chip: circular avatar (initial) + name + verified check.
// voiceType is set on topics created by a verified account.
function renderAuthor(name: string | null, voiceType: string | null, size: "sm" | "lg" = "sm"): string {
  const display = (name ?? "Factinion").trim() || "Factinion";
  const initial = display.charAt(0).toUpperCase();
  const check = voiceType
    ? `<span class="author-check" title="${esc(VOICE_LABELS[voiceType] ?? "Verified")}">&#10003;</span>`
    : "";
  return `<span class="author author-${size}">` +
    `<span class="author-av">${esc(initial)}</span>` +
    `<span class="author-name">${esc(display)}${check}</span>` +
    `</span>`;
}

function renderCard(t: SiteTopic, index: number, featured = false): string {
  const cat = CATEGORY_CONFIG[t.category] ?? CATEGORY_CONFIG.other;
  const viz = vizFor(t);
  const meta = `${fmt(participation(t))} ${participation(t) === 1 ? "vote" : "votes"} · ${
    t.commentCount === 1 ? "1 comment" : fmt(t.commentCount) + " comments"
  }`;

  const kicker = featured
    ? `<span class="feat">◆ Most active</span>`
    : t.topicNumber
      ? `<span class="num">#${t.topicNumber}</span>`
      : "";

  const head = `<header class="card-top">
      <span class="cat" style="--c:${cat.color}"><i></i>${esc(cat.label)}</span>
      <span class="type">${esc(TYPE_LABEL[t.votingType] ?? t.votingType)}</span>
      ${kicker}
    </header>`;
  const authorLine = `<div class="card-author">${renderAuthor(t.createdByName, t.voiceType, "sm")}</div>`;
  const title = `<h3>${esc(t.title)}</h3>`;
  const desc = t.description ? `<p class="desc">${esc(t.description)}</p>` : "";
  const foot = `<footer class="card-foot">
      <span class="foot-meta">${meta}</span>
      <span class="readmore">See the breakdown <b>&rarr;</b></span>
    </footer>`;

  const attrs = `href="/topic/${esc(t.id)}" data-cat="${esc(t.category)}" style="--i:${index};--c:${cat.color}"`;

  if (featured) {
    return `<a class="card feature" ${attrs}>
      <div class="card-main">${head}${authorLine}${title}${desc}${foot}</div>
      <div class="card-viz">${viz}</div>
    </a>`;
  }
  return `<a class="card" ${attrs}>${head}${authorLine}${title}${desc}<div class="viz">${viz}</div>${foot}</a>`;
}

function renderLive(list: SiteTopic[], featuredIds: string[] = []): string {
  const totalVotes = list.reduce((sum, t) => sum + participation(t), 0);
  const totalComments = list.reduce((sum, t) => sum + t.commentCount, 0);
  const yesno = list.filter((t) => t.votingType === "yesno");
  const yes = yesno.reduce((s, t) => s + t.yesCount, 0);
  const no = yesno.reduce((s, t) => s + t.noCount, 0);
  const consensus = yes + no > 0 ? Math.round((yes / (yes + no)) * 100) : null;

  const stats = `<div class="stats">
    <div class="stat"><span class="stat-n">${fmt(totalVotes)}</span><span class="stat-l">votes cast</span></div>
    <div class="stat"><span class="stat-n">${fmt(list.length)}</span><span class="stat-l">live questions</span></div>
    <div class="stat"><span class="stat-n">${fmt(totalComments)}</span><span class="stat-l">comments</span></div>
  </div>`;

  const meter =
    consensus === null
      ? ""
      : `<div class="consensus">
          <div class="consensus-head">
            <span>Across every yes / no question so far</span>
            <strong style="color:${consensus >= 50 ? C.yes : C.no}">${consensus}% say yes</strong>
          </div>
          ${bar(consensus, C.yes, C.no, 12)}
        </div>`;

  // Split into the promoted "LIVE" polls and everything else ("Other opinions").
  const fset = new Set(featuredIds);
  const live = featuredIds.map((id) => list.find((t) => t.id === id)).filter(Boolean) as SiteTopic[];
  const others = list.filter((t) => !fset.has(t.id));

  let body: string;
  if (live.length) {
    const liveCards =
      renderCard(live[0], 0, true) + live.slice(1).map((t, i) => renderCard(t, i + 1)).join("");
    const liveSection = `<div class="section-head section-live"><span class="live-dot"><i></i></span>Live now</div>
      <div class="grid">${liveCards}</div>`;
    const othersSection = others.length
      ? `<div class="section-head">Other opinions</div>
         <div class="grid">${others.map((t, i) => renderCard(t, i)).join("")}</div>`
      : "";
    body = liveSection + othersSection;
  } else {
    // No promoted polls: one feed, busiest as the lead story when deep enough.
    let featured: SiteTopic | null = null;
    let rest = list;
    if (list.length >= 3) {
      featured = [...list].sort((a, b) => participation(b) - participation(a))[0];
      rest = list.filter((t) => t.id !== featured!.id);
    }
    const cards = list.length
      ? (featured ? renderCard(featured, 0, true) : "") + rest.map((t, i) => renderCard(t, i + 1)).join("")
      : `<p class="novotes">No questions yet.</p>`;
    body = `<div class="grid">${cards}</div>`;
  }

  return `${stats}${meter}${body}`;
}

interface ShellOptions {
  title: string;
  description: string;
  path: string; // also the URL the live refresh re-fetches
  hero: string;
  heroClass?: string;
  body: string;
}

function shell(o: ShellOptions): string {
  const resultsOn = o.path === "/" || o.path.startsWith("/topic");
  const insightsOn = o.path === "/insights";
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<meta name="theme-color" content="#070a14">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://factinion.com${esc(o.path)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%23070a14'/%3E%3Cpath d='M50 8 A42 42 0 0 1 50 92 A21 21 0 0 1 50 50 A21 21 0 0 0 50 8 Z' fill='%2300d68f'/%3E%3Cpath d='M50 8 A42 42 0 0 0 50 92 A21 21 0 0 0 50 50 A21 21 0 0 1 50 8 Z' fill='%23ff4d5e'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<script async crossorigin="anonymous" data-clerk-publishable-key="${CLERK_PK}" src="${CLERK_JS}" type="text/javascript"></script>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --bg: ${C.bg}; --bg2: ${C.bg2}; --card: ${C.card}; --cardHi: ${C.cardHi};
    --border: ${C.border}; --muted: ${C.muted}; --fg: ${C.fg}; --dim: ${C.dim};
    --primary: ${C.primary}; --accent: ${C.accent}; --accent2: ${C.accent2};
    --yes: ${C.yes}; --no: ${C.no}; --star: ${C.star};
  }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5; -webkit-font-smoothing: antialiased;
  }
  /* Ambient gradient depth, Orchid-style — fixed so it never scrolls. */
  body::before {
    content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background:
      radial-gradient(58% 44% at 12% -6%, rgba(129,140,248,.12), transparent 60%),
      radial-gradient(50% 40% at 96% -2%, rgba(34,211,238,.10), transparent 58%),
      linear-gradient(180deg, var(--bg2), var(--bg) 40%);
  }
  h1, h2, h3, .big, .stat-n, .callout-value, .brand, .pick-winner {
    font-family: "Space Grotesk", "Inter", sans-serif;
  }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }
  a { color: inherit; }

  /* header */
  .top {
    position: sticky; top: 0; z-index: 10;
    background: rgba(7,10,20,.72); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .top .wrap { display: flex; align-items: center; gap: 12px; height: 62px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; font-size: 19px; letter-spacing: -.4px; text-decoration: none; }
  .top nav { margin-left: auto; display: flex; align-items: center; gap: 18px; }
  .top nav a { color: var(--dim); text-decoration: none; font-size: 14px; }
  .top nav a:hover { color: var(--fg); }
  .top nav a.on { color: var(--fg); font-weight: 600; }
  .nav-cta {
    background: color-mix(in srgb, var(--accent) 16%, transparent);
    color: var(--accent) !important; border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
    border-radius: 100px; padding: 7px 14px; font-weight: 600;
  }
  .nav-cta:hover { background: color-mix(in srgb, var(--accent) 26%, transparent); }
  .authslot { display: inline-flex; align-items: center; }
  .signin-btn {
    font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
    background: transparent; color: var(--fg); border: 1px solid var(--border);
    border-radius: 100px; padding: 7px 16px; transition: border-color .2s;
  }
  .signin-btn:hover { border-color: var(--dim); }
  .userchip { position: relative; display: inline-flex; align-items: center; }
  .avatar-btn {
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
    width: 36px; height: 36px; border-radius: 50%; padding: 0; overflow: hidden;
    background: linear-gradient(150deg, var(--accent), var(--accent2)); color: #04121a;
    border: 1px solid var(--border); font: inherit; font-weight: 800; font-size: 15px;
  }
  .avatar-btn img { width: 100%; height: 100%; object-fit: cover; }
  .avatar-btn:hover { filter: brightness(1.08); }
  .profile-card {
    position: absolute; top: 46px; right: 0; width: 280px; z-index: 60;
    background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    box-shadow: 0 20px 50px rgba(0,0,0,.5); padding: 18px; display: none;
  }
  .profile-card.open { display: block; }
  .pc-head { display: flex; align-items: center; gap: 12px; }
  .pc-av {
    width: 46px; height: 46px; border-radius: 50%; flex: none; overflow: hidden;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(150deg, var(--accent), var(--accent2)); color: #04121a; font-weight: 800; font-size: 18px;
  }
  .pc-av img { width: 100%; height: 100%; object-fit: cover; }
  .pc-id { min-width: 0; }
  .pc-name { font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pc-email { font-size: 12.5px; color: var(--dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pc-badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .pc-badge { font-size: 11px; font-weight: 700; letter-spacing: .3px; border-radius: 100px; padding: 4px 10px; }
  .pc-badge.verified { color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent); }
  .pc-badge.premium { color: var(--gold, #ffc33a); background: color-mix(in srgb, #ffc33a 15%, transparent); border: 1px solid color-mix(in srgb, #ffc33a 36%, transparent); }
  .pc-stats { display: flex; margin: 14px 0; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .pc-stat { flex: 1; text-align: center; padding: 10px 4px; border-right: 1px solid var(--border); }
  .pc-stat:last-child { border-right: none; }
  .pc-stat b { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 18px; }
  .pc-stat span { font-size: 10.5px; color: var(--dim); text-transform: uppercase; letter-spacing: .4px; }
  .pc-signout { width: 100%; font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; background: transparent; color: var(--fg); border: 1px solid var(--border); border-radius: 100px; padding: 9px; }
  .pc-signout:hover { border-color: var(--dim); }

  /* author chip (Twitter-style) */
  .author { display: inline-flex; align-items: center; gap: 9px; min-width: 0; }
  .author-av {
    flex: none; display: inline-flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 50%; font-weight: 800; font-size: 13px;
    color: #04121a; background: linear-gradient(150deg, var(--accent), var(--accent2));
  }
  .author-name {
    display: inline-flex; align-items: center; gap: 5px; min-width: 0;
    font-size: 13.5px; font-weight: 600; color: var(--fg);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .author-check {
    flex: none; display: inline-flex; align-items: center; justify-content: center;
    width: 16px; height: 16px; border-radius: 50%; font-size: 10px; font-weight: 900;
    color: #04121a; background: var(--accent);
  }
  .author-lg .author-av { width: 44px; height: 44px; font-size: 19px; }
  .author-lg .author-name { font-size: 16px; }
  .card-author { margin: 10px 0 12px; }
  .topic-author { margin: 16px 0 6px; }

  /* homepage sections */
  .section-head { display: flex; align-items: center; gap: 9px; margin: 34px 0 16px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; letter-spacing: -.3px; color: var(--fg); }
  .section-head:first-child { margin-top: 6px; }
  .section-live { color: var(--accent); text-transform: uppercase; letter-spacing: 1.5px; font-size: 16px; }

  /* create poll form */
  .create-form { max-width: 680px; }
  .cf-signedout { display: none; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 18px; margin-bottom: 20px; font-size: 14px; color: var(--dim); }
  .cf-signedout.show { display: flex; }
  .cf-signin { font: inherit; font-weight: 600; cursor: pointer; background: linear-gradient(96deg, var(--accent), var(--primary)); color: #04121a; border: none; border-radius: 100px; padding: 8px 18px; }
  .cf-fields { display: grid; gap: 18px; }
  .cf-label { display: block; font-family: 'Space Grotesk', sans-serif; font-weight: 600; font-size: 14px; color: var(--fg); }
  .cf-opt { color: var(--dim); font-weight: 400; }
  .cf-title, .cf-desc, .cf-cat, .cf-tags, .cf-opt-input { width: 100%; margin-top: 8px; font: inherit; font-size: 15px; color: var(--fg); background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; box-sizing: border-box; }
  .cf-desc { resize: vertical; }
  .cf-title:focus, .cf-desc:focus, .cf-cat:focus, .cf-tags:focus, .cf-opt-input:focus { outline: none; border-color: var(--accent); }
  .cf-types { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 8px; }
  .cf-type { text-align: left; cursor: pointer; font: inherit; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; color: var(--fg); display: flex; flex-direction: column; gap: 2px; }
  .cf-type b { font-family: 'Space Grotesk', sans-serif; font-size: 14px; }
  .cf-type span { font-size: 12px; color: var(--dim); }
  .cf-type.on { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 10%, var(--card)); }
  .cf-opt-list { display: grid; gap: 8px; margin-top: 8px; }
  .cf-opt-row { display: flex; gap: 8px; }
  .cf-opt-row .cf-opt-input { margin-top: 0; }
  .cf-opt-del { flex: none; cursor: pointer; font: inherit; background: transparent; border: 1px solid var(--border); color: var(--dim); border-radius: 10px; padding: 0 13px; }
  .cf-add { margin-top: 10px; cursor: pointer; font: inherit; font-weight: 600; font-size: 13px; background: transparent; border: 1px dashed var(--border); color: var(--accent); border-radius: 10px; padding: 8px 14px; }
  .cf-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .cf-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 6px; }
  .cf-hint { font-size: 13px; color: var(--dim); }
  .cf-submit { font: inherit; font-weight: 700; font-size: 15px; cursor: pointer; background: linear-gradient(96deg, var(--accent), var(--primary)); color: #04121a; border: none; border-radius: 100px; padding: 12px 26px; }
  .cf-submit:disabled { opacity: .5; cursor: not-allowed; }
  @media (max-width: 560px) { .cf-row { grid-template-columns: 1fr; } }
  .live-dot { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--accent); letter-spacing: .4px; }
  .live-dot i { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 8px var(--accent); animation: pulse 2.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .3; transform: scale(.75); } }

  /* hero */
  .hero { padding: 76px 0 20px; text-align: center; position: relative; }
  .hero h1 { font-size: clamp(36px, 6.4vw, 64px); line-height: 1.03; letter-spacing: -2px; margin: 18px 0 0; font-weight: 700; }
  .hero h1 .grad { background: linear-gradient(96deg, var(--accent), var(--accent2) 60%, var(--primary)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero p { color: var(--dim); font-size: 17px; max-width: 540px; margin: 18px auto 0; }
  .eyebrow {
    display: inline-flex; align-items: center; gap: 8px;
    color: var(--accent); font-weight: 600; font-size: 13px; letter-spacing: .3px;
    background: color-mix(in srgb, var(--accent) 12%, transparent);
    border: 1px solid color-mix(in srgb, var(--accent) 30%, transparent);
    border-radius: 100px; padding: 6px 14px;
  }
  .cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 30px; }
  .cta {
    text-decoration: none; font-weight: 600; font-size: 15px; padding: 13px 24px;
    border-radius: 100px; transition: transform .15s, box-shadow .2s, border-color .2s;
    display: inline-flex; align-items: center; gap: 8px;
  }
  .cta-primary {
    background: linear-gradient(96deg, var(--accent), var(--primary));
    color: #04121a; box-shadow: 0 10px 34px -10px color-mix(in srgb, var(--accent) 65%, transparent);
  }
  .cta-primary:hover { transform: translateY(-2px); }
  .cta-ghost { color: var(--fg); border: 1px solid var(--border); }
  .cta-ghost:hover { border-color: var(--dim); }

  /* stats */
  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 36px 0 16px; }
  .stat {
    flex: 1 1 160px; background: linear-gradient(180deg, var(--cardHi), var(--card));
    border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px;
  }
  .stat-n { display: block; font-size: 32px; font-weight: 700; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
  .stat-l { display: block; color: var(--dim); font-size: 13px; margin-top: 2px; }

  /* consensus meter */
  .consensus { background: linear-gradient(180deg, var(--cardHi), var(--card)); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; margin-bottom: 32px; }
  .consensus-head { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .consensus-head span { color: var(--dim); font-size: 14px; }
  .consensus-head strong { font-size: 17px; font-variant-numeric: tabular-nums; }

  /* filter chips */
  .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 22px; }
  .chip {
    font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    background: transparent; color: var(--dim);
    border: 1px solid var(--border); border-radius: 100px; padding: 7px 14px;
  }
  .chip:hover { color: var(--fg); border-color: var(--dim); }
  .chip.on { background: var(--c, var(--accent)); border-color: var(--c, var(--accent)); color: #04121a; }

  /* cards / news blocks */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .card {
    position: relative; display: flex; flex-direction: column; overflow: hidden;
    background: linear-gradient(180deg, var(--cardHi), var(--card));
    border: 1px solid var(--border); border-radius: 18px; padding: 22px;
    text-decoration: none; color: inherit;
    transition: border-color .2s, transform .2s, box-shadow .2s;
  }
  .card::before {
    content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, transparent, var(--c, var(--accent)), transparent);
    opacity: 0; transition: opacity .2s;
  }
  .card:hover {
    transform: translateY(-3px);
    border-color: color-mix(in srgb, var(--c, var(--accent)) 55%, var(--border));
    box-shadow: 0 16px 44px -22px rgba(0,0,0,.9);
  }
  .card:hover::before { opacity: .75; }
  .card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .cat {
    display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700;
    color: var(--c); background: color-mix(in srgb, var(--c) 16%, transparent);
    border-radius: 100px; padding: 4px 10px;
  }
  .cat i { width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
  .type { font-size: 11.5px; color: var(--dim); background: var(--muted); border-radius: 100px; padding: 4px 10px; }
  .num { margin-left: auto; font-size: 11.5px; color: var(--dim); font-weight: 700; }
  .feat { margin-left: auto; font-size: 11px; font-weight: 700; letter-spacing: .3px; color: var(--accent); }
  .card h3 { margin: 0 0 6px; font-size: 19px; font-weight: 600; letter-spacing: -.5px; line-height: 1.24; }
  .desc { margin: 0 0 4px; color: var(--dim); font-size: 13.5px; }
  .viz { margin-top: 16px; }
  .card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border);
    font-size: 12px; color: var(--dim);
  }
  .foot-meta { font-variant-numeric: tabular-nums; }
  .readmore { color: var(--accent); font-weight: 600; white-space: nowrap; }
  .readmore b { transition: margin-left .2s; }
  .card:hover .readmore b { margin-left: 4px; }

  /* featured lead story */
  .feature { grid-column: 1 / -1; }
  .feature h3 { font-size: clamp(22px, 3vw, 30px); }
  @media (min-width: 720px) {
    .feature { flex-direction: row; align-items: center; gap: 30px; padding: 30px; }
    .feature .card-main { flex: 1.05; }
    .feature .card-viz { flex: .95; min-width: 0; }
    .feature .card-foot { margin-top: 20px; }
  }

  /* bars */
  .track { background: var(--track); border-radius: 100px; height: var(--h); overflow: hidden; }
  .fill { height: 100%; width: var(--w); background: var(--c); border-radius: 100px; }
  .legend { display: flex; gap: 16px; margin-top: 10px; font-size: 12.5px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; }

  /* verdict */
  .verdict { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .big { font-size: 48px; font-weight: 700; letter-spacing: -2.5px; color: var(--c); line-height: 1; font-variant-numeric: tabular-nums; }
  .big span { font-size: 24px; letter-spacing: -1px; }
  .verdict-label { font-size: 14px; line-height: 1.35; }
  .dim { color: var(--dim); font-size: 12.5px; }
  .stars { position: relative; display: inline-block; color: #3a3d42; letter-spacing: 2px; font-size: 15px; }
  .stars-fg { position: absolute; left: 0; top: 0; overflow: hidden; white-space: nowrap; width: var(--w); color: var(--star); }
  .novotes { color: var(--dim); font-size: 13px; margin: 0; }
  .hint { color: var(--dim); font-size: 11.5px; margin: 10px 0 0; }

  /* ranking */
  .ranks { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
  .ranks li { display: flex; align-items: center; gap: 10px; }
  .rank-pos {
    flex: none; width: 22px; height: 22px; border-radius: 7px; background: var(--muted);
    color: var(--dim); font-size: 11.5px; font-weight: 800; display: grid; place-items: center;
  }
  .rank-top { background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
  .rank-body { flex: 1; min-width: 0; }
  .rank-label { display: block; font-size: 13.5px; margin-bottom: 5px; }
  .rank-avg { flex: none; font-size: 12px; color: var(--dim); font-variant-numeric: tabular-nums; }

  /* aspects */
  .aspects { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
  .aspects li { display: grid; grid-template-columns: 84px 1fr 38px; align-items: center; gap: 10px; }
  .aspect-label { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .aspect-pct { font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .aspect-none { color: var(--dim); font-size: 12px; }

  /* tags */
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin: 20px 0 0; }
  .tags span { font-size: 12px; color: var(--accent); }

  /* ---- topic analysis page ---- */
  .hero-topic { text-align: left; padding: 34px 0 6px; }
  .back { display: inline-block; color: var(--dim); text-decoration: none; font-size: 13.5px; margin-bottom: 18px; }
  .back:hover { color: var(--fg); }
  .cat-lg { font-size: 12.5px; padding: 5px 12px; }
  .topic-h1 { font-size: clamp(28px, 5vw, 46px); line-height: 1.08; letter-spacing: -1.4px; margin: 16px 0 0; font-weight: 700; }
  .topic-desc { color: var(--dim); font-size: 16px; max-width: 640px; margin: 14px 0 0; }
  .topic-meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 18px; color: var(--dim); font-size: 13px; font-variant-numeric: tabular-nums; }
  .topic-meta span { position: relative; }
  .analysis { margin-top: 34px; }
  .sec-h { font-size: 14px; text-transform: uppercase; letter-spacing: .8px; color: var(--dim); font-weight: 700; margin: 0 0 14px; }
  .panel { background: linear-gradient(180deg, var(--cardHi), var(--card)); border: 1px solid var(--border); border-radius: 18px; padding: 24px; }
  .viz-lg .big { font-size: 60px; }
  .viz-lg .verdict { gap: 18px; }

  /* web voting */
  .vote-panel { position: relative; }
  .vote-controls { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px; }
  .vbtn {
    flex: 1 1 130px; font: inherit; font-weight: 700; font-size: 16px; cursor: pointer;
    padding: 15px 18px; border-radius: 14px; border: 1px solid var(--border);
    background: var(--muted); color: var(--fg); transition: transform .12s, border-color .2s, color .2s, background .2s;
  }
  .vbtn:hover { transform: translateY(-1px); }
  .vbtn-yes:hover, .vbtn-yes.chosen { border-color: var(--yes); color: var(--yes); background: color-mix(in srgb, var(--yes) 12%, var(--muted)); }
  .vbtn-no:hover, .vbtn-no.chosen { border-color: var(--no); color: var(--no); background: color-mix(in srgb, var(--no) 12%, var(--muted)); }

  .rate-controls { gap: 4px; }
  .rbtn {
    font: inherit; font-size: 36px; line-height: 1; cursor: pointer; background: none; border: none;
    color: #3a3d42; padding: 2px 4px; transition: color .1s, transform .1s;
  }
  .rbtn:hover, .rbtn.hot, .rbtn.chosen { color: var(--star); }
  .rbtn:hover { transform: scale(1.08); }

  .aspect-vcontrols { flex-direction: column; gap: 8px; }
  .aspect-vrow { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 10px 14px; }
  .aspect-vlabel { font-size: 14px; font-weight: 600; }
  .aspect-vbtns { display: flex; gap: 8px; }
  .abtn { font: inherit; font-size: 18px; cursor: pointer; background: var(--muted); border: 1px solid var(--border); border-radius: 10px; padding: 6px 12px; transition: transform .12s, border-color .2s; }
  .abtn:hover { transform: translateY(-1px); }
  .abtn-up.chosen { border-color: var(--yes); background: color-mix(in srgb, var(--yes) 16%, var(--muted)); }
  .abtn-down.chosen { border-color: var(--no); background: color-mix(in srgb, var(--no) 16%, var(--muted)); }

  .rank-vcontrols { flex-direction: column; align-items: stretch; gap: 10px; }
  .rank-vhint { margin: 0; font-size: 13px; color: var(--dim); }
  .rank-opts { display: grid; gap: 8px; }
  .ropt { display: flex; align-items: center; gap: 10px; text-align: left; font: inherit; font-size: 15px; font-weight: 600; cursor: pointer; background: var(--muted); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; color: var(--fg); transition: border-color .2s, background .2s; }
  .ropt:hover { border-color: var(--dim); }
  .ropt.picked { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--muted)); }
  .ropt-num { display: none; flex: none; width: 22px; height: 22px; border-radius: 7px; background: var(--accent); color: #04121a; font-size: 12px; font-weight: 800; align-items: center; justify-content: center; }
  .ropt.picked .ropt-num { display: inline-flex; }
  .rank-actions { display: flex; gap: 10px; }
  .rank-reset, .rank-send { font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; border-radius: 100px; padding: 10px 18px; border: 1px solid var(--border); background: transparent; color: var(--fg); }
  .rank-send { background: linear-gradient(96deg, var(--accent), var(--primary)); color: #04121a; border: none; }
  .rank-send:disabled { opacity: .45; cursor: not-allowed; }

  /* single-select (multiple choice) */
  .choice-controls { display: grid; gap: 10px; }
  .cbtn { font: inherit; font-weight: 600; font-size: 15px; cursor: pointer; text-align: left; color: var(--fg); background: var(--muted); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; transition: border-color .15s, background .15s; }
  .cbtn:hover { border-color: var(--dim); }
  .cbtn.chosen { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, var(--muted)); color: var(--accent); }
  .choices { list-style: none; margin: 0; padding: 0; display: grid; gap: 12px; }
  .choice-row { display: grid; grid-template-columns: 1fr 34px; align-items: center; gap: 4px 10px; }
  .choice-label { font-size: 14px; font-weight: 500; color: var(--fg); grid-column: 1; }
  .choice-row .track { grid-column: 1 / 2; }
  .choice-pct { grid-column: 2; grid-row: 1 / 3; font-size: 13px; color: var(--dim); text-align: right; font-variant-numeric: tabular-nums; }
  .choice-lead .choice-label { color: var(--accent); font-weight: 700; }

  .vote-status { font-size: 13px; color: var(--accent); font-weight: 600; }
  .vote-status:not(:empty) { margin-bottom: 12px; }
  .vote-results { margin-top: 6px; }

  /* comments */
  .comments { display: grid; gap: 12px; }
  .comment { background: var(--card); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
  .comment-head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 6px; }
  .comment-author { font-size: 13px; font-weight: 600; }
  .comment-date { font-size: 11.5px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .comment-text { margin: 0; font-size: 14px; color: var(--fg); }
  .comment-compose { margin-bottom: 18px; }
  .comment-input { width: 100%; resize: vertical; min-height: 62px; font: inherit; font-size: 14px; color: var(--fg); background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; }
  .comment-input:focus { outline: none; border-color: var(--accent); }
  .comment-input::placeholder { color: var(--dim); }
  .comment-compose-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }
  .comment-hint { font-size: 12.5px; color: var(--dim); }
  .comment-post { font: inherit; font-weight: 600; font-size: 14px; cursor: pointer; border: none; border-radius: 100px; padding: 9px 18px; background: linear-gradient(96deg, var(--accent), var(--primary)); color: #04121a; }
  .comment-post:disabled { opacity: .5; cursor: not-allowed; }

  .detail-cta {
    display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 16px;
    margin-top: 40px; padding: 24px 26px; border-radius: 18px;
    background: linear-gradient(96deg, color-mix(in srgb, var(--accent) 12%, var(--card)), var(--card));
    border: 1px solid color-mix(in srgb, var(--accent) 26%, var(--border));
  }
  .detail-cta strong { display: block; font-size: 17px; }
  .detail-cta span { color: var(--dim); font-size: 13.5px; }

  /* insights */
  .ins { margin-top: 44px; }
  .ins h2 { font-size: 22px; font-weight: 700; letter-spacing: -.6px; margin: 0 0 4px; }
  .lede { color: var(--dim); font-size: 14px; margin: 0 0 18px; max-width: 620px; }

  .callouts { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .callout {
    background: linear-gradient(180deg, var(--cardHi), var(--card)); border: 1px solid var(--border);
    border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 2px;
  }
  .callout-label { font-size: 11px; text-transform: uppercase; letter-spacing: .7px; color: var(--dim); font-weight: 700; }
  .callout-value { font-size: 30px; font-weight: 700; letter-spacing: -1.2px; font-variant-numeric: tabular-nums; margin: 4px 0 2px; }
  .callout-title { font-size: 14.5px; font-weight: 600; line-height: 1.35; }
  .callout-sub { font-size: 12.5px; color: var(--dim); margin-top: 3px; }

  .spectrum, .catrows, .board, .picks {
    background: linear-gradient(180deg, var(--cardHi), var(--card)); border: 1px solid var(--border); border-radius: 16px; padding: 8px 18px;
  }
  .spec-row, .catrow, .board-row {
    display: grid; align-items: center; gap: 14px;
    padding: 13px 0; border-bottom: 1px solid var(--border);
  }
  .spec-row:last-child, .catrow:last-child, .board-row:last-child { border-bottom: none; }
  .spec-row { grid-template-columns: minmax(0, 1fr) 180px 46px 58px; }
  .spec-title, .catrow-name, .board-title { font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spec-bar { position: relative; display: block; }
  .spec-tick {
    position: absolute; left: 50%; top: -4px; bottom: -4px; width: 1px;
    background: var(--dim); opacity: .55;
  }
  .spec-pct { font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
  .spec-n { font-size: 12px; color: var(--dim); text-align: right; font-variant-numeric: tabular-nums; }

  .catrow { grid-template-columns: 130px minmax(0, 1fr) 66px 98px; }
  .catrow-name { display: flex; align-items: center; gap: 8px; font-weight: 600; }
  .catrow-name i { width: 8px; height: 8px; border-radius: 50%; flex: none; }
  .catrow-n { font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
  .catrow-q { font-size: 12px; color: var(--dim); text-align: right; }

  .board-row { grid-template-columns: minmax(0, 1fr) 150px 56px 54px; }
  .board-title { display: flex; flex-direction: column; gap: 2px; white-space: normal; }
  .board-ctx { font-size: 11.5px; color: var(--dim); }
  .board-val { font-size: 14px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
  .board-n { font-size: 12px; color: var(--dim); text-align: right; font-variant-numeric: tabular-nums; }

  .demogrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .demobox { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 16px 18px; }
  .demobox h3 { margin: 0 0 12px; font-size: 12px; text-transform: uppercase; letter-spacing: .7px; color: var(--dim); }
  .demo-row { display: grid; grid-template-columns: 74px 1fr 34px; align-items: center; gap: 9px; margin-top: 6px; }
  .demo-bucket { font-size: 12px; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .demo-n { font-size: 11.5px; color: var(--dim); text-align: right; font-variant-numeric: tabular-nums; }

  /* premium insights lock */
  .insights-panel { position: relative; }
  .insights-locked { text-align: center; padding: 30px 22px; }
  .insights-locked .lock-badge { display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: .6px; color: var(--accent); background: color-mix(in srgb, var(--accent) 14%, transparent); border: 1px solid color-mix(in srgb, var(--accent) 34%, transparent); border-radius: 100px; padding: 6px 14px; }
  .insights-locked .lock-title { margin: 14px 0 4px; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; }
  .insights-locked .lock-sub { margin: 0 auto; max-width: 420px; font-size: 13.5px; color: var(--dim); line-height: 1.5; }
  .demo-group { margin-top: 14px; }
  .demo-group:first-child { margin-top: 0; }
  .demo-group h3 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .7px; color: var(--dim); }
  .demo-track { height: 6px; background: var(--muted); border-radius: 3px; overflow: hidden; }
  .demo-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); }

  .picks { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0; padding: 0; }
  .pick { padding: 18px 20px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; }
  .pick:last-child { border-right: none; }
  .pick-q { font-size: 12.5px; color: var(--dim); }
  .pick-winner { font-size: 19px; font-weight: 700; letter-spacing: -.5px; color: var(--accent); }
  .pick-sub { font-size: 12px; color: var(--dim); }

  /* footer */
  .foot { margin-top: 72px; border-top: 1px solid var(--border); padding: 32px 0 56px; }
  .foot .wrap { display: flex; flex-wrap: wrap; gap: 16px 22px; align-items: center; }
  .foot a { color: var(--dim); text-decoration: none; font-size: 13.5px; }
  .foot a:hover { color: var(--fg); }
  .foot .copy { margin-left: auto; color: #4a4f54; font-size: 12.5px; }

  /* Entrance motion. Pure CSS animations, never a JS-applied class — if the
     script fails the page must still be readable. */
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes grow { from { width: 0; } }
  .card, .stat, .consensus, .panel, .callout {
    animation: rise .5s cubic-bezier(.22,.8,.3,1) both;
    animation-delay: calc(var(--i, 0) * 55ms);
  }
  .fill, .stars-fg { animation: grow .9s cubic-bezier(.22,.8,.3,1) .15s both; }
  @media (prefers-reduced-motion: reduce) {
    .card, .stat, .consensus, .panel, .callout, .fill, .stars-fg { animation: none; }
    .live-dot i { animation: none; }
  }
  @media (max-width: 720px) {
    .spec-row, .board-row { grid-template-columns: minmax(0, 1fr) auto; row-gap: 7px; column-gap: 10px; }
    .spec-title, .board-title, .spec-bar, .board-bar { grid-column: 1 / -1; }
    .spec-title, .board-title { white-space: normal; }
    .spec-pct, .board-val { text-align: left; }

    .catrow { grid-template-columns: minmax(0, 1fr) auto; row-gap: 7px; column-gap: 10px; }
    .catrow-name { order: 1; }
    .catrow-n { order: 2; }
    .catrow-bar { order: 3; grid-column: 1 / -1; }
    .catrow-q { order: 4; grid-column: 1 / -1; text-align: left; }

    .pick { border-right: none; border-bottom: 1px solid var(--border); }
    .pick:last-child { border-bottom: none; }
  }
  @media (max-width: 600px) {
    .hero { padding: 52px 0 28px; }
    .top nav { gap: 12px; }
    .top nav a.hide-sm { display: none; }
    .grid { grid-template-columns: 1fr; }
    .detail-cta { flex-direction: column; align-items: flex-start; }
  }
</style>
</head>
<body data-refresh="${esc(o.path)}">

<header class="top">
  <div class="wrap">
    <a class="brand" href="/">
      <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="#0f1524" stroke="#1e2740"/>
        <path d="M50 8 A42 42 0 0 1 50 92 A21 21 0 0 1 50 50 A21 21 0 0 0 50 8 Z" fill="${C.yes}"/>
        <path d="M50 8 A42 42 0 0 0 50 92 A21 21 0 0 0 50 50 A21 21 0 0 1 50 8 Z" fill="${C.no}"/>
        <circle cx="50" cy="29" r="8" fill="#070a14"/>
        <circle cx="50" cy="71" r="8" fill="#070a14"/>
      </svg>
      Factinion
    </a>
    <nav>
      <span class="live-dot"><i></i>LIVE</span>
      <a href="/"${resultsOn ? ' class="on"' : ""}>Results</a>
      <a href="/insights"${insightsOn ? ' class="on"' : ""}>Insights</a>
      <a href="/create"${o.path === "/create" ? ' class="on"' : ""}>Create</a>
      <span id="authslot" class="authslot"></span>
      <a href="${PLAY_URL}" class="nav-cta hide-sm">Get the app</a>
    </nav>
  </div>
</header>

<main>
  <section class="hero ${esc(o.heroClass ?? "")}">
    <div class="wrap">${o.hero}</div>
  </section>

  <div class="wrap">
    <div id="live">${o.body}</div>
  </div>
</main>

<footer class="foot">
  <div class="wrap">
    <a href="/privacy">Privacy Policy</a>
    <a href="/child-safety">Child safety standards</a>
    <a href="/delete-account">Delete your account</a>
    <a href="mailto:akshay21790@gmail.com">Contact</a>
    <span class="copy">Factinion — ask anything, vote on everything.</span>
  </div>
</footer>

<script>
(function () {
  var filter = "all";
  var rankSel = [];
  var pendingVote = null;

  // Sign-in state via Clerk (loaded async from the <head> script). Voting needs
  // a real account, so a signed-out click opens the sign-in modal first.
  function signedIn() { return !!(window.Clerk && window.Clerk.user); }
  function getToken() {
    if (!window.Clerk || !window.Clerk.session) return Promise.resolve(null);
    return window.Clerk.session.getToken().catch(function () { return null; });
  }
  // Stable per-browser anonymous id so people can vote with one tap, no sign-up.
  // The server namespaces it ("anon_") and validates the shape.
  function anonId() {
    try {
      var k = "opinion_anon_id";
      var v = localStorage.getItem(k);
      if (!v) { v = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12); localStorage.setItem(k, v); }
      return v;
    } catch (e) { return "a" + Date.now().toString(36); }
  }
  function authHeaders(extra) {
    return getToken().then(function (tok) {
      var h = extra || {};
      if (tok) h["Authorization"] = "Bearer " + tok;
      h["x-anon-id"] = anonId();
      return h;
    });
  }
  function savePending(topicId, body) { try { localStorage.setItem("opinion_pending_vote", JSON.stringify({ topicId: topicId, body: body })); } catch (e) {} }
  function loadPending() { try { var s = localStorage.getItem("opinion_pending_vote"); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
  function clearPending() { try { localStorage.removeItem("opinion_pending_vote"); } catch (e) {} }
  // Redirect to Clerk's hosted sign-in page (robust, unlike the embedded modal),
  // remembering the current page so we return and can replay a queued vote.
  function goSignIn(topicId, body) {
    if (topicId && body) savePending(topicId, body);
    window.location.href = "${ACCOUNTS_SIGNIN}?redirect_url=" + encodeURIComponent(window.location.href);
  }
  function updateVoteHint() {
    if (!document.querySelector(".vote-panel")) return;
    if (!signedIn()) setStatus("Tap to vote — no sign-up needed.");
  }
  function voiceLabel(v) {
    var m = { expert: "Expert", brand: "Brand", "public": "Public figure", creator: "Creator" };
    return m[v] || "Verified";
  }
  function loadProfile() {
    authHeaders().then(function (h) { return fetch("/api/me", { headers: h }); })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        if (!d) return;
        var badges = document.querySelector(".pc-badges");
        if (badges) {
          var html = "";
          if (d.isVerified) html += '<span class="pc-badge verified">✓ ' + voiceLabel(d.voiceType) + "</span>";
          if (d.isPremium) html += '<span class="pc-badge premium">★ Premium</span>';
          badges.innerHTML = html;
        }
        var sv = document.querySelector(".st-votes"); if (sv) sv.textContent = d.voteCount || 0;
        var st = document.querySelector(".st-topics"); if (st) st.textContent = d.topicCount || 0;
        var sc = document.querySelector(".st-comments"); if (sc) sc.textContent = d.commentCount || 0;
      })
      .catch(function () {});
  }
  function renderAuth() {
    var slot = document.getElementById("authslot");
    if (!slot) return;
    if (signedIn()) {
      var u = window.Clerk.user;
      var email = (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || "";
      var name = u.fullName || u.firstName || email || "Account";
      var img = u.imageUrl || "";
      var initial = (name || email || "?").trim().charAt(0).toUpperCase() || "?";
      slot.innerHTML =
        '<span class="userchip">' +
          '<button class="avatar-btn" type="button" aria-label="Your profile"></button>' +
          '<div class="profile-card">' +
            '<div class="pc-head"><div class="pc-av"></div>' +
              '<div class="pc-id"><div class="pc-name"></div><div class="pc-email"></div></div></div>' +
            '<div class="pc-badges"></div>' +
            '<div class="pc-stats">' +
              '<div class="pc-stat"><b class="st-votes">–</b><span>Votes</span></div>' +
              '<div class="pc-stat"><b class="st-topics">–</b><span>Topics</span></div>' +
              '<div class="pc-stat"><b class="st-comments">–</b><span>Comments</span></div>' +
            '</div>' +
            '<button class="pc-signout" type="button">Sign out</button>' +
          '</div>' +
        '</span>';
      var avBtn = slot.querySelector(".avatar-btn");
      var pcAv = slot.querySelector(".pc-av");
      if (img) {
        var i1 = document.createElement("img"); i1.alt = ""; i1.src = img; avBtn.appendChild(i1);
        var i2 = document.createElement("img"); i2.alt = ""; i2.src = img; pcAv.appendChild(i2);
      } else {
        avBtn.textContent = initial; pcAv.textContent = initial;
      }
      slot.querySelector(".pc-name").textContent = name;
      slot.querySelector(".pc-email").textContent = email;
      loadProfile();
    } else {
      slot.innerHTML = '<button class="signin-btn" type="button">Sign in</button>';
    }
    updateVoteHint();
  }

  function applyFilter() {
    var cards = document.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) {
      var isFeature = cards[i].classList.contains("feature");
      var show = isFeature || filter === "all" || cards[i].getAttribute("data-cat") === filter;
      cards[i].style.display = show ? "" : "none";
    }
    var chips = document.querySelectorAll(".chip");
    var matched = false;
    for (var j = 0; j < chips.length; j++) {
      var on = chips[j].getAttribute("data-cat") === filter;
      chips[j].classList.toggle("on", on);
      if (on) matched = true;
    }
    if (!matched && filter !== "all") { filter = "all"; applyFilter(); }
  }

  function setStatus(msg) {
    var s = document.querySelector(".vote-status");
    if (s) s.textContent = msg || "";
  }

  function markMyVotes() {
    var panel = document.querySelector(".vote-panel");
    if (!panel) return;
    var topicId = panel.getAttribute("data-topic");
    authHeaders().then(function (h) { return fetch("/api/topics/me/votes", { headers: h }); })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var v = data && data.votes && data.votes[topicId];
        if (!v) return;
        if (v.yesno) {
          var b = panel.querySelector('.vbtn[data-value="' + v.yesno + '"]');
          if (b) b.classList.add("chosen");
        }
        if (v.rating) {
          var stars = panel.querySelectorAll(".rbtn");
          for (var i = 0; i < stars.length; i++) stars[i].classList.toggle("chosen", (i + 1) <= v.rating);
        }
        if (v.aspectChoices) {
          for (var asp in v.aspectChoices) {
            var el = panel.querySelector('.abtn[data-aspect="' + asp.replace(/"/g, '\\\\"') + '"][data-choice="' + v.aspectChoices[asp] + '"]');
            if (el) el.classList.add("chosen");
          }
        }
        if (v.ranking && v.ranking.length && panel.getAttribute("data-kind") === "choice") {
          var cb = panel.querySelector('.cbtn[data-opt="' + String(v.ranking[0]).replace(/"/g, '\\\\"') + '"]');
          if (cb) cb.classList.add("chosen");
        }
      })
      .catch(function () {});
  }

  function updateRankUI() {
    var wrap = document.querySelector(".rank-vcontrols");
    if (!wrap) return;
    var opts = wrap.querySelectorAll(".ropt");
    for (var i = 0; i < opts.length; i++) {
      var id = opts[i].getAttribute("data-opt");
      var pos = rankSel.indexOf(id);
      opts[i].classList.toggle("picked", pos > -1);
      var num = opts[i].querySelector(".ropt-num");
      if (num) num.textContent = pos > -1 ? String(pos + 1) : "";
    }
    var send = wrap.querySelector(".rank-send");
    if (send) send.disabled = opts.length === 0 || rankSel.length !== opts.length;
  }

  function refreshLive(cb) {
    var base = document.body.getAttribute("data-refresh") || "/";
    var url = base + (base.indexOf("?") > -1 ? "&" : "?") + "fresh=" + Date.now();
    fetch(url, { headers: { accept: "text/html" } })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var next = doc.getElementById("live");
        var cur = document.getElementById("live");
        if (next && cur && next.innerHTML !== cur.innerHTML) cur.innerHTML = next.innerHTML;
        applyFilter();
        markMyVotes();
        updateRankUI();
        updateVoteHint();
        if (cb) cb();
      })
      .catch(function () { if (cb) cb(); });
  }

  // One-tap voting: no sign-in required. The vote is attributed to the Clerk
  // account when signed in, otherwise to the anonymous browser id.
  function castVote(topicId, body) {
    doVote(topicId, body);
  }

  // Optimistically highlight the tapped control so the vote feels instant,
  // before the server round-trip + results refresh complete.
  function markChosen(body) {
    var panel = document.querySelector(".vote-panel");
    if (!panel) return;
    function clear(sel) { var e = panel.querySelectorAll(sel); for (var i = 0; i < e.length; i++) e[i].classList.remove("chosen"); }
    if (body.kind === "yesno") {
      clear(".vbtn");
      var b = panel.querySelector('.vbtn[data-value="' + body.value + '"]'); if (b) b.classList.add("chosen");
    } else if (body.kind === "choice") {
      clear(".cbtn");
      var c = panel.querySelector('.cbtn[data-opt="' + String(body.value).replace(/"/g, '\\\\"') + '"]'); if (c) c.classList.add("chosen");
    } else if (body.kind === "rating") {
      var stars = panel.querySelectorAll(".rbtn");
      for (var i = 0; i < stars.length; i++) stars[i].classList.toggle("chosen", (i + 1) <= body.value);
    } else if (body.kind === "aspect") {
      var row = panel.querySelector('.abtn[data-aspect="' + String(body.aspect).replace(/"/g, '\\\\"') + '"]');
      if (row && row.parentNode) { var sib = row.parentNode.querySelectorAll(".abtn"); for (var j = 0; j < sib.length; j++) sib[j].classList.remove("chosen"); }
      var el = panel.querySelector('.abtn[data-aspect="' + String(body.aspect).replace(/"/g, '\\\\"') + '"][data-choice="' + body.choice + '"]'); if (el) el.classList.add("chosen");
    }
  }

  function doVote(topicId, body) {
    markChosen(body);
    setStatus("Saving your vote…");
    authHeaders({ "Content-Type": "application/json" }).then(function (h) {
      return fetch("/api/topics/" + topicId + "/vote", { method: "POST", headers: h, body: JSON.stringify(body) });
    })
      .then(function (r) {
        if (!r.ok) throw new Error("vote failed");
        return r.json();
      })
      .then(function () {
        rankSel = [];
        setStatus("✓ Your vote is in — thanks!"); // instant confirmation
        refreshLive();                             // numbers catch up in the background
      })
      .catch(function () { setStatus("Couldn't save your vote. Please try again."); });
  }

  function setCommentHint(msg) { var h = document.querySelector(".comment-hint"); if (h) h.textContent = msg || ""; }
  function saveCommentDraft(text) { try { localStorage.setItem("opinion_comment_draft", text); } catch (e) {} }
  function loadCommentDraft() { try { return localStorage.getItem("opinion_comment_draft") || ""; } catch (e) { return ""; } }
  function clearCommentDraft() { try { localStorage.removeItem("opinion_comment_draft"); } catch (e) {} }
  function postComment(topicId, text, input) {
    setCommentHint("Posting…");
    var u = window.Clerk && window.Clerk.user;
    var name = (u && (u.firstName || (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress))) || "Anonymous";
    authHeaders({ "Content-Type": "application/json" }).then(function (h) {
      return fetch("/api/topics/" + topicId + "/comments", { method: "POST", headers: h, body: JSON.stringify({ text: text, authorName: name }) });
    }).then(function (r) {
      if (r.status === 401) throw new Error("unauth");
      if (!r.ok) throw new Error("comment failed");
      return r.json();
    }).then(function () {
      if (input) input.value = "";
      setCommentHint("Comment posted — thanks!");
      refreshLive();
    }).catch(function (err) {
      if (err && err.message === "unauth") { saveCommentDraft(text); goSignIn(); }
      else setCommentHint("Couldn't post — try again.");
    });
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    function closest(sel) { return t && t.closest ? t.closest(sel) : null; }

    if (closest(".signin-btn")) { e.preventDefault(); goSignIn(); return; }
    if (closest(".pc-signout") || closest(".signout")) { e.preventDefault(); if (window.Clerk) window.Clerk.signOut(); return; }
    if (closest(".avatar-btn")) {
      e.preventDefault();
      var card = document.querySelector(".profile-card");
      if (card) card.classList.toggle("open");
      return;
    }
    // click anywhere else closes an open profile card
    if (!closest(".profile-card")) {
      var openCard = document.querySelector(".profile-card.open");
      if (openCard) openCard.classList.remove("open");
    }

    var cpost = closest(".comment-post");
    if (cpost) {
      e.preventDefault();
      var box = closest(".comment-compose") || document.querySelector(".comment-compose");
      var input = box ? box.querySelector(".comment-input") : null;
      var text = input ? input.value.trim() : "";
      if (!text) { setCommentHint("Write something first."); return; }
      var cTopic = box ? box.getAttribute("data-topic") : null;
      if (!signedIn()) { setCommentHint("Taking you to sign in…"); saveCommentDraft(text); goSignIn(); return; }
      postComment(cTopic, text, input);
      return;
    }

    var chip = closest(".chip");
    if (chip) { e.preventDefault(); filter = chip.getAttribute("data-cat"); applyFilter(); return; }

    var panel = closest(".vote-panel");
    if (!panel) return;
    var topicId = panel.getAttribute("data-topic");

    var vbtn = closest(".vbtn");
    if (vbtn) { e.preventDefault(); castVote(topicId, { kind: "yesno", value: vbtn.getAttribute("data-value") }); return; }

    var rbtn = closest(".rbtn");
    if (rbtn) { e.preventDefault(); castVote(topicId, { kind: "rating", value: Number(rbtn.getAttribute("data-value")) }); return; }

    var abtn = closest(".abtn");
    if (abtn) { e.preventDefault(); castVote(topicId, { kind: "aspect", aspect: abtn.getAttribute("data-aspect"), choice: abtn.getAttribute("data-choice") }); return; }

    var cbtn = closest(".cbtn");
    if (cbtn) { e.preventDefault(); castVote(topicId, { kind: "choice", value: cbtn.getAttribute("data-opt") }); return; }

    var reset = closest(".rank-reset");
    if (reset) { e.preventDefault(); rankSel = []; updateRankUI(); return; }

    var send = closest(".rank-send");
    if (send) { e.preventDefault(); if (rankSel.length) castVote(topicId, { kind: "ranking", value: rankSel }); return; }

    var ropt = closest(".ropt");
    if (ropt) {
      e.preventDefault();
      var id = ropt.getAttribute("data-opt");
      var idx = rankSel.indexOf(id);
      if (idx > -1) rankSel.splice(idx, 1); else rankSel.push(id);
      updateRankUI();
      return;
    }
  });

  // Star hover preview.
  document.addEventListener("mouseover", function (e) {
    var rbtn = e.target && e.target.closest ? e.target.closest(".rbtn") : null;
    if (!rbtn || !rbtn.parentNode) return;
    var val = Number(rbtn.getAttribute("data-value"));
    var stars = rbtn.parentNode.querySelectorAll(".rbtn");
    for (var i = 0; i < stars.length; i++) stars[i].classList.toggle("hot", (i + 1) <= val);
  });
  document.addEventListener("mouseout", function (e) {
    var rc = e.target && e.target.closest ? e.target.closest(".rate-controls") : null;
    if (!rc) return;
    var stars = rc.querySelectorAll(".rbtn");
    for (var i = 0; i < stars.length; i++) stars[i].classList.remove("hot");
  });

  // Clerk loads async from the <head> script; wait for it, then wire auth,
  // personal vote marks, and replay a vote the user queued before signing in.
  // Premium "Who voted" breakdown. The public HTML ships only a locked card;
  // signed-in premium members fetch the real data and we render it in place.
  var DEMO_LABELS = { ageRange: "Age", gender: "Gender", country: "Country", occupation: "Occupation" };
  function renderInsights(panel, breakdown) {
    var html = "";
    for (var field in breakdown) {
      if (!breakdown.hasOwnProperty(field)) continue;
      var buckets = breakdown[field] || {};
      var total = 0, keys = [];
      for (var k in buckets) { if (buckets.hasOwnProperty(k)) { total += buckets[k]; keys.push(k); } }
      if (!total) continue;
      keys.sort(function (a, b) { return buckets[b] - buckets[a]; });
      var label = DEMO_LABELS[field] || field;
      html += '<div class="demo-group"><h3>' + label + "</h3>";
      for (var i = 0; i < keys.length; i++) {
        var pct = Math.round((buckets[keys[i]] / total) * 100);
        html += '<div class="demo-row"><span class="demo-bucket">' + keys[i] +
          '</span><span class="demo-track"><span class="demo-fill" style="width:' + pct + '%"></span></span>' +
          '<span class="demo-n">' + pct + "%</span></div>";
      }
      html += "</div>";
    }
    panel.innerHTML = html || '<div class="insights-locked"><p class="lock-sub">No demographic data yet — check back once more people vote.</p></div>';
  }
  function loadInsights() {
    var panel = document.querySelector(".insights-panel");
    if (!panel || !signedIn()) return;
    var topicId = panel.getAttribute("data-insights");
    authHeaders().then(function (h) { return fetch("/api/topics/" + topicId + "/insights", { headers: h }); })
      .then(function (r) {
        if (r.status === 200) return r.json();
        return null; // 401/403 → not premium, keep the locked card
      })
      .then(function (data) { if (data && data.demoBreakdown) renderInsights(panel, data.demoBreakdown); })
      .catch(function () {});
  }

  // ---- create a poll ----
  var createVT = "yesno";
  function createNeedsOptions() { return createVT === "ranking" || createVT === "aspects" || createVT === "choice"; }
  function setCreateHint(m) { var h = document.querySelector(".cf-hint"); if (h) h.textContent = m || ""; }
  function updateCreateAuth() { var so = document.querySelector(".cf-signedout"); if (so) so.classList.toggle("show", !signedIn()); }
  function addOptRow(val) {
    var list = document.querySelector(".cf-opt-list");
    if (!list || list.children.length >= 8) return;
    var row = document.createElement("div");
    row.className = "cf-opt-row";
    var inp = document.createElement("input");
    inp.className = "cf-opt-input"; inp.type = "text"; inp.maxLength = 60;
    inp.placeholder = "Option " + (list.children.length + 1);
    if (val) inp.value = val;
    var del = document.createElement("button");
    del.type = "button"; del.className = "cf-opt-del"; del.textContent = "✕";
    row.appendChild(inp); row.appendChild(del); list.appendChild(row);
  }
  function syncCreateType() {
    var wrap = document.querySelector(".cf-optionwrap");
    if (wrap) wrap.hidden = !createNeedsOptions();
    if (createNeedsOptions()) {
      var list = document.querySelector(".cf-opt-list");
      if (list && list.children.length === 0) { addOptRow(); addOptRow(); }
    }
  }
  function submitCreate() {
    var form = document.querySelector(".create-form");
    if (!form) return;
    if (!signedIn()) { updateCreateAuth(); goSignIn(); return; }
    var title = (form.querySelector(".cf-title").value || "").trim();
    if (!title) { setCreateHint("Add your question first."); return; }
    var body = {
      title: title,
      description: (form.querySelector(".cf-desc").value || "").trim(),
      category: form.querySelector(".cf-cat").value,
      votingType: createVT,
    };
    if (createNeedsOptions()) {
      var inputs = form.querySelectorAll(".cf-opt-input");
      var opts = [];
      for (var i = 0; i < inputs.length; i++) { var v = (inputs[i].value || "").trim(); if (v) opts.push(v); }
      if (opts.length < 2) { setCreateHint("Add at least 2 options."); return; }
      if (createVT === "ranking" || createVT === "choice") {
        body.rankingOptions = opts.map(function (o) {
          var id = o.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
          return { id: id || ("opt" + Math.random().toString(36).slice(2, 7)), label: o };
        });
      } else { body.aspects = opts; }
    }
    var tags = (form.querySelector(".cf-tags").value || "").split(/[,\\s]+/)
      .map(function (s) { return s.replace(/^#/, "").trim(); }).filter(Boolean).slice(0, 10);
    if (tags.length) body.hashtags = tags;
    if (window.Clerk && window.Clerk.user) {
      var u = window.Clerk.user;
      body.createdByName = u.fullName || u.firstName || (u.primaryEmailAddress && u.primaryEmailAddress.emailAddress) || "Someone";
    }
    var btn = form.querySelector(".cf-submit"); if (btn) btn.disabled = true;
    setCreateHint("Publishing…");
    authHeaders({ "Content-Type": "application/json" }).then(function (h) {
      return fetch("/api/topics", { method: "POST", headers: h, body: JSON.stringify(body) });
    }).then(function (r) {
      if (r.status === 401) throw new Error("unauth");
      if (!r.ok) throw new Error("failed");
      return r.json();
    }).then(function (d) {
      window.location.href = (d && d.topic && d.topic.id) ? ("/topic/" + d.topic.id) : "/";
    }).catch(function (err) {
      if (btn) btn.disabled = false;
      if (err && err.message === "unauth") { updateCreateAuth(); goSignIn(); }
      else setCreateHint("Couldn't publish — please try again.");
    });
  }
  function initCreate() {
    var form = document.querySelector(".create-form");
    if (!form) return;
    form.addEventListener("click", function (e) {
      var t = e.target;
      function c(sel) { return t && t.closest ? t.closest(sel) : null; }
      var typeBtn = c(".cf-type");
      if (typeBtn) {
        createVT = typeBtn.getAttribute("data-vt");
        var all = form.querySelectorAll(".cf-type");
        for (var i = 0; i < all.length; i++) all[i].classList.toggle("on", all[i] === typeBtn);
        syncCreateType();
        return;
      }
      if (c(".cf-add")) { addOptRow(); return; }
      if (c(".cf-opt-del")) {
        var list = document.querySelector(".cf-opt-list");
        if (list && list.children.length > 2) { var row = c(".cf-opt-row"); if (row) row.remove(); }
        return;
      }
      if (c(".cf-signin")) { goSignIn(); return; }
      if (c(".cf-submit")) { submitCreate(); return; }
    });
    syncCreateType();
    updateCreateAuth();
  }

  function initClerk() {
    window.Clerk.load().then(function () {
      renderAuth();
      markMyVotes();
      loadInsights();
      updateCreateAuth();
      // Just came back from the hosted sign-in with a queued vote? Cast it now.
      if (signedIn()) {
        var p = loadPending();
        if (p) { clearPending(); doVote(p.topicId, p.body); }
        var draft = loadCommentDraft();
        if (draft) { var ci = document.querySelector(".comment-input"); if (ci) ci.value = draft; clearCommentDraft(); }
      }
      window.Clerk.addListener(function () { renderAuth(); markMyVotes(); loadInsights(); updateCreateAuth(); });
    }).catch(function () {});
  }
  var clerkTries = 0;
  var clerkWait = setInterval(function () {
    clerkTries++;
    if (window.Clerk && window.Clerk.load) { clearInterval(clerkWait); initClerk(); }
    else if (clerkTries > 100) { clearInterval(clerkWait); }
  }, 200);

  initCreate();

  setInterval(function () {
    if (document.hidden) return;
    refreshLive();
  }, 45000);
})();
</script>

</body>
</html>`;
}

export function renderPage(list: SiteTopic[], featuredIds: string[] = []): string {
  return shell({
    title: "Factinion — what people actually think",
    description: "Live results from the Factinion app: real polls, ratings and rankings, updating as people vote.",
    path: "/",
    hero: `<span class="eyebrow"><span class="live-dot"><i></i></span>Live opinion, as it happens</span>
      <h1>See what the world <span class="grad">actually thinks</span></h1>
      <p>Real questions. Real votes. Counted live as they come in — straight from the Factinion app. Tap any story to break down the data.</p>
      <div class="cta-row">
        <a class="cta cta-primary" href="${PLAY_URL}">Get it on Google Play</a>
        <a class="cta cta-ghost" href="/insights">Explore the data</a>
      </div>`,
    body: renderLive(list, featuredIds),
  });
}

/* -------------------------------------------------------------- topic page */

function renderComments(comments: SiteComment[]): string {
  if (comments.length === 0) return `<p class="novotes">No comments yet — be the first.</p>`;
  return `<div class="comments">${comments
    .slice(0, 50)
    .map(
      (c) => `<div class="comment">
        <div class="comment-head">
          <span class="comment-author">${esc(c.authorName ?? "Anonymous")}</span>
          <span class="comment-date">${formatDate(c.createdAt)}</span>
        </div>
        <p class="comment-text">${esc(c.text)}</p>
      </div>`,
    )
    .join("")}</div>`;
}

export function renderTopicPage(t: SiteTopic, comments: SiteComment[]): string {
  const cat = CATEGORY_CONFIG[t.category] ?? CATEGORY_CONFIG.other;
  const part = participation(t);
  const author = t.createdByName ?? "Factinion";
  const tags = (t.hashtags ?? []).slice(0, 6);

  const body = `
    <section class="analysis" style="--i:0">
      <h2 class="sec-h">Cast your vote</h2>
      ${renderVoteWidget(t)}
    </section>
    <section class="analysis" style="--i:1">
      <h2 class="sec-h">Who voted</h2>
      <div class="panel insights-panel" data-insights="${esc(t.id)}">
        <div class="insights-locked">
          <span class="lock-badge">🔒 Premium</span>
          <p class="lock-title">See who's voting</p>
          <p class="lock-sub">Full breakdown by age, gender, country &amp; occupation — for Premium members.</p>
        </div>
      </div>
    </section>
    ${tags.length ? `<div class="tags">${tags.map((h) => `<span>#${esc(h)}</span>`).join("")}</div>` : ""}
    <section class="analysis" style="--i:2">
      <h2 class="sec-h">Comments${t.commentCount ? " · " + fmt(t.commentCount) : ""}</h2>
      <div class="comment-compose" data-topic="${esc(t.id)}">
        <textarea class="comment-input" placeholder="Add your comment…" maxlength="500" rows="3"></textarea>
        <div class="comment-compose-row">
          <span class="comment-hint"></span>
          <button class="comment-post" type="button">Post comment</button>
        </div>
      </div>
      ${renderComments(comments)}
    </section>
    <div class="detail-cta">
      <div><strong>Cast your vote</strong><span>Join in and see the results move — in the Factinion app.</span></div>
      <a class="cta cta-primary" href="${PLAY_URL}">Get it on Google Play</a>
    </div>`;

  return shell({
    title: `${t.title} — Factinion`,
    description: t.description || `Live results for "${t.title}" on Factinion.`,
    path: `/topic/${t.id}`,
    heroClass: "hero-topic",
    hero: `<a class="back" href="/">&larr; All results</a>
      <div><span class="cat cat-lg" style="--c:${cat.color}"><i></i>${esc(cat.label)}</span></div>
      <h1 class="topic-h1">${esc(t.title)}</h1>
      ${t.description ? `<p class="topic-desc">${esc(t.description)}</p>` : ""}
      <div class="topic-author">${renderAuthor(author, t.voiceType, "lg")}</div>
      <div class="topic-meta">
        <span>${fmt(part)} ${part === 1 ? "vote" : "votes"}</span>
        <span>${TYPE_LABEL[t.votingType] ?? t.votingType}</span>
        <span>${formatDate(t.createdAt)}</span>
      </div>`,
    body,
  });
}

export function renderCreatePage(): string {
  const cats = Object.entries(CATEGORY_CONFIG)
    .map(([k, v]) => `<option value="${k}">${esc(v.label)}</option>`)
    .join("");
  const types: [string, string, string][] = [
    ["yesno", "Yes / No", "A for-or-against question."],
    ["choice", "Multiple choice", "Pick one of several options."],
    ["rating", "Rating", "People rate it 1–5."],
    ["ranking", "Ranking", "People order the options."],
    ["aspects", "Aspects", "Thumbs up/down each aspect."],
  ];
  const typeBtns = types
    .map(([v, label, desc], i) =>
      `<button type="button" class="cf-type${i === 0 ? " on" : ""}" data-vt="${v}"><b>${esc(label)}</b><span>${esc(desc)}</span></button>`,
    )
    .join("");

  const body = `
    <form class="create-form" autocomplete="off">
      <div class="cf-signedout">Sign in to publish your poll.<button type="button" class="cf-signin">Sign in</button></div>
      <div class="cf-fields">
        <label class="cf-label">Your question
          <input class="cf-title" type="text" maxlength="120" placeholder="e.g. Is Virat Kohli the GOAT?">
        </label>
        <label class="cf-label">Description <span class="cf-opt">(optional)</span>
          <textarea class="cf-desc" maxlength="500" rows="3" placeholder="Add context to spark the debate…"></textarea>
        </label>
        <div class="cf-label">Poll type
          <div class="cf-types">${typeBtns}</div>
        </div>
        <div class="cf-optionwrap" hidden>
          <div class="cf-label">Options <span class="cf-opt">(2–8)</span></div>
          <div class="cf-opt-list"></div>
          <button type="button" class="cf-add">+ Add option</button>
        </div>
        <div class="cf-row">
          <label class="cf-label">Category
            <select class="cf-cat">${cats}</select>
          </label>
          <label class="cf-label">Hashtags <span class="cf-opt">(optional)</span>
            <input class="cf-tags" type="text" placeholder="cricket, kohli">
          </label>
        </div>
        <div class="cf-actions">
          <span class="cf-hint"></span>
          <button type="button" class="cf-submit">Publish poll</button>
        </div>
      </div>
    </form>`;

  return shell({
    title: "Create a poll — Factinion",
    description: "Start a debate on Factinion — ask a question and watch the world vote.",
    path: "/create",
    heroClass: "hero-create",
    hero: `<h1 class="topic-h1">Create a poll</h1>
      <p class="topic-desc">Ask a question, choose how people vote, and share it. The world votes.</p>`,
    body,
  });
}

export function renderNotFound(): string {
  return shell({
    title: "Not found — Factinion",
    description: "That page could not be found.",
    path: "/",
    hero: `<h1>Not <span class="grad">found</span></h1>
      <p>That question doesn't exist, or it was removed.</p>
      <div class="cta-row"><a class="cta cta-primary" href="/">Back to results</a></div>`,
    body: "",
  });
}

/* ------------------------------------------------------------------ insights */

// Everything on /insights is derived from the same rows the feed renders — the
// point of the page is what the questions say together rather than one by one.

function yesNoSpread(list: SiteTopic[]) {
  return list
    .filter((t) => t.votingType === "yesno" && t.yesCount + t.noCount > 0)
    .map((t) => {
      const total = t.yesCount + t.noCount;
      return { topic: t, total, yesPct: Math.round((t.yesCount / total) * 100) };
    })
    .sort((a, b) => b.yesPct - a.yesPct);
}

function renderSpectrum(list: SiteTopic[]): string {
  const rows = yesNoSpread(list);
  if (rows.length === 0) return "";
  return `<section class="ins">
    <h2>The consensus spectrum</h2>
    <p class="lede">Every yes / no question, sorted from most agreement to most opposition. The line marks an even split.</p>
    <div class="spectrum">${rows
      .map(
        (r) => `<div class="spec-row">
          <span class="spec-title">${esc(r.topic.title)}</span>
          <span class="spec-bar">${bar(r.yesPct, C.yes, C.no, 8)}<i class="spec-tick"></i></span>
          <span class="spec-pct" style="color:${r.yesPct >= 50 ? C.yes : C.no}">${r.yesPct}%</span>
          <span class="spec-n">${fmt(r.total)}</span>
        </div>`,
      )
      .join("")}</div>
  </section>`;
}

function renderExtremes(list: SiteTopic[]): string {
  const rows = yesNoSpread(list);
  if (rows.length < 2) return "";
  const divided = [...rows].sort((a, b) => Math.abs(a.yesPct - 50) - Math.abs(b.yesPct - 50))[0];
  const agreed = [...rows].sort((a, b) => Math.abs(b.yesPct - 50) - Math.abs(a.yesPct - 50))[0];
  const busiest = [...list].sort((a, b) => participation(b) - participation(a))[0];

  const callout = (label: string, title: string, value: string, sub: string, color: string) =>
    `<div class="callout">
      <span class="callout-label">${esc(label)}</span>
      <span class="callout-value" style="color:${color}">${esc(value)}</span>
      <span class="callout-title">${esc(title)}</span>
      <span class="callout-sub">${esc(sub)}</span>
    </div>`;

  return `<section class="ins">
    <h2>Standouts</h2>
    <div class="callouts">
      ${callout("Most divided", divided.topic.title, divided.yesPct + "% yes",
        fmt(divided.total) + " votes — near enough a coin flip", C.star)}
      ${callout("Strongest agreement", agreed.topic.title,
        (agreed.yesPct >= 50 ? agreed.yesPct + "% yes" : 100 - agreed.yesPct + "% no"),
        fmt(agreed.total) + " votes", agreed.yesPct >= 50 ? C.yes : C.no)}
      ${callout("Most answered", busiest.title, fmt(participation(busiest)),
        (TYPE_LABEL[busiest.votingType] ?? busiest.votingType) + " — the busiest question", C.accent)}
    </div>
  </section>`;
}

function renderCategories(list: SiteTopic[]): string {
  const byCat: Record<string, { questions: number; votes: number }> = {};
  for (const t of list) {
    const c = (byCat[t.category] ??= { questions: 0, votes: 0 });
    c.questions++;
    c.votes += participation(t);
  }
  const rows = Object.entries(byCat).sort((a, b) => b[1].votes - a[1].votes);
  if (rows.length === 0) return "";
  const max = Math.max(...rows.map(([, v]) => v.votes), 1);

  return `<section class="ins">
    <h2>Where the votes are</h2>
    <p class="lede">Which subjects people actually turn up for.</p>
    <div class="catrows">${rows
      .map(([cat, v]) => {
        const cfg = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.other;
        return `<div class="catrow">
          <span class="catrow-name"><i style="background:${cfg.color}"></i>${esc(cfg.label)}</span>
          <span class="catrow-bar">${bar(Math.round((v.votes / max) * 100), cfg.color, C.muted, 8)}</span>
          <span class="catrow-n">${fmt(v.votes)}</span>
          <span class="catrow-q">${v.questions === 1 ? "1 question" : v.questions + " questions"}</span>
        </div>`;
      })
      .join("")}</div>
  </section>`;
}

function renderWhoVotes(list: SiteTopic[]): string {
  const FIELD_LABEL: Record<string, string> = {
    ageRange: "Age",
    gender: "Gender",
    country: "Country",
    occupation: "Occupation",
  };
  // Sum every topic's breakdown into one picture of the whole audience.
  const totals: Record<string, Record<string, number>> = {};
  for (const t of list) {
    for (const [field, buckets] of Object.entries(t.demoBreakdown ?? {})) {
      for (const [bucket, n] of Object.entries(buckets ?? {})) {
        if (!n) continue;
        ((totals[field] ??= {})[bucket] ??= 0);
        totals[field][bucket] += n;
      }
    }
  }
  const fields = Object.entries(totals).filter(([, b]) => Object.keys(b).length > 0);
  if (fields.length === 0) return "";

  return `<section class="ins">
    <h2>Who is voting</h2>
    <p class="lede">Pooled across every question where voters shared these details. Optional, so it covers some voters rather than all.</p>
    <div class="demogrid">${fields
      .map(([field, buckets]) => {
        const entries = Object.entries(buckets).sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((s, [, n]) => s + n, 0);
        return `<div class="demobox">
          <h3>${esc(FIELD_LABEL[field] ?? field)}</h3>
          ${entries
            .map(([bucket, n]) => {
              const pct = Math.round((n / total) * 100);
              return `<div class="demo-row">
                <span class="demo-bucket">${esc(bucket)}</span>
                ${bar(pct, C.primary, C.muted, 6)}
                <span class="demo-n">${pct}%</span>
              </div>`;
            })
            .join("")}
        </div>`;
      })
      .join("")}</div>
  </section>`;
}

function renderRatingBoard(list: SiteTopic[]): string {
  const rows = list
    .filter((t) => t.votingType === "rating" && t.ratingCount > 0)
    .map((t) => ({ topic: t, avg: t.totalRating / t.ratingCount }))
    .sort((a, b) => b.avg - a.avg);
  if (rows.length === 0) return "";

  return `<section class="ins">
    <h2>Rated highest</h2>
    <div class="board">${rows
      .map(
        (r) => `<div class="board-row">
          <span class="board-title">${esc(r.topic.title)}</span>
          <span class="stars"><span class="stars-bg">★★★★★</span><span class="stars-fg" style="--w:${(r.avg / 5) * 100}%">★★★★★</span></span>
          <span class="board-val">${r.avg.toFixed(1)}</span>
          <span class="board-n">${fmt(r.topic.ratingCount)}</span>
        </div>`,
      )
      .join("")}</div>
  </section>`;
}

function renderAspectBoard(list: SiteTopic[]): string {
  const rows: { label: string; topic: string; upPct: number; total: number }[] = [];
  for (const t of list) {
    if (t.votingType !== "aspects") continue;
    for (const a of t.aspects ?? []) {
      const v = t.aspectVotes[a] ?? { up: 0, down: 0 };
      const total = v.up + v.down;
      if (total === 0) continue;
      rows.push({ label: a, topic: t.title, upPct: Math.round((v.up / total) * 100), total });
    }
  }
  if (rows.length === 0) return "";
  rows.sort((a, b) => b.upPct - a.upPct);

  return `<section class="ins">
    <h2>Praised and criticised</h2>
    <p class="lede">Individual aspects across every detailed review, best received first.</p>
    <div class="board">${rows
      .map(
        (r) => `<div class="board-row">
          <span class="board-title">${esc(r.label)}<span class="board-ctx">${esc(r.topic)}</span></span>
          <span class="board-bar">${bar(r.upPct, C.yes, C.no, 6)}</span>
          <span class="board-val" style="color:${r.upPct >= 50 ? C.yes : C.no}">${r.upPct}%</span>
          <span class="board-n">${fmt(r.total)}</span>
        </div>`,
      )
      .join("")}</div>
  </section>`;
}

function renderTopPicks(list: SiteTopic[]): string {
  const rows = list
    .filter((t) => t.votingType === "ranking")
    .map((t) => {
      const ranked = (t.rankingOptions ?? [])
        .map((o) => ({ label: o.label, avg: avgRank(t, o.id) }))
        .filter((o) => o.avg !== null)
        .sort((a, b) => (a.avg as number) - (b.avg as number));
      return { topic: t, winner: ranked[0], runnerUp: ranked[1] };
    })
    .filter((r) => r.winner);
  if (rows.length === 0) return "";

  return `<section class="ins">
    <h2>Top picks</h2>
    <p class="lede">What came first when people put the options in order.</p>
    <div class="picks">${rows
      .map(
        (r) => `<div class="pick">
          <span class="pick-q">${esc(r.topic.title)}</span>
          <span class="pick-winner">${esc(r.winner!.label)}</span>
          <span class="pick-sub">avg position ${(r.winner!.avg as number).toFixed(1)}${
            r.runnerUp ? " · then " + esc(r.runnerUp.label) : ""
          }</span>
        </div>`,
      )
      .join("")}</div>
  </section>`;
}

export function renderInsightsPage(list: SiteTopic[]): string {
  const totalVotes = list.reduce((s, t) => s + participation(t), 0);
  const yesno = list.filter((t) => t.votingType === "yesno");
  const yes = yesno.reduce((s, t) => s + t.yesCount, 0);
  const no = yesno.reduce((s, t) => s + t.noCount, 0);
  const consensus = yes + no > 0 ? Math.round((yes / (yes + no)) * 100) : null;
  const avgPerQuestion = list.length ? Math.round(totalVotes / list.length) : 0;

  const sections = [
    renderExtremes(list),
    renderSpectrum(list),
    renderCategories(list),
    renderWhoVotes(list),
    renderRatingBoard(list),
    renderAspectBoard(list),
    renderTopPicks(list),
  ].filter(Boolean);

  const stats = `<div class="stats">
    <div class="stat"><span class="stat-n">${fmt(totalVotes)}</span><span class="stat-l">votes analysed</span></div>
    <div class="stat"><span class="stat-n">${fmt(list.length)}</span><span class="stat-l">questions</span></div>
    <div class="stat"><span class="stat-n">${fmt(avgPerQuestion)}</span><span class="stat-l">avg votes per question</span></div>
    <div class="stat"><span class="stat-n">${consensus === null ? "—" : consensus + "%"}</span><span class="stat-l">overall say yes</span></div>
  </div>`;

  return shell({
    title: "Factinion — insights",
    description: "What the numbers say across every question on Factinion: consensus, divisions, and who is voting.",
    path: "/insights",
    hero: `<h1>The <span class="grad">bigger picture</span></h1>
      <p>Every question on Factinion, read together — where people agree, where they split, and who is doing the voting.</p>`,
    body: list.length
      ? stats + sections.join("")
      : `<p class="novotes">No questions yet — insights appear once people start voting.</p>`,
  });
}
