/**
 * Seed the "Why is Starlink's India launch stuck?" multiple-choice poll (Oct 2026).
 * Run from artifacts/api-server (so `pg` resolves):
 *   $env:MIGRATE_DB_URL = "<your DATABASE_PUBLIC_URL>"
 *   node seed-starlink.cjs
 * Idempotent: if the poll already exists it just prints its link.
 */
const { Pool } = require("pg");
const crypto = require("crypto");

const url = process.env.MIGRATE_DB_URL;
if (!url) {
  console.error('Set MIGRATE_DB_URL first:  $env:MIGRATE_DB_URL = "..."');
  process.exit(1);
}

const POLL = {
  title: "Why is Starlink's India launch stuck?",
  description:
    "Musk blames \"oligarchs\" and has named Mukesh Ambani. The Telecom Ministry says the process is fair and three companies are at the same stage. Starlink says it has built 20 gateways and is ready. What's really holding it up?",
  category: "tech",
  votingType: "choice",
  hashtags: ["starlink", "elonmusk", "satelliteinternet", "india", "jio", "airtel"],
  // single-select options live in ranking_options; tallies accumulate in ranking_votes
  options: [
    { id: "security", label: "Genuine security & data checks" },
    { id: "red-tape", label: "Spectrum pricing & approval red tape" },
    { id: "protect-incumbents", label: "Protecting Jio & Airtel" },
    { id: "musk-pressure", label: "Musk pushing too hard / politics" },
    { id: "mix", label: "A mix of all of these" },
  ],
};

(async () => {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    const existing = await pool.query("SELECT id FROM topics WHERE title = $1 LIMIT 1", [POLL.title]);
    let id;
    if (existing.rowCount > 0) {
      id = existing.rows[0].id;
      console.log("Already exists — skipping insert.");
    } else {
      id = crypto.randomUUID();
      await pool.query(
        `INSERT INTO topics
          (id, title, description, category, voting_type, ranking_options, aspects, hashtags,
           created_by, created_by_name, yes_count, no_count, total_rating, rating_count,
           ranking_votes, aspect_votes, demo_breakdown)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,0,0,0,0,$11,$12,$13)`,
        [
          id, POLL.title, POLL.description, POLL.category, POLL.votingType,
          JSON.stringify(POLL.options), null, JSON.stringify(POLL.hashtags),
          "seed-opinion", "Factinion",
          JSON.stringify({}), JSON.stringify({}), JSON.stringify({}),
        ]
      );
      console.log("Added poll.");
    }
    console.log("\nPoll link:");
    console.log("  https://factinion.com/topic/" + id);
    console.log("\nTopic id:");
    console.log("  " + id);
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
