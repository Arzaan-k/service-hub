import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  out: path.join(__dirname, "migrations"),
  schema: path.join(__dirname, "shared", "schema.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
