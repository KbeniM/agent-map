# Coding Standards

Two kinds of rule live here. **Mechanical** rules are enforced by a check, which names the rule when it fails. **Judgement** rules are enforced in review. Apply every judgement rule to every diff you write or review.

## 1. Mechanical rules

| Rule | Enforced by |
| --- | --- |
| Biome formatting and lint | edit hook, `.githooks/pre-commit`, CI `bun run check` |
| Comments, `type` not `kind`, no hex colour or raw text size in UI, no status badge, web imports only bridge types and never the file system, exact versions, test files only in `tests/` | `scripts/lint.ts` (its `RULES` table), run by `bun run check` |
| Every input-taking bridge route has its malformed cases | `apps/api/tests/http/routes.test.ts` (`every input-taking route has malformed cases`) |
| Changed code adds no dead code, duplication or complexity | fallow audit in `.githooks/pre-commit` |

When a check is wrong, fix the check. Never work around it.

## 2. Comments

Code carries its meaning in names, types and structure. Explanations belong in ADRs and docs.

Only two comment forms exist, both one line, both from the `ponytail` rules:

- `// why: <what the code cannot show>`: a security check, a data-loss boundary, a protocol quirk, a magic value's source. CSS has no line comments, so there the same text goes in `/* why: … */`.
- `// shortcut: <the limit>, <when to upgrade>`: a known limit taken on purpose.

`scripts/lint.ts` checks the form. Review checks the content: a `why:` that restates the code is deleted. Generated files (`routeTree.gen.ts`) and shadcn components in `components/ui/` are exempt where the lint table says so.

## 3. Tests

- Each workspace keeps its tests in its own `tests/` folder. `bun test` runs them; `scripts/setup-test.ts` sets the environment.
- **Negative cases.** Every input-taking bridge route sits in the `MALFORMED` table of `apps/api/tests/http/routes.test.ts`, with at least three malformed bodies (broken JSON, unknown event type, missing field). A new route gets a row, or the completeness test fails.
- **Harness adapters** are tested against recorded transcript lines, never against a live harness. A new transcript shape gets a fixture line in the adapter's test first.
- **A bug fix starts with a failing test** at the seam where the bug happens. Watch it fail, then fix.
- **Mutation testing** is local and on demand. CI does not run it.
  - `bun run mutation` mutates the code changed against the base ref. Add a path or `--all` for more, and `--allow-dirty` for uncommitted work.
  - `bunx fallow mutation tasks` lists the survivors of the last run.
  - A survivor is killed with a test that fails on the mutant, never by bending the code to the tool.
- **E2E** (`bun run test:e2e`, Playwright, `e2e/`): `playwright.config.ts` starts the bridge on `:4100` against `e2e/fixtures/projects` and the web app on `:5174`, so it runs beside `bun run dev`. Set `CHROMIUM_PATH` to use a preinstalled Chromium instead of the one `playwright install` downloads. Every user-facing flow you add or change gets an e2e test.

## 4. Judgement rules (review enforces)

- **Glossary.** UI copy, identifiers and test names use the [`GLOSSARY.md`](../GLOSSARY.md) term, never one of its `_Avoid_` words.
- **Active implementations only.** No backwards-compatibility shims, fallback branches or dead paths left behind. A removed feature takes its route, panel, event type and tests with it.
- **Root causes.** A fix lands in the shared code that caused the bug, once. A test is never made green by loosening its assertion or sleeping past a race.
- **Validation at the boundary.** Every bridge route parses its body with `zValidator` and a schema from `packages/shared`. The web app parses every streamed event with the same schema before it reaches the store.
- **One reducer.** The map state changes only through `apply` in `packages/shared/src/graph.ts`. Adapters emit events; they never build map state.
- **Verified APIs.** A library call matches the docs for the installed version (see CLAUDE.md §3).
