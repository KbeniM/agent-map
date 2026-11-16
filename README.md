# agent-map

A live 3D map of your coding-agent sessions: every session, agent and subagent, who spawned whom, and the tool calls running right now.

```sh
bun install
cp .env.example .env
bun run dev        # bridge on :4000, map on :5173
bun run demo       # optional: a synthetic multi-agent session
```

Claude Code sessions show up on their own: the bridge reads `~/.claude/projects`. Any other harness posts events to `POST /v1/events` (see the Connect page and `packages/shared/src/events.ts`).

Docs: [`CLAUDE.md`](CLAUDE.md) maps them.
