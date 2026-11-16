import { createApp } from "./app";
import { env } from "./env";
import { publish } from "./events/log";
import { watchClaudeCode } from "./harness/watch";

const claude = watchClaudeCode(env.CLAUDE_PROJECTS_DIR, env.SINCE_HOURS, publish);

const app = createApp(claude.status);

// why: the bridge serves tool activity from this machine, so it only listens on loopback
export default { port: env.BRIDGE_PORT, hostname: "127.0.0.1", fetch: app.fetch };
