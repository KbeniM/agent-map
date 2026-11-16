import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { $ } from "bun";

// why: Tauri looks up an external binary by its name suffixed with the Rust target triple
const triple = (await $`rustc -vV`.text()).match(/^host: (\S+)$/m)?.[1];
if (!triple) throw new Error("rustc -vV printed no host triple; install Rust to build the desktop app");

const extension = process.platform === "win32" ? ".exe" : "";
const root = join(import.meta.dir, "..");
const out = join(root, "apps/desktop/src-tauri/binaries");
mkdirSync(out, { recursive: true });
await $`bun build ${join(root, "apps/api/src/index.ts")} --compile --minify --outfile ${join(out, `agent-map-bridge-${triple}${extension}`)}`;
