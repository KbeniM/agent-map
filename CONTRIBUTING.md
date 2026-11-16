# Contributing

Agent Map is MIT-licensed. Issues and pull requests are welcome.

## Set up

```sh
bun install          # also installs the pre-commit hook
cp .env.example .env
bun run dev          # bridge on :4000, map on :5173
bun run demo         # a synthetic multi-agent session to look at
```

Desktop app: install Rust and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS, then `bun run desktop`.

## Before you open a pull request

- `bun run verify` passes (typecheck, lint, tests, build), and `bun run test:e2e` for user-facing changes.
- Read [`CLAUDE.md`](CLAUDE.md): it maps the docs for each area (architecture, design system, security, coding standards) and applies to people as much as agents.
- A new harness adapter starts from its vendor's documented format, recorded in [`docs/research/harness-formats.md`](docs/research/harness-formats.md), and comes with tests built from those fields.
- UI changes come with screenshots in light and dark, and at a phone width.
- A decision that is hard to reverse gets an ADR in [`docs/adr/`](docs/adr/).

## Reporting a security issue

Open a private security advisory on GitHub instead of a public issue.
