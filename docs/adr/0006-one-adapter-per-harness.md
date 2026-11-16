# 0006. One adapter per harness, through whatever the harness documents

Every harness exposes activity differently, and most do not document a transcript format. Each adapter uses the most reliable documented surface, verified against the vendor's docs or source (see `docs/research/harness-formats.md`):

| Harness | Surface |
| --- | --- |
| T3 Code | SQLite WAL snapshot (`~/.t3/userdata/statev2.sqlite`) across all T3 providers |
| Claude Code | transcripts (`~/.claude/projects`) and HTTP hooks |
| Codex | rollout JSONL (`~/.codex/sessions`) and command hooks |
| Cursor | transcripts (`~/.cursor/projects`) and command hooks through `rancher-hook` |
| GitHub Copilot CLI | transcripts (`~/.copilot/session-state`) and command hooks (`?event=` because the payload lacks it) |
| Antigravity | transcripts (`~/.gemini/antigravity/brain`) and command hooks through `rancher-hook` |
| Gemini CLI, Grok Build, Windsurf, Cline | command hooks through the `rancher-hook` forwarder |
| OpenCode | a plugin that forwards bus events |

Not built, because nothing machine-readable is documented: Kiro (payloads for most triggers), Amp (thread storage, plugin location), Roo Code (no hooks). Gemini CLI's chat files and OpenCode's SQLite store were skipped for undocumented patch lines and columns.

Hooks without a tool call id are paired first-in, first-out per session and tool name (`fifoPairing`); a lost post event leaves one stale pairing. Claude Code and Codex SubagentStart hooks do not name the spawning call, so the oldest open spawn call is used.
