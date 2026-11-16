# 0007. The interface follows GitHub's Primer design system

Supersedes the Apple-inspired visual language of the first design-system doc. The user asked the interface to match GitHub's current design.

- **Source of truth:** `@primer/primitives` (MIT), imported as CSS. A scrape of github.com's product stylesheets on 2026-11-16 matched version 11.10.0 on every colour, control, radius and shadow token checked (`docs/research/github-design.md`). Tokens are never copied by hand.
- **Font:** Mona Sans (OFL-1.1) from `@fontsource-variable/mona-sans`, first in Primer's `fontStack-sansSerif`, as github.com now ships it.
- **Themes:** Primer's `light`, `dark`, `light_high_contrast` and `dark_high_contrast`, chosen by the theme setting and `prefers-contrast: more` through `data-color-mode`, `data-light-theme` and `data-dark-theme` on `<html>`.
- **Components:** the shadcn components keep their Radix behaviour and take Primer's component specs: 32 px controls (44 px on coarse pointers), 6 px radius, default/primary/invisible/danger buttons, UnderlineNav tabs, ToggleSwitch, ActionMenu overlays.
- **Not copied:** GitHub's logos, Octocat art, illustrations and marketing assets. This is a design system, not an imitation of GitHub.

Kept from the Apple direction: motion rules (`apple-design`), springs on the map, reduced-motion handling.

Trade-off: Primer's default input border measures 1.43:1 (light) and 2.09:1 (dark) against the panel, below WCAG 1.4.11's 3:1. It is kept to match GitHub; users who ask for more contrast get Primer's high-contrast themes (8.7:1 and 10.9:1).
