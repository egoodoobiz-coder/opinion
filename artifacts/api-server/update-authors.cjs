/**
 * Rebrand: update seed poll author name from "Opinion" to "Factinion".
 * Run from artifacts/api-server:
 *   $env:MIGRATE_DB_URL = "<your DATABASE_PUBLIC_URL>"
 *   node update-authors.cjs
 */
const { Pool } = require("pg");
const url = process.env.MIGRATE_DB_URL;
if (!url) { console.error('Set MIGRATE_DB_URL first: $env:MIGRATE_DB_URL = "..."'); process.exit(1); }

(async () => {
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    const r = await pool.query(
      "UPDATE topics SET created_by_name = 'Factinion' WHERE created_by_name = 'Opinion'"
    );
    console.log("Updated " + r.rowCount + " poll(s) author name -> Factinion");
  } catch (e) {
    console.error("Failed:", e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
