import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const env = z
  .object({
    BRIDGE_PORT: z.coerce.number().int().default(4000),
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    CLAUDE_PROJECTS_DIR: z.string().default(""),
    SINCE_HOURS: z.coerce.number().positive().default(24),
  })
  .transform((value) => ({
    ...value,
    CLAUDE_PROJECTS_DIR: value.CLAUDE_PROJECTS_DIR || join(homedir(), ".claude", "projects"),
  }))
  .parse(process.env);
