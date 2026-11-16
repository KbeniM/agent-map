# agent-map

A live 3D map of your coding-agent sessions: every session, agent and subagent, who spawned whom, the messages between them and the tool calls running right now. Claude Code, Codex, Cursor, GitHub Copilot CLI, Gemini CLI, Grok Build, Antigravity, OpenCode, Cline and Windsurf, plus anything that posts events.

## Local

```sh
bun install
cp .env.example .env
bun run dev        # bridge on :4000, map on :5173
bun run demo       # optional: a synthetic multi-agent session
```

Claude Code and Codex sessions on this machine appear on their own. Other harnesses: open **Settings → Harnesses → Set up** for the exact hook config.

## Hosted (cloud sessions)

```sh
AGENT_MAP_TOKEN=$(openssl rand -hex 32) docker compose up -d   # serves the map and the bridge on :4000
```

Point cloud sessions' hooks at it (Claude Code on the web runs the repository's committed `.claude/settings.json` hooks), then add the hosted bridge with its token in **Settings → Bridges**. Docs: [`CLAUDE.md`](CLAUDE.md) maps them.
