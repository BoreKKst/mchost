import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.js";

console.log("[migrate] applying migrations...");
migrate(db, { migrationsFolder: "./drizzle" });
console.log("[migrate] done.");
