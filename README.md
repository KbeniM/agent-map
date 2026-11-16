# Agent Map

A live 3D map of your coding-agent sessions: every session, agent and subagent, who spawned whom, the messages between them and the tool calls running right now.

Works with Claude Code, Codex, Cursor, GitHub Copilot CLI, Gemini CLI, Grok Build, Antigravity, OpenCode, Cline and Windsurf, plus anything that can post JSON events. Open source under the MIT license.

## Run it

**Desktop app (Linux, macOS, Windows).** Take the build for your OS from the latest run of the Desktop workflow, or build it yourself with Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/):

```sh
bun install && bun run desktop:build   # bundles land in apps/desktop/src-tauri/target/release/bundle
```

**From source.**

```sh
bun install
cp .env.example .env
bun run dev        # bridge on :4000, map on :5173
```

**Hosted, for cloud sessions.**

```sh
AGENT_MAP_TOKEN=$(openssl rand -hex 32) docker compose up -d   # map and bridge on :4000
```

Claude Code and Codex sessions on the same machine show up on their own. For every other harness, open **Settings → Harnesses → Set up** for the exact hook configuration. Cloud sessions (Claude Code on the web) send hooks to a hosted bridge; add it with its token under **Settings → Bridges**.

## Docs

[`CLAUDE.md`](CLAUDE.md) maps the documentation. [`CONTRIBUTING.md`](CONTRIBUTING.md) explains how to work on it.
