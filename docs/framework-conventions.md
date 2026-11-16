# Framework Conventions

## 1. Vite and TanStack Router (apps/web)

- File-based routes live in `apps/web/src/routes/`. The Vite plugin regenerates `routeTree.gen.ts`; it is committed so `tsc` runs without a build.
- `tanstackRouter()` comes before `react()` in `vite.config.ts`, or route generation fails silently.
- Search params are parsed with a Zod schema in `validateSearch`. The selected node lives in `?node=`, so a selection is a shareable URL.
- The map is rendered once in `__root.tsx`; routes render the panels over it.

## 2. State

- **Live map state** is in Zustand (`stores/graph.ts`), fed by the SSE stream in `lib/stream.ts`. Events are batched per animation frame before they reach the store.
- **Request/response data** from the bridge (`/v1/harnesses`) goes through `@tanstack/react-query`.
- **Preferences** (the bridge URL) persist through Zustand `persist`.

## 3. Bridge calls

- Request/response routes are called through the typed Hono RPC client and `unwrap()` in `apps/web/src/lib/api.ts`. Never call `fetch` on bridge paths by hand.
- The stream is the one exception: `EventSource` on `/v1/stream`.

## 4. Forms

Inputs validate with a Zod schema before they reach a store. A form with more than one field uses React Hook Form with `zodResolver` and a schema from `packages/shared`.
