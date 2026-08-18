// Mirrors mobile/constants/colors.ts (dark) and mobile/constants/categories.ts so
// the site and the app read as one product.
const C = {
  bg: "#000000",
  card: "#16181c",
  border: "#2f3336",
  muted: "#202327",
  fg: "#e7e9ea",
  dim: "#71767b",
  primary: "#1d9bf0",
  yes: "#00ba7c",
  no: "#f4212e",
  star: "#ffd400",
};

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
          ${bar(width, i === 0 ? C.primary : "#3a5f78", C.muted, 6)}
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

function renderDemographics(t: SiteTopic): string {
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

  return `<details class="demo">
    <summary>Who voted</summary>
    ${fields
      .map(([field, buckets]) => {
        const entries = Object.entries(buckets)
          .filter(([, n]) => n > 0)
          .sort((a, b) => b[1] - a[1]);
        const total = entries.reduce((sum, [, n]) => sum + n, 0);
        return `<div class="demo-field">
          <span class="demo-name">${esc(FIELD_LABEL[field] ?? field)}</span>
          <div class="demo-bars">${entries
            .map(
              ([bucket, n]) => `<div class="demo-row">
                <span class="demo-bucket">${esc(bucket)}</span>
                ${bar(Math.round((n / total) * 100), C.primary, C.muted, 5)}
                <span class="demo-n">${Math.round((n / total) * 100)}%</span>
              </div>`,
            )
            .join("")}</div>
        </div>`;
      })
      .join("")}
  </details>`;
}

