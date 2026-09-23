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
function participation(t: SiteTopic): number {
  if (t.votingType === "yesno") return t.yesCount + t.noCount;
  if (t.votingType === "rating") return t.ratingCount;
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

function vizFor(t: SiteTopic): string {
  return t.votingType === "yesno"
    ? renderYesNo(t)
    : t.votingType === "rating"
      ? renderRating(t)
      : t.votingType === "ranking"
        ? renderRanking(t)
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
  const title = `<h3>${esc(t.title)}</h3>`;
  const desc = t.description ? `<p class="desc">${esc(t.description)}</p>` : "";
  const foot = `<footer class="card-foot">
      <span class="foot-meta">${meta}</span>
      <span class="readmore">See the breakdown <b>&rarr;</b></span>
    </footer>`;

  const attrs = `href="/topic/${esc(t.id)}" data-cat="${esc(t.category)}" style="--i:${index};--c:${cat.color}"`;

  if (featured) {
    return `<a class="card feature" ${attrs}>
      <div class="card-main">${head}${title}${desc}${foot}</div>
      <div class="card-viz">${viz}</div>
    </a>`;
  }
  return `<a class="card" ${attrs}>${head}${title}${desc}<div class="viz">${viz}</div>${foot}</a>`;
}

function renderLive(list: SiteTopic[]): string {
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

  // Feature the busiest question as the lead story once the feed is deep enough.
  let featured: SiteTopic | null = null;
  let rest = list;
  if (list.length >= 3) {
    featured = [...list].sort((a, b) => participation(b) - participation(a))[0];
    rest = list.filter((t) => t.id !== featured!.id);
  }

  const cards = list.length
    ? (featured ? renderCard(featured, 0, true) : "") +
      rest.map((t, i) => renderCard(t, i + 1)).join("")
    : `<p class="novotes">No questions yet.</p>`;

  const cats = Array.from(new Set(list.map((t) => t.category)));
  const chips = [
    `<button class="chip on" data-cat="all" type="button">All</button>`,
    ...cats.map((c) => {
      const cfg = CATEGORY_CONFIG[c] ?? CATEGORY_CONFIG.other;
      return `<button class="chip" data-cat="${esc(c)}" type="button" style="--c:${cfg.color}">${esc(cfg.label)}</button>`;
    }),
  ].join("");

  return `${stats}${meter}${list.length > 1 ? `<div class="chips">${chips}</div>` : ""}<div class="grid">${cards}</div>`;
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
<meta property="og:url" content="https://askopinion.app${esc(o.path)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%23070a14'/%3E%3Cpath d='M50 8 A42 42 0 0 1 50 92 A21 21 0 0 1 50 50 A21 21 0 0 0 50 8 Z' fill='%2300d68f'/%3E%3Cpath d='M50 8 A42 42 0 0 0 50 92 A21 21 0 0 0 50 50 A21 21 0 0 1 50 8 Z' fill='%23ff4d5e'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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
      Opinion
    </a>
    <nav>
      <span class="live-dot"><i></i>LIVE</span>
      <a href="/"${resultsOn ? ' class="on"' : ""}>Results</a>
      <a href="/insights"${insightsOn ? ' class="on"' : ""}>Insights</a>
      <a href="${PLAY_URL}" class="nav-cta">Get the app</a>
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
    <span class="copy">Opinion — ask anything, vote on everything.</span>
  </div>
</footer>

<script>
(function () {
  var filter = "all";
  var rankSel = [];

  // Anonymous voter id: one vote per device. localStorage, with an in-memory
  // fallback for private mode where storage throws.
  function anonId() {
    try {
      var k = "opinion_anon_id";
      var v = localStorage.getItem(k);
      if (!v) {
        v = (Date.now().toString(36) + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 32);
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) {
      if (!window.__anon) window.__anon = (Date.now().toString(36) + Math.random().toString(36).slice(2) + "x").slice(0, 32);
      return window.__anon;
    }
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
    fetch("/api/topics/me/votes", { headers: { "x-anon-id": anonId() } })
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
    fetch(document.body.getAttribute("data-refresh") || "/", { headers: { accept: "text/html" } })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var next = doc.getElementById("live");
        var cur = document.getElementById("live");
        if (next && cur && next.innerHTML !== cur.innerHTML) cur.innerHTML = next.innerHTML;
        applyFilter();
        markMyVotes();
        updateRankUI();
        if (cb) cb();
      })
      .catch(function () { if (cb) cb(); });
  }

  function castVote(topicId, body) {
    setStatus("Saving your vote…");
    fetch("/api/topics/" + topicId + "/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-anon-id": anonId() },
      body: JSON.stringify(body)
    })
      .then(function (r) { if (!r.ok) throw new Error("vote failed"); return r.json(); })
      .then(function () { rankSel = []; refreshLive(function () { setStatus("✓ Your vote is in — thanks!"); }); })
      .catch(function () { setStatus("Couldn't save your vote. Please try again."); });
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    function closest(sel) { return t && t.closest ? t.closest(sel) : null; }

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

  markMyVotes();

  setInterval(function () {
    if (document.hidden) return;
    refreshLive();
  }, 45000);
})();
</script>

