# 0002. Read Claude Code from its transcripts, not from hooks

Claude Code writes every session to `~/.claude/projects/<project>/<session>.jsonl` and each subagent to `<session>/subagents/agent-<id>.jsonl`, with `agent-<id>.meta.json` naming the agent type and the spawning tool call (`toolUseId`). The adapter polls these files every second and reads only new bytes.

Transcripts need no setup in Claude Code, include history from before the bridge started, and already link subagents to the tool call that spawned them. HTTP hooks (`type: "http"`) would add lower latency but need a settings change in every project and miss history.

The poll interval and the 24-hour replay window (`SINCE_HOURS`) are the trade-offs. Switch to `fs.watch` or hooks when the poll cost or one-second delay shows.
