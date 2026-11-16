# 0008. The desktop app is Tauri with the bridge as a sidecar

Agent Map is open source and runs three ways: from the repository (`bun run dev`), hosted (Docker, ADR-0004), and as a desktop app.

The desktop app is Tauri 2 (`apps/desktop`). The webview loads the same built web app (`apps/web/dist`). The bridge is compiled with `bun build --compile` into a single binary (`scripts/sidecar.ts`) and shipped as a Tauri sidecar. Rust starts it on `127.0.0.1:4000` at launch and kills it on exit. The web app detects Tauri (`__TAURI_INTERNALS__`) and defaults its bridge to that address.

- The page gets no shell permissions. Only Rust starts the sidecar, so a compromised page cannot spawn processes.
- A bridge already running on port 4000 keeps working: the sidecar fails to bind and the app uses the running one. Both read the same `~/.agent-map`.
- The CSP allows connecting to loopback and to any `https:` origin, because users add hosted bridges.

Considered: Electron (ships Chromium; the app already depends on WebGL working in the system webview, which Tauri's targets provide), rewriting the bridge in Rust (two implementations of every adapter).

Trade-off: the sidecar embeds the Bun runtime, about 105 MB per platform.