</body>
</html>`;
}

export function renderPage(list: SiteTopic[]): string {
  return shell({
    title: "Opinion — what people actually think",
    description: "Live results from the Opinion app: real polls, ratings and rankings, updating as people vote.",
    path: "/",
    hero: `<span class="eyebrow"><span class="live-dot"><i></i></span>Live opinion, as it happens</span>
      <h1>See what the world <span class="grad">actually thinks</span></h1>
      <p>Real questions. Real votes. Counted live as they come in — straight from the Opinion app. Tap any story to break down the data.</p>
      <div class="cta-row">
        <a class="cta cta-primary" href="${PLAY_URL}">Get it on Google Play</a>
        <a class="cta cta-ghost" href="/insights">Explore the data</a>
      </div>`,
    body: renderLive(list),
  });
}

/* -------------------------------------------------------------- topic page */

function renderComments(comments: SiteComment[]): string {
  if (comments.length === 0) return `<p class="novotes">No comments yet — the conversation starts in the app.</p>`;
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
  const author = t.createdByName ?? "Opinion";
  const tags = (t.hashtags ?? []).slice(0, 6);
  const demo = renderDemoPanel(t);

  const body = `
    <section class="analysis" style="--i:0">
      <h2 class="sec-h">Cast your vote</h2>
      ${renderVoteWidget(t)}
    </section>
    ${
      demo
        ? `<section class="analysis" style="--i:1">
            <h2 class="sec-h">Who voted</h2>
            <div class="panel">${demo}</div>
          </section>`
        : ""
    }
    ${tags.length ? `<div class="tags">${tags.map((h) => `<span>#${esc(h)}</span>`).join("")}</div>` : ""}
    <section class="analysis" style="--i:2">
      <h2 class="sec-h">Comments${t.commentCount ? " · " + fmt(t.commentCount) : ""}</h2>
      ${renderComments(comments)}
    </section>
    <div class="detail-cta">
      <div><strong>Cast your vote</strong><span>Join in and see the results move — in the Opinion app.</span></div>
      <a class="cta cta-primary" href="${PLAY_URL}">Get it on Google Play</a>
    </div>`;

  return shell({
    title: `${t.title} — Opinion`,
    description: t.description || `Live results for "${t.title}" on Opinion.`,
    path: `/topic/${t.id}`,
    heroClass: "hero-topic",
    hero: `<a class="back" href="/">&larr; All results</a>
      <div><span class="cat cat-lg" style="--c:${cat.color}"><i></i>${esc(cat.label)}</span></div>
      <h1 class="topic-h1">${esc(t.title)}</h1>
      ${t.description ? `<p class="topic-desc">${esc(t.description)}</p>` : ""}
      <div class="topic-meta">
        <span>${fmt(part)} ${part === 1 ? "vote" : "votes"}</span>
        <span>${TYPE_LABEL[t.votingType] ?? t.votingType}</span>
        <span>${formatDate(t.createdAt)}</span>
        <span>by ${esc(author)}</span>
      </div>`,
    body,
  });
}

export function renderNotFound(): string {
  return shell({
    title: "Not found — Opinion",
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
    title: "Opinion — insights",
    description: "What the numbers say across every question on Opinion: consensus, divisions, and who is voting.",
    path: "/insights",
    hero: `<h1>The <span class="grad">bigger picture</span></h1>
      <p>Every question on Opinion, read together — where people agree, where they split, and who is doing the voting.</p>`,
    body: list.length
      ? stats + sections.join("")
      : `<p class="novotes">No questions yet — insights appear once people start voting.</p>`,
  });
}
