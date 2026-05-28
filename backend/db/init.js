import { runMigrations } from "./migrate.js";

export function initDatabase() {
  const result = runMigrations();

  if (result.appliedNow.length > 0) {
    console.log(`Applied migrations: ${result.appliedNow.join(", ")}`);
  }
}
