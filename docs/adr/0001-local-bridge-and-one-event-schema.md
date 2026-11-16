# 0001. A local bridge and one event schema

The browser cannot read harness files, and every harness records agents differently. A small Bun + Hono **bridge** on `127.0.0.1` reads harnesses through adapters and streams one shared event schema (`packages/shared/src/events.ts`) over SSE. Harnesses without an adapter push the same events to `POST /v1/events`.

SSE over WebSockets: the stream is one-way, `EventSource` reconnects on its own and sends `Last-Event-ID`, so resuming needs no client code.

Considered: a hosted relay (needs auth and sends tool activity off the machine), WebSockets (two-way channel nobody needs), one schema per harness in the web app (every harness change becomes a UI change).
