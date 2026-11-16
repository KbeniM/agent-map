# Auth and Security

Rancher has no user accounts. A bridge is either local or hosted (ADR-0004).

1. **Local by default.** The bridge listens on `127.0.0.1`. With `HOST` set to anything else it refuses to start unless `RANCHER_TOKEN` is set.
2. **Bearer token.** With a token, every `/v1` route except `/v1/health` needs `Authorization: Bearer <token>` (`apps/api/tests/http/routes.test.ts` keeps a table of every route). Hooks send it from an environment variable (`RANCHER_TOKEN`), never inline in a committed file.
3. **Browser storage.** The web app keeps bridge URLs and tokens in `localStorage` for the bridges it follows. Treat a shared browser profile as able to read them.
4. **CORS.** Only the origins in `WEB_ORIGIN` (comma-separated) may call the bridge from a browser. A bridge serving the app itself (`STATIC_DIR`) is same-origin.
5. **Minimal tool data.** A tool call carries its name and one summary field (`summarize` in `apps/api/src/harness/claude-code.ts`), first line, at most 120 characters. Full inputs and outputs never leave the adapter.
6. **Messages.** Prompts, subagent tasks and replies cross as `message` events, text only, capped at 1000 characters. Thinking blocks do not.
7. **Untrusted text.** Titles, summaries, messages and names come from harnesses. React escapes them in panels; the map tooltip escapes them by hand because the graph library sets it as HTML.
8. **Validation and limits.** Every body is parsed with a shared Zod schema; bodies are capped at 5 MB and batches at 1000 events. Hook payloads failing their adapter's schema are a 400.
9. **Removal.** `DELETE /v1/sessions/:id` deletes a session's events and blocks the id from returning when transcripts are re-read.
