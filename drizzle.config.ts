import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL ?? "file:./data/snatcharr.db";

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./lib/db/migrations",
  dialect: dbUrl.startsWith("file:") ? "sqlite" : "postgresql",
  dbCredentials: dbUrl.startsWith("file:") ? { url: dbUrl } : { url: dbUrl },
  verbose: true,
  strict: true,
});
