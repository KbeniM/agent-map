# Design System

A minimal, Apple-inspired interface in light and dark. The 3D map is the product; the chrome around it stays quiet.

- **Tokens** (colour, radius, type) live in `apps/web/src/styles.css`. The map reads its colours from the `--graph-*` tokens at runtime.
- **Components:** shadcn (radix base, maia preset) in `apps/web/src/components/ui/`, added with `bunx shadcn add`. App components sit in `apps/web/src/components/`.
- **Icons:** Hugeicons (`@hugeicons/react` with `@hugeicons/core-free-icons`) for every interface and tool glyph; tool glyphs are mapped in `lib/icons.ts`. Provider logos come from `@lobehub/icons-static-svg`.

## 1. Light and dark

- The theme follows the system by default. The toggle in the top-right cycles System, Light, Dark and the choice persists.
- `:root` holds the light palette and `.dark` the dark one. Every token exists in both; a new token gets both values.
- `src/lib/theme.ts` sets the `dark` class outside React, before the map re-renders, and `index.html` sets it before first paint.

## 2. Show only what matters

- No status badges, pills or chips. State is plain text (`running`, `2m ago`) or a colour on the text itself.
- No counters, charts or panels nobody asked for. A panel shows the selected thing and nothing else.
- Settings are one floating panel with three tabs (Harnesses, Bridges, Display). Each control saves on change; a form with several fields shows Save only once it is dirty.
- No decorative motion. Particles and a breathing halo mean something is running; nothing moves for its own sake.

## 3. Colour tokens

Use the semantic class names (`bg-card`, `text-muted-foreground`), never a raw colour.

| Token | Use for |
| --- | --- |
| `background` | Page background |
| `card`, `card-foreground` | Floating panels (through `glass`) and their text |
| `secondary` | Hover and selected rows, active navigation |
| `foreground`, `muted-foreground` | Primary text; secondary text (meta lines, summaries) |
| `live` | Running tool calls and sessions active in the last 30 seconds |
| `destructive` | Failed tool calls |
| `--graph-*` | Map background, links, labels, tool nodes, tool-call particles (`--graph-particle`), subagent links and their messages (`--graph-message`). Hex, rgb or hsl only, because three.js does not parse oklch |

Each session gets its own hue (`components/graph/colour.ts`), shared by its list dot and its nodes.

## 4. Typography

Structured text uses a `type-*` class, never a raw text-size utility: `type-title`, `type-body`, `type-caption`, `type-micro`. The font is the system font (SF Pro on Apple devices), mono is SF Mono. Tool names and paths are mono.

## 5. Surfaces and motion

- Floating chrome uses `glass` (translucent card, backdrop blur) and `rounded-3xl`; the navigation bar is `rounded-full`.
- Panels enter with `animate-in fade-in` and a short slide from their own edge.
- Map motion lives in `components/graph/motion.ts`: new nodes grow out of their parent (expo ease-out, no overshoot), a changed node settles from 70 %, live nodes breathe about once every 1.4 s.
- Selecting a node glides the camera to it and then follows it while the layout moves. The 2D/3D switch flattens the same layout and turns rotation off.
- `prefers-reduced-motion` turns animation off; `prefers-reduced-transparency` makes `glass` solid.

## 6. The map

- Session (its main agent) and agents: the provider logo (`components/icons.tsx`, from `@lobehub/icons-static-svg`) in a translucent sphere in the session's hue. The session is the largest node, labelled with its title; agents are labelled with their agent type. An unknown provider gets the robot glyph.
- Tool call: the tool's glyph (`toolIcon`) in a small sphere. Grey when done, `live` while running, `destructive` when it failed.
- Links point from parent to child with an arrow. A subagent link is blue and labelled with the task it was given, then with its answer. A tool link is labelled with the tool and its summary while it runs, or while either end is hovered or selected.
- A subagent replaces the tool call that spawned it. Only the latest tool calls per agent are drawn.
- Dragging a node pins it where it is dropped.