function renderCard(t: SiteTopic, index: number): string {
  const cat = CATEGORY_CONFIG[t.category] ?? CATEGORY_CONFIG.other;
  const viz =
    t.votingType === "yesno"
      ? renderYesNo(t)
      : t.votingType === "rating"
        ? renderRating(t)
        : t.votingType === "ranking"
          ? renderRanking(t)
          : renderAspects(t);

  const author = t.createdByName ?? "Opinion";
  const tags = (t.hashtags ?? []).slice(0, 4);

  return `<article class="card" data-cat="${esc(t.category)}" style="--i:${index}">
    <header class="card-top">
      <span class="cat" style="--c:${cat.color}"><i></i>${esc(cat.label)}</span>
      <span class="type">${esc(TYPE_LABEL[t.votingType] ?? t.votingType)}</span>
      ${t.topicNumber ? `<span class="num">#${t.topicNumber}</span>` : ""}
    </header>
    <h3>${esc(t.title)}</h3>
    ${t.description ? `<p class="desc">${esc(t.description)}</p>` : ""}
    <div class="viz">${viz}</div>
    ${tags.length ? `<div class="tags">${tags.map((h) => `<span>#${esc(h)}</span>`).join("")}</div>` : ""}
    ${renderDemographics(t)}
    ${
      t.latestComment
        ? `<blockquote class="quote">${esc(t.latestComment.text)}<cite>${esc(t.latestComment.authorName ?? "Anonymous")}</cite></blockquote>`
        : ""
    }
    <footer class="card-foot">
      <span>${esc(author)}</span>
      <span>${t.commentCount === 1 ? "1 comment" : fmt(t.commentCount) + " comments"}</span>
      <span>${formatDate(t.createdAt)}</span>
    </footer>
  </article>`;
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

  const cards = list.length
    ? list.map(renderCard).join("")
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
  body: string;
}

function shell(o: ShellOptions): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<meta name="theme-color" content="#000000">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://askopinion.app${esc(o.path)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ccircle cx='50' cy='50' r='48' fill='%23000'/%3E%3Cpath d='M50 8 A42 42 0 0 1 50 92 A21 21 0 0 1 50 50 A21 21 0 0 0 50 8 Z' fill='%2300ba7c'/%3E%3Cpath d='M50 8 A42 42 0 0 0 50 92 A21 21 0 0 0 50 50 A21 21 0 0 1 50 8 Z' fill='%23f4212e'/%3E%3C/svg%3E">
<style>
  *, *::before, *::after { box-sizing: border-box; }
  :root {
    --bg: ${C.bg}; --card: ${C.card}; --border: ${C.border}; --muted: ${C.muted};
    --fg: ${C.fg}; --dim: ${C.dim}; --primary: ${C.primary};
    --yes: ${C.yes}; --no: ${C.no}; --star: ${C.star};
  }
  body {
    margin: 0; background: var(--bg); color: var(--fg);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    line-height: 1.5; -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 20px; }

  /* header */
  .top {
    position: sticky; top: 0; z-index: 10;
    background: rgba(0,0,0,.72); backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .top .wrap { display: flex; align-items: center; gap: 12px; height: 60px; }
  .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 19px; letter-spacing: -.4px; }
  .top nav { margin-left: auto; display: flex; align-items: center; gap: 18px; }
  .top nav a { color: var(--dim); text-decoration: none; font-size: 14px; }
  .top nav a:hover { color: var(--fg); }
  .live-dot { display: inline-flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 700; color: var(--yes); letter-spacing: .4px; }
  .live-dot i { width: 7px; height: 7px; border-radius: 50%; background: var(--yes); animation: pulse 2.4s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.8); } }

  /* hero */
  .hero { padding: 68px 0 16px; text-align: center; position: relative; overflow: hidden; }
  .hero::before {
    content: ""; position: absolute; inset: -40% 0 auto; height: 420px; pointer-events: none;
    background: radial-gradient(ellipse at 50% 50%, rgba(29,155,240,.16), transparent 62%);
  }
  .hero > * { position: relative; }
  .hero h1 { font-size: clamp(34px, 6vw, 58px); line-height: 1.05; letter-spacing: -1.8px; margin: 20px 0 0; font-weight: 800; }
  .hero h1 .grad { background: linear-gradient(94deg, var(--yes), var(--primary) 55%, var(--no)); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .hero p { color: var(--dim); font-size: 17px; max-width: 520px; margin: 16px auto 0; }
  .badge {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 26px;
    background: var(--card); border: 1px solid var(--border); border-radius: 100px;
    padding: 9px 18px; color: var(--primary); font-weight: 600; font-size: 14px;
  }

  /* stats */
  .stats { display: flex; flex-wrap: wrap; gap: 12px; margin: 34px 0 16px; }
  .stat {
    flex: 1 1 160px; background: var(--card); border: 1px solid var(--border);
    border-radius: 16px; padding: 18px 20px;
  }
  .stat-n { display: block; font-size: 30px; font-weight: 800; letter-spacing: -1px; font-variant-numeric: tabular-nums; }
  .stat-l { display: block; color: var(--dim); font-size: 13px; margin-top: 2px; }

  /* consensus meter */
  .consensus { background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; margin-bottom: 32px; }
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
  .chip.on { background: var(--c, var(--primary)); border-color: var(--c, var(--primary)); color: #fff; }

  /* cards */
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; align-items: start; }
  .card {
    background: var(--card); border: 1px solid var(--border); border-radius: 18px;
    padding: 20px; transition: border-color .2s, transform .2s;
  }
  .card:hover { border-color: #3d4247; transform: translateY(-2px); }
  .card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .cat {
    display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700;
    color: var(--c); background: color-mix(in srgb, var(--c) 15%, transparent);
    border-radius: 100px; padding: 4px 10px;
  }
  .cat i { width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
  .type { font-size: 11.5px; color: var(--dim); background: var(--muted); border-radius: 100px; padding: 4px 10px; }
  .num { margin-left: auto; font-size: 11.5px; color: var(--dim); font-weight: 700; }
  .card h3 { margin: 0 0 6px; font-size: 18px; font-weight: 800; letter-spacing: -.4px; line-height: 1.28; }
  .desc { margin: 0 0 16px; color: var(--dim); font-size: 13.5px; }
  .viz { margin-top: 14px; }

  /* bars */
  .track { background: var(--track); border-radius: 100px; height: var(--h); overflow: hidden; }
  .fill { height: 100%; width: var(--w); background: var(--c); border-radius: 100px; }
  .legend { display: flex; gap: 16px; margin-top: 10px; font-size: 12.5px; color: var(--dim); font-variant-numeric: tabular-nums; }
  .legend i { display: inline-block; width: 8px; height: 8px; border-radius: 2px; margin-right: 6px; }

  /* verdict */
  .verdict { display: flex; align-items: center; gap: 14px; margin-bottom: 14px; }
  .big { font-size: 46px; font-weight: 800; letter-spacing: -2.5px; color: var(--c); line-height: 1; font-variant-numeric: tabular-nums; }
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
  .rank-top { background: color-mix(in srgb, var(--primary) 22%, transparent); color: var(--primary); }
  .rank-body { flex: 1; min-width: 0; }
  .rank-label { display: block; font-size: 13.5px; margin-bottom: 5px; }
  .rank-avg { flex: none; font-size: 12px; color: var(--dim); font-variant-numeric: tabular-nums; }

  /* aspects */
  .aspects { list-style: none; margin: 0; padding: 0; display: grid; gap: 9px; }
  .aspects li { display: grid; grid-template-columns: 84px 1fr 38px; align-items: center; gap: 10px; }
  .aspect-label { font-size: 12.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .aspect-pct { font-size: 12px; text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .aspect-none { color: var(--dim); font-size: 12px; }

  /* extras */
  .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; }
  .tags span { font-size: 11.5px; color: var(--primary); }
  .demo { margin-top: 14px; border-top: 1px solid var(--border); padding-top: 12px; }
  .demo summary { cursor: pointer; font-size: 12.5px; color: var(--dim); font-weight: 600; }
  .demo summary::marker { color: var(--dim); }
  .demo-field { margin-top: 12px; }
  .demo-name { font-size: 11px; text-transform: uppercase; letter-spacing: .6px; color: var(--dim); font-weight: 700; }
  .demo-bars { display: grid; gap: 6px; margin-top: 7px; }
  .demo-row { display: grid; grid-template-columns: 74px 1fr 34px; align-items: center; gap: 9px; }
  .demo-bucket { font-size: 12px; color: var(--fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .demo-n { font-size: 11.5px; color: var(--dim); text-align: right; font-variant-numeric: tabular-nums; }
  .quote {
    margin: 14px 0 0; padding: 11px 14px; background: var(--muted); border-radius: 12px;
    font-size: 13px; color: var(--fg);
  }
  .quote cite { display: block; margin-top: 6px; font-size: 11.5px; color: var(--dim); font-style: normal; }
  .card-foot {
    display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; padding-top: 12px;
    border-top: 1px solid var(--border); font-size: 11.5px; color: var(--dim);
  }
  .card-foot span:last-child { margin-left: auto; }

  /* insights */
  .top nav a.on { color: var(--fg); font-weight: 700; }
  .ins { margin-top: 44px; }
  .ins h2 { font-size: 22px; font-weight: 800; letter-spacing: -.6px; margin: 0 0 4px; }
  .lede { color: var(--dim); font-size: 14px; margin: 0 0 18px; max-width: 620px; }

  .callouts { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; }
  .callout {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px;
    padding: 18px 20px; display: flex; flex-direction: column; gap: 2px;
  }
  .callout-label { font-size: 11px; text-transform: uppercase; letter-spacing: .7px; color: var(--dim); font-weight: 700; }
  .callout-value { font-size: 30px; font-weight: 800; letter-spacing: -1.2px; font-variant-numeric: tabular-nums; margin: 4px 0 2px; }
  .callout-title { font-size: 14.5px; font-weight: 600; line-height: 1.35; }
  .callout-sub { font-size: 12.5px; color: var(--dim); margin-top: 3px; }

  .spectrum, .catrows, .board, .picks {
    background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 8px 18px;
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

  .picks { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 0; padding: 0; }
  .pick { padding: 18px 20px; border-right: 1px solid var(--border); display: flex; flex-direction: column; gap: 3px; }
  .pick:last-child { border-right: none; }
  .pick-q { font-size: 12.5px; color: var(--dim); }
  .pick-winner { font-size: 19px; font-weight: 800; letter-spacing: -.5px; color: var(--primary); }
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
  .card, .stat, .consensus {
    animation: rise .5s cubic-bezier(.22,.8,.3,1) both;
    animation-delay: calc(var(--i, 0) * 55ms);
  }
  .fill, .stars-fg { animation: grow .9s cubic-bezier(.22,.8,.3,1) .15s both; }
  @media (prefers-reduced-motion: reduce) {
    .card, .stat, .consensus, .fill, .stars-fg { animation: none; }
    .live-dot i { animation: none; }
  }
  /* Narrow screens: let the label and bar each take a full row, then sit the
     numbers side by side underneath. */
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
    .hero { padding: 48px 0 28px; }
    .top nav { gap: 14px; }
    .top nav a.hide-sm { display: none; }
    .grid { grid-template-columns: 1fr; }
  }
</style>
</head>
<body data-refresh="${esc(o.path)}">

<header class="top">
  <div class="wrap">
    <span class="brand">
      <svg width="26" height="26" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="46" fill="#16181c" stroke="#2f3336"/>
        <path d="M50 8 A42 42 0 0 1 50 92 A21 21 0 0 1 50 50 A21 21 0 0 0 50 8 Z" fill="${C.yes}"/>
        <path d="M50 8 A42 42 0 0 0 50 92 A21 21 0 0 0 50 50 A21 21 0 0 1 50 8 Z" fill="${C.no}"/>
        <circle cx="50" cy="29" r="8" fill="#000"/>
        <circle cx="50" cy="71" r="8" fill="#000"/>
      </svg>
      Opinion
    </span>
    <nav>
      <span class="live-dot"><i></i>LIVE</span>
      <a href="/"${o.path === "/" ? ' class="on"' : ""}>Results</a>
      <a href="/insights"${o.path === "/insights" ? ' class="on"' : ""}>Insights</a>
      <a href="/privacy" class="hide-sm">Privacy</a>
    </nav>
  </div>
</header>

<main>
  <section class="hero">
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

  function applyFilter() {
    var cards = document.querySelectorAll(".card");
    for (var i = 0; i < cards.length; i++) {
      var show = filter === "all" || cards[i].getAttribute("data-cat") === filter;
      cards[i].style.display = show ? "" : "none";
    }
    // Chips are re-rendered by the live refresh, so re-mark the active one.
    var chips = document.querySelectorAll(".chip");
    var matched = false;
    for (var j = 0; j < chips.length; j++) {
      var on = chips[j].getAttribute("data-cat") === filter;
      chips[j].classList.toggle("on", on);
      if (on) matched = true;
    }
    // The filtered category disappeared from the feed — fall back to All.
    if (!matched && filter !== "all") {
      filter = "all";
      applyFilter();
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target;
    var chip = el && el.closest ? el.closest(".chip") : null;
    if (!chip) return;
    filter = chip.getAttribute("data-cat");
    applyFilter();
  });

  // Keep the numbers honest without a full reload: re-render the live section
  // from the server, but only when something actually changed.
  setInterval(function () {
    if (document.hidden) return;
    fetch(document.body.getAttribute("data-refresh") || "/", { headers: { accept: "text/html" } })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var next = doc.getElementById("live");
        var cur = document.getElementById("live");
        if (!next || !cur || next.innerHTML === cur.innerHTML) return;
        // Replacing the nodes restarts the CSS entrance animations for free.
        cur.innerHTML = next.innerHTML;
        applyFilter();
      })
      .catch(function () {});
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
    hero: `<h1>What people <span class="grad">actually think</span></h1>
      <p>Real questions, real votes, counted as they come in. This is the live result feed from the Opinion app.</p>
      <span class="badge">Coming soon to Google Play</span>`,
    body: renderLive(list),
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
        (TYPE_LABEL[busiest.votingType] ?? busiest.votingType) + " — the busiest question", C.primary)}
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
