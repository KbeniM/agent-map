# Auth and Security

Agent Map is a local developer tool. It has no accounts and no auth.

1. **Loopback only.** The bridge listens on `127.0.0.1`. Exposing it beyond the machine needs an ADR and an auth layer first.
2. **CORS.** Only `WEB_ORIGIN` may read the bridge from a browser.
3. **Minimal tool data.** A tool call carries its name and one summary field (`summarize` in `apps/api/src/harness/claude-code.ts`): the description, file path, pattern, command, URL, query or prompt, first line, at most 120 characters. Full inputs and outputs never leave the bridge.
4. **Messages.** Prompts, subagent tasks and agent replies cross the bridge as `message` events, text only, capped at 1000 characters. Thinking blocks, tool inputs and tool outputs do not.
5. **Untrusted text.** Titles, summaries, messages and names come from transcripts. React escapes them in panels; the map tooltip escapes them by hand because the graph library sets it as HTML.
6. **Validation.** Pushed events are parsed with the shared Zod schema; batches are capped at 1000 events.
