# Framework Conventions

## 1. Vite and TanStack Router (apps/web)

- File-based routes live in `apps/web/src/routes/`. The Vite plugin regenerates `routeTree.gen.ts`; it is committed so `tsc` runs without a build.
- `tanstackRouter()` comes before `react()` in `vite.config.ts`, or route generation fails silently.
- Search params are parsed with a Zod schema in `validateSearch`. The selected node lives in `?node=`, so a selection is a shareable URL.
- The map is rendered once in `__root.tsx`; routes render the panels over it.

## 2. State

- **Live map state** is in Zustand (`stores/graph.ts`): one graph per bridge, merged by `useGraph()`, filtered by `useVisibleGraph()`. `lib/stream.tsx` follows each enabled bridge with `fetch` (for the bearer header), parses SSE in `lib/sse.ts`, reconnects with backoff, and batches events per animation frame.
- Zustand selectors return stored values, never new arrays or objects; derive after selecting, or React loops.
- **Request/response data** from the bridge (`/v1/harnesses`) goes through `@tanstack/react-query`.
- **Preferences** (bridges with tokens, theme, view, display, filters) persist through Zustand `persist` under `agent-map-preferences` with a version and `migrate`; `index.html` reads the same key for the theme before first paint.

## 3. Bridge calls

- Request/response routes are called through the typed Hono RPC client and `unwrap()` in `apps/web/src/lib/api.ts`. Never call `fetch` on bridge paths by hand.
- `client(bridge)` adds the bridge's token; `unwrap` returns the success body and throws on 401 and other errors.
- The stream is the one exception: `fetch` on `/v1/stream`.

## 4. Forms

Inputs validate with a Zod schema before they reach a store or the bridge. A form with more than one field uses React Hook Form with `zodResolver` and a schema from `packages/shared` (`bridgeConnectionSchema`, `retentionSchema`).
