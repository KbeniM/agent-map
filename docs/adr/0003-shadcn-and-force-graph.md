# 0003. shadcn for chrome, react-force-graph-3d for the map

The sibling project (idopontfoglalo) bans third-party component kits. This project allows shadcn: the chrome is a few buttons and inputs, and shadcn copies its components into `components/ui/` where they follow our tokens. Status badges stay banned (`scripts/lint.ts`).

The map uses `react-force-graph-3d` (three.js + d3-force-3d): a force layout separates sessions into their own clusters, `nodeThreeObject` draws glyphs and labels, and directional particles show running tool calls without custom shaders.

Considered: React Three Fiber with a hand-written layout (more control, far more code), a 2D graph (loses depth when many sessions overlap).
