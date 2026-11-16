# Design System

A minimal, Apple-inspired, dark-mode-only interface. The 3D map is the product; the chrome around it stays quiet.

- **Tokens** (colour, radius, type) live in `apps/web/src/styles.css`. The map reads its colours from the `--graph-*` tokens at runtime.
- **Components:** shadcn (radix base, maia preset) in `apps/web/src/components/ui/`, added with `bunx shadcn add`. App components sit in `apps/web/src/components/`.

## 1. Dark mode only

The interface runs only in dark mode (`color-scheme: dark`). There is no light mode, no theme toggle and no second palette.

## 2. Show only what matters

- No status badges, pills or chips. State is plain text (`running`, `2m ago`) or a colour on the text itself.
- No counters, charts or panels nobody asked for. A panel shows the selected thing and nothing else.
- No decorative motion. Particles on the map mean a tool call is running.

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
| `--graph-*` | Map background, links, tool nodes, particles. Hex, rgb or hsl only, because three.js does not parse oklch |

Each session gets its own hue (`components/graph/colour.ts`), shared by its list dot and its nodes.

## 4. Typography

Structured text uses a `type-*` class, never a raw text-size utility: `type-title`, `type-body`, `type-caption`, `type-micro`. The font is the system font (SF Pro on Apple devices), mono is SF Mono. Tool names and paths are mono.

## 5. Surfaces and motion

- Floating chrome uses `glass` (translucent card, backdrop blur) and `rounded-3xl`; the navigation bar is `rounded-full`.
- Panels enter with `animate-in fade-in` and a short slide from their own edge.
- `prefers-reduced-motion` turns animation off; `prefers-reduced-transparency` makes `glass` solid.

## 6. The map

- Session: terminal glyph in a translucent sphere, the largest node, labelled with its title.
- Agent: robot glyph, labelled with its agent type.
- Tool call: a small dot. Grey when done, `live` while running, `destructive` when it failed. Its name shows on hover.
- A subagent replaces the tool call that spawned it. Only the latest tool calls per agent are drawn.
