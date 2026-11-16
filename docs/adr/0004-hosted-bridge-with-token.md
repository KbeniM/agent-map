# 0004. A bridge may be hosted, behind a bearer token

Partly supersedes ADR-0001's "loopback only". Cloud sessions (Claude Code on the web, CI agents, other machines) cannot reach a bridge on the user's laptop, so a bridge can also run on a public host and receive hook payloads there.

- Off loopback the bridge refuses to start without `AGENT_MAP_TOKEN`. Every `/v1` route except `/v1/health` requires `Authorization: Bearer <token>` (Hono `bearerAuth`).
- The web app can follow several bridges at once (a local one and a hosted one) and merges their graphs. Each bridge has its own URL and token in the browser's preferences.
- The stream is read with `fetch` instead of `EventSource`, because `EventSource` cannot send the header. A token in the query string was rejected: it ends up in logs.

Considered: a relay service that every bridge pushes to (one more moving part), per-user accounts (no need for a single-user tool).
