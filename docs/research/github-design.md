# GitHub design system scrape (2026-11-16)

- Fetched `github.com/kbenim/agent-map` (200) and its 29 stylesheets from `github.githubassets.com`. Marketing pages (`/`, `/features`, `/copilot`, `/pricing`) returned 403 through this environment's proxy and were not inspected.
- `<html data-color-mode="auto" data-light-theme="light" data-dark-theme="dark">`.
- `primer-primitives-*.css` sets `--fontStack-sansSerif: "Mona Sans VF", -apple-system, …`: the product UI now uses Mona Sans.
- `light-*.css` and `dark-*.css` define the functional tokens. Spot-checked against `@primer/primitives@11.10.0` `dist/css/functional/themes/{light,dark}.css`, all identical:

| Token | Light | Dark |
| --- | --- | --- |
| `bgColor-default` | `#ffffff` | `#0d1117` |
| `fgColor-muted` | `#59636e` | `#9198a1` |
| `borderColor-default` | `#d1d9e0` | `#3d444d` |
| `control-bgColor-rest` | `#f6f8fa` | `#212830` |
| `button-primary-bgColor-rest` | `bgColor-success-emphasis` | same |
| `shadow-floating-small` | `0 0 0 1px #d1d9e040, …` | `0 0 0 1px #3d444d, …` |

- Size: `control-medium-size` 2rem, `borderRadius-medium` .375rem, `borderRadius-large` .75rem, body text `.875rem`.
