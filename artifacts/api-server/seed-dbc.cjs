/**
 * Seed the "Best Death By Chocolate in Bengaluru" multiple-choice poll.
 * Run from artifacts/api-server (so `pg` resolves):
 *   $env:MIGRATE_DB_URL = "<your DATABASE_PUBLIC_URL>"
 *   node seed-dbc.cjs
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
  title: "Best place for Death By Chocolate in Bengaluru?",
  description: "8 famous DBCs. One choice. Vote for the city's best — real numbers, no brand bias.",
  category: "food",
  votingType: "choice",
  hashtags: ["bengaluru", "dbc", "deathbychocolate", "icecream", "namma"],
  // single-select options live in ranking_options; tallies accumulate in ranking_votes
  options: [
    { id: "corner-house", label: "Corner House" },
    { id: "polar-bear", label: "Polar Bear" },
    { id: "lakeview", label: "Lakeview Milk Bar" },
    { id: "cream-stone", label: "Cream Stone" },
    { id: "art-of-delight", label: "Art of Delight" },
    { id: "apsara", label: "Apsara Ice Creams" },
    { id: "frozen-bottle", label: "Frozen Bottle" },
    { id: "stoned-monkey", label: "Stoned Monkey" },
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
          "seed-opinion", "Opinion",
          JSON.stringify({}), JSON.stringify({}), JSON.stringify({}),
        ]
      );
      console.log("Added poll.");
    }
    console.log("\nPoll link:");
    console.log("  https://askopinion.app/topic/" + id);
    console.log("\nTopic id (for SITE_FEATURED_TOPIC_IDS if you want it on the homepage):");
    console.log("  " + id);
  } catch (e) {
    console.error("Seed failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
