import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

export const env = z
  .object({
    HOST: z.string().default("127.0.0.1"),
    BRIDGE_PORT: z.coerce.number().int().default(4000),
    WEB_ORIGIN: z.string().default("http://localhost:5173"),
    AGENT_MAP_TOKEN: z.string().default(""),
    DATA_DIR: z.string().default(join(homedir(), ".agent-map")),
    STATIC_DIR: z.string().default(""),
    SINCE_HOURS: z.coerce.number().int().positive().default(24),
    RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  })
  .transform((value) => ({
    ...value,
    origins: value.WEB_ORIGIN.split(",").map((origin) => origin.trim()),
    loopback: LOOPBACK.has(value.HOST),
  }))
  .parse(process.env);

// why: per-adapter path defaults come from the environment, e.g. CLAUDE_CODE_PATH for the claude-code adapter
export const pathFromEnv = (adapterId: string) => process.env[`${adapterId.toUpperCase().replaceAll("-", "_")}_PATH`];
