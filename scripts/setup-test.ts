import { tmpdir } from "node:os";

process.env.NODE_ENV ??= "test";
process.env.WEB_ORIGIN ??= "http://localhost:5173";
process.env.CLAUDE_PROJECTS_DIR ??= `${tmpdir()}/agent-map-test-projects`;
process.env.SINCE_HOURS ??= "24";
