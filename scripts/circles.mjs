import { readFile } from "node:fs/promises";
import postgres from "postgres";

const databaseUrl = process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.log("MemeLab Circles skipped: POSTGRES_URL is not available.");
  process.exit(0);
}

const sql = postgres(databaseUrl, { max: 1, prepare: false, ssl: "require" });
const migration = await readFile(new URL("./circles.sql", import.meta.url), "utf8");

await sql.unsafe(migration);
await sql.end();
console.log("MemeLab Circles are ready.");
