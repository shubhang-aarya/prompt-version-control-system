import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./connection.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, "migrations");

function ensureMigrationsTable() {
  db.prepare(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
}

function getAppliedMigrations() {
  const rows = db.prepare("SELECT filename FROM schema_migrations").all();
  return new Set(rows.map((row) => row.filename));
}

export function runMigrations() {
  ensureMigrationsTable();

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  const applied = getAppliedMigrations();
  const migrationInsert = db.prepare(
    "INSERT INTO schema_migrations (filename) VALUES (?)"
  );

  const appliedNow = [];

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");

    const transaction = db.transaction(() => {
      db.exec(sql);
      migrationInsert.run(file);
    });

    transaction();
    appliedNow.push(file);
  }

  return {
    appliedNow,
    totalKnown: files.length
  };
}

if (process.argv[1] === __filename) {
  const result = runMigrations();
  console.log(
    `Migrations complete. Applied ${result.appliedNow.length} of ${result.totalKnown} known migrations.`
  );
}
