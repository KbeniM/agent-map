import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/events/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
});
