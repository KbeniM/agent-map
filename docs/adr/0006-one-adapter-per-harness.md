# 0006. One adapter per harness, through whatever the harness documents

Every harness exposes activity differently, and most do not document a transcript format. Each adapter uses the most reliable documented surface, verified against the vendor's docs or source (see `docs/research/harness-formats.md`):

| Harness | Surface |
| --- | --- |
| Claude Code | transcripts (`~/.claude/projects`) and HTTP hooks |
| Codex | rollout JSONL (`~/.codex/sessions`) and command hooks |
| Cursor, Gemini CLI, Grok Build, Antigravity, Windsurf, Cline | command hooks through the `agent-map-hook` forwarder |
| GitHub Copilot CLI | command hooks; the event name travels as `?event=` because the payload lacks it |
| OpenCode | a plugin that forwards bus events |

Not built, because nothing machine-readable is documented: Kiro (payloads for most triggers), Amp (thread storage, plugin location), Roo Code (no hooks). Gemini CLI's chat files and OpenCode's SQLite store were skipped for undocumented patch lines and columns.

Hooks without a tool call id are paired first-in, first-out per session and tool name (`fifoPairing`); a lost post event leaves one stale pairing. Claude Code and Codex SubagentStart hooks do not name the spawning call, so the oldest open spawn call is used.
