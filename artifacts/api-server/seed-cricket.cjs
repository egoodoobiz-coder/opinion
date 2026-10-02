/**
 * Seed the starter cricket polls into production.
 * Run from artifacts/api-server (so `pg` resolves):
 *   $env:MIGRATE_DB_URL = "<your DATABASE_PUBLIC_URL>"
 *   node seed-cricket.cjs
 * Idempotent: skips any poll whose exact title already exists.
 */
const { Pool } = require("pg");
const crypto = require("crypto");

const url = process.env.MIGRATE_DB_URL;
if (!url) {
  console.error("Set MIGRATE_DB_URL first:  $env:MIGRATE_DB_URL = \"...\"");
  process.exit(1);
}

const CRICKET = [
  {
    title: "Is Virat Kohli the GOAT, ahead of Sachin Tendulkar?",
    description: "The eternal debate. Chase master vs the little master — who's the real GOAT?",
    category: "sports", votingType: "yesno",
    hashtags: ["cricket", "kohli", "sachin", "goat"],
  },
  {
    title: "Rank the greatest IPL franchises of all time",
    description: "Trophies, consistency, drama — put them in order.",
    category: "sports", votingType: "ranking",
    hashtags: ["cricket", "ipl", "csk", "mi", "rcb"],
    rankingOptions: [
      { id: "csk", label: "Chennai Super Kings" },
      { id: "mi", label: "Mumbai Indians" },
      { id: "rcb", label: "Royal Challengers Bengaluru" },
      { id: "kkr", label: "Kolkata Knight Riders" },
      { id: "srh", label: "Sunrisers Hyderabad" },
    ],
  },
  {
    title: "Rate Rohit Sharma's captaincy",
    description: "Hitman as skipper — how would you rate him out of 5?",
    category: "sports", votingType: "rating",
    hashtags: ["cricket", "rohitsharma", "captaincy", "teamindia"],
  },
  {
    title: "Is the IPL hurting Test cricket?",
    description: "Big money, packed calendars — is the longest format paying the price?",
    category: "sports", votingType: "yesno",
    hashtags: ["cricket", "ipl", "testcricket"],
  },
  {
    title: "Rank India's best fast bowlers right now",
    description: "Pace, wickets, big-match nerve — who tops your list today?",
    category: "sports", votingType: "ranking",
    hashtags: ["cricket", "fastbowling", "bumrah", "teamindia"],
    rankingOptions: [
      { id: "bumrah", label: "Jasprit Bumrah" },
      { id: "siraj", label: "Mohammed Siraj" },
      { id: "shami", label: "Mohammed Shami" },
      { id: "arshdeep", label: "Arshdeep Singh" },
    ],
  },
  {
    title: "Should Test matches be cut to 4 days?",
    description: "Faster results and full stadiums, or tradition worth protecting?",
    category: "sports", votingType: "yesno",
    hashtags: ["cricket", "testcricket", "debate"],
  },
  {
    title: "Rate Team India right now",
    description: "Score the side across every department.",
    category: "sports", votingType: "aspects",
    hashtags: ["cricket", "teamindia"],
    aspects: ["Batting", "Bowling", "Fielding", "Captaincy", "Bench strength"],
  },
];

(async () => {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  let added = 0, skipped = 0;
  try {
    for (const t of CRICKET) {
      const existing = await pool.query("SELECT id FROM topics WHERE title = $1 LIMIT 1", [t.title]);
      if (existing.rowCount > 0) { skipped++; console.log("skip (exists): " + t.title); continue; }

      const aspectVotes = {};
      if (t.votingType === "aspects" && t.aspects) for (const a of t.aspects) aspectVotes[a] = { up: 0, down: 0 };

      await pool.query(
        `INSERT INTO topics
          (id, title, description, category, voting_type, ranking_options, aspects, hashtags,
           created_by, created_by_name, yes_count, no_count, total_rating, rating_count,
           ranking_votes, aspect_votes, demo_breakdown)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,0,0,$11,$12,$13)`,
        [
          crypto.randomUUID(), t.title, t.description, t.category, t.votingType,
          t.rankingOptions ? JSON.stringify(t.rankingOptions) : null,
          t.aspects ? JSON.stringify(t.aspects) : null,
          JSON.stringify(t.hashtags || []),
          "seed-cricket", "Opinion",
          JSON.stringify({}), JSON.stringify(aspectVotes), JSON.stringify({}),
        ]
      );
      added++; console.log("added: " + t.title);
    }
    const total = await pool.query("SELECT COUNT(*)::int AS n FROM topics");
    console.log(`\nDone. added=${added} skipped=${skipped}. Total topics now: ${total.rows[0].n}`);
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
