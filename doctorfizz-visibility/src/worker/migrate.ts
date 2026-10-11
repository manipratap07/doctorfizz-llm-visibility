import { readFileSync } from "node:fs";
import { pool } from "../lib/db";
async function main() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(readFileSync("db/001.sql", "utf8"));
    await c.query("COMMIT");
    console.log("Schema ready.");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
