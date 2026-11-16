# Design System

The interface follows GitHub's Primer design system (ADR-0007). The 3D map is the product; the chrome around it is Primer's product UI: quiet surfaces, 1px borders, compact controls.

- **Tokens:** `@primer/primitives`, imported in `apps/web/src/styles.css`. Tailwind's theme maps shadcn's names onto Primer's (`--color-background: var(--bgColor-default)`, `--color-control`, `--color-accent-emphasis` …). Use those Tailwind classes or `var(--<primer-token>)`; never a raw colour, size or radius.
- **Font:** Mona Sans Variable, then Primer's sans-serif stack; mono is Primer's monospace stack.
- **Components:** shadcn (Radix behaviour) in `apps/web/src/components/ui/`, restyled to Primer specs. Re-apply the Primer classes after any `bunx shadcn add`.
- **Icons:** Hugeicons for interface and tool glyphs (`lib/icons.ts`); provider logos from `@lobehub/icons-static-svg`.

## 1. Themes

- System, Light or Dark from the toggle, persisted. `src/lib/theme.ts` sets `data-color-mode`, `data-light-theme`, `data-dark-theme` and the `dark` class, and pauses transitions for the swap frame.
- `prefers-contrast: more` switches to Primer's `light_high_contrast` / `dark_high_contrast`.

## 2. Show only what matters

- No status badges, Counter pills or labels. State is text (`running`, `2m ago`) or the text's colour plus a word.
- A panel shows the selected thing and nothing else.
- No decorative motion. Particles and a breathing halo mean something is running.

## 3. Components

| Need | Use | Primer equivalent |
| --- | --- | --- |
| Action | `Button` `default` | Button |
| The one confirming action of a form | `Button variant="primary"` (green) | Button primary |
| Toolbar or row action | `Button variant="ghost"` | Button invisible |
| Destructive confirm | `Button variant="destructive"`, after an inline confirmation naming the object | Button danger |
| Section switch | `Tabs` | UnderlineNav |
| On/off | `Switch` | ToggleSwitch |
| One of a few options | `Select` | ActionMenu with single select |
| Two-way choice on the map | segmented control in `map-controls.tsx` | SegmentedControl |
| Floating panel | `Panel` (`surface`, `rounded-xl`) | Overlay |

Controls are 32px high (`h-8`) and 44px on coarse pointers (`pointer-coarse:`). Radius is 6px for controls (`rounded-md`), 12px for panels and menus (`rounded-xl`). Elevation is `surface` (overlay background, default border, `shadow-floating-small`).

## 4. Colour roles

| Class or token | Use for |
| --- | --- |
| `background`, `foreground`, `muted-foreground` | Page, primary text, secondary text |
| `card` / `surface` | Panels and menus |
| `control`, `control-hover` | Button and select fills |
| `secondary` | Selected row, active nav item |
| `link`, `--borderColor-accent-emphasis` | Links, the selected-row bar, focus |
| `live` | Running work and active sessions |
| `destructive` | Failed tool calls, destructive actions |
| `--data-*-color-emphasis` | Session groups on the map (`components/graph/colour.ts`); red, green and blue are excluded because they mean failed, live and message |
| `--graph-*` | Map tokens; each resolves to an opaque Primer hex value because three.js cannot parse oklch or alpha hex |

## 5. Typography

`type-title` (16px semibold, section and panel titles), `type-body` (14px), `type-caption` (12px), `type-micro` (12px semibold, small headings). Sentence case everywhere; no uppercase labels except the 2D/3D toggle. Inputs render at 16px below `sm` so iOS does not zoom.

## 6. Motion

- Map motion in `components/graph/motion.ts`: nodes grow from their parent, live nodes breathe. Camera glides 900ms and then follows the selection.
- Buttons press to `0.96` when enabled. State transitions name their properties and stay at 80–150ms.
- `prefers-reduced-motion`: CSS animation off, camera cuts instead of gliding, no following, no particles, no pulses.

## 7. The map

- Session and agents: provider logo in a sphere tinted by the colour-by setting; sessions are larger and carry their title.
- Tool call: the tool's glyph in a small sphere; muted when done, `live` while running, `destructive` when it failed.
- Links point parent → child with an arrow. Subagent links are accent-blue and carry the task, then the answer. Tool links show `Tool · summary` while running or when an end is hovered or selected.
- Dragging pins a node. The panels give keyboard users the same information the map shows.

## 8. Review

UI changes are reviewed with `better-interface` (it loads `better-accessibility`, `-layout`, `-writing`, `-typography`, `-colors`, `-ui`) and `design-review`, at 320px, on a coarse pointer, in both themes and with reduced motion.
