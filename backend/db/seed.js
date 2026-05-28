import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import db from "./connection.js";
import { runMigrations } from "./migrate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const seedsDir = path.join(__dirname, "seeds");

function runSeeds() {
  // Keep seed execution safe even on a fresh database.
  runMigrations();

  const files = fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(seedsDir, file), "utf8");
    db.exec(sql);
  }

  return files;
}

if (process.argv[1] === __filename) {
  const files = runSeeds();
  console.log(`Seed complete. Executed ${files.length} seed file(s).`);
}

export { runSeeds };
