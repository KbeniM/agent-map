import { homedir } from "node:os";
import { join } from "node:path";
import { z } from "zod";

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);

// why: .env files with `KEY=` set process.env.KEY to "", which otherwise bypasses Zod defaults
const nonEmpty = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const envSchema = z
  .object({
    HOST: nonEmpty(z.string().default("127.0.0.1")),
    BRIDGE_PORT: nonEmpty(z.coerce.number().int().default(4000)),
    WEB_ORIGIN: nonEmpty(z.string().default("http://localhost:5173")),
    RANCHER_TOKEN: z.string().default(""),
    DATA_DIR: nonEmpty(z.string().default(join(homedir(), ".rancher"))),
    STATIC_DIR: z.string().default(""),
    SINCE_HOURS: nonEmpty(z.coerce.number().int().positive().default(24)),
    RETENTION_DAYS: nonEmpty(z.coerce.number().int().positive().default(7)),
  })
  .transform((value) => ({
    ...value,
    origins: value.WEB_ORIGIN.split(",").map((origin) => origin.trim()),
    loopback: LOOPBACK.has(value.HOST),
  }));

export const parseEnv = (source: Record<string, string | undefined>) => envSchema.parse(source);
export const env = parseEnv(process.env);

// why: per-adapter path defaults come from the environment, e.g. CLAUDE_CODE_PATH for the claude-code adapter
export const pathFromEnv = (adapterId: string) => process.env[`${adapterId.toUpperCase().replaceAll("-", "_")}_PATH`];
