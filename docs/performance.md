# Performance

Measured 2026-11-17 on Windows 11, Bun 1.4.4, Chromium from Playwright 1.65 on an RTX 4060 Ti (ANGLE D3D11). The data set is synthetic: 100 sessions, each with a main agent and 4 subagents making 200 tool calls each, 206,400 events in total.

## How to measure

| Command | Measures |
| --- | --- |
| `bun scripts/bench.ts` | Bridge ingest, SSE replay, reducer, merge and `toMap` in Bun |
| `bun scripts/bench.ts --seed <dir>` | Writes the data set to `<dir>/events.db` for the browser run |
| `VITE_BRIDGE_URL=http://127.0.0.1:4300 bunx vite build --outDir <dist>` (in `apps/web`) | The app build the browser run serves |
| `bun scripts/perf.ts <dist> <dir>` | Starts a bridge on `:4300` with the seeded data and records load, 5 s idle, and 10 s of live events (100 events/s) with and without the session panel |

`perf.ts` counts long tasks, frame times, WebGL draw calls and React component renders, and reads the heap after a forced collection. `PERF_PROFILE=1` prints the hottest functions of the live phase (build with `--minify false` for names). `PERF_SWIFTSHADER=1` runs without a GPU; SwiftShader makes each frame cost seconds, so frame numbers there are not comparable.

## Bridge and reducer (`bench.ts`)

| Stage | Before | After |
| --- | --- | --- |
| One live event through the reducer (mean of 1,000 frames) | 15.1 ms | 0.16 ms |
| Replay full history through the reducer | 1,574 ms | 230 ms |
| Merge one bridge's graph | 13 ms | 0 ms |
| `toMap` | 32 ms | 12–32 ms (noisy) |
| SSE replay of 38 MB history, read and parsed by the client | ~1,960 ms | 468 ms |
| Ingest 20,640 events into an on-disk database | 38,139 ms | 338 ms |
| Ingest 206,400 events into an in-memory database | 3,372 ms | 2,237 ms |

The replay "before" subtracts the 5 s ping the first bench run waited for.

## Browser (`perf.ts`)

The "before" build already had the new reducer, so these rows show only the web and map changes.

| Phase | Metric | Before | After |
| --- | --- | --- | --- |
| Idle 5 s | Main-thread long-task time | 4,956 ms | 460 ms |
| Idle 5 s | p95 frame | 117 ms | 17 ms |
| Idle 5 s | WebGL draw calls | 873,840 | 71,568 |
| Live, no panel | Frames in 10 s | 19 | 49 |
| Live, no panel | p95 frame | 1,383 ms | 333 ms |
| Live, no panel | Component renders per frame | 433 | 87 |
| Live, panel open | Frames in 10 s | 23 | 49 |
| Live, panel open | p95 frame | 1,033 ms | 350 ms |
| Live, panel open | Component renders per frame | 823 | 301 |
| After the run | Heap after GC | 225 MB | 139 MB |
| Build | Map chunk (gzip) | 468.6 kB | 407.5 kB |

## What changed

- **Reducer.** `graph.tools` is keyed by session, so a live event copies one session's tools instead of all 100k. Spawned subagents are indexed once per batch instead of scanning every agent on each finished tool. `toMap` walks each agent's latest tools from the end.
- **Bridge.** One SQLite transaction per batch with `synchronous = NORMAL` instead of one commit per event, hidden sessions held in memory, one `JSON.stringify` per event, and SSE replay and live batches written as one chunk of stored JSON bodies.
- **React.** One merged graph and one filtered graph per store change for every reader, one shared timer per clock rate, memoised session rows with cached error counts, memoised markdown, tool and message rows.
- **Map.** Link objects are reused by id, so three-forcegraph stops rebuilding every tube and arrow on each change. The WebGL loop sleeps when nothing moves (`components/graph/demand.ts`). Icons are serialised directly instead of through `react-dom/server`.

## Still slow

During live activity each frame costs 200–350 ms: the scene draws one mesh or sprite per node, arrow and link, about 18,300 draw calls a frame at this data size, and every new tool node reheats the whole force layout. Cutting this needs instanced meshes for tool nodes and links, fewer drawn tool nodes, or a partial reheat, and each of those is a design decision rather than a local fix.
