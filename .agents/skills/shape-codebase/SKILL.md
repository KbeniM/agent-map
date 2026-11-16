---
name: shape-codebase
description: Whole-codebase shaping pass. Gathers evidence with fallow, React Doctor and ponytail-audit, then runs improve-codebase-architecture on it. Use when the user says "shape the codebase" or types /shape-codebase.
disable-model-invocation: true
---

# Shape the codebase

Run the four passes in order. Passes 1 to 3 only gather evidence and change no files. Pass 4 is where candidates are chosen. Keep each pass's raw output in the OS temp directory, not the repo.

## 1. Fallow: structure and the module graph

Read the `fallow` skill first. Use the fallow MCP tools when they are connected and fall back to `bunx fallow <command>` otherwise. Collect:

- Refactor targets: `check_health` / `fallow health --hotspots --targets`
- Cycles and boundaries: `check_architecture` / `fallow architecture`
- Duplication: `find_dupes` / `fallow dupes`
- Dead code: `get_cleanup_candidates` / `fallow dead-code`

Fallow's import graph is the codebase map. Use `inspect_target`, `trace_file`, `trace_import_path`, `get_blast_radius` and `get_importance` to answer "what depends on this" and "how does A reach B". `fallow viz --no-open --out <tmpdir>/fallow-viz.html` renders the graph when a picture helps.

## 2. React Doctor: `apps/web`

Read the `react-doctor` skill. Run `bun run react-doctor -- --json --json-out <tmpdir>/react-doctor.json` and keep the score, the top rules and the files they hit. Architecture and state/effect rules matter most here.

## 3. Ponytail audit

Run the `ponytail-audit` skill (`ponytail:ponytail-audit` in Claude Code). It is report-only.

## 4. Improve codebase architecture

Read `.agents/skills/improve-codebase-architecture/SKILL.md` and follow it from its step 1. Use passes 1 to 3 as the hot-spot evidence for its "scope before you scan" step: rank a candidate higher when a fallow hotspot, cycle, duplicate cluster or blast radius, a React Doctor architecture rule, or a ponytail-audit finding backs it. Cite that evidence on the candidate's card in the HTML report.

## Before and after any edit from pass 4

- Before: `guard` / `fallow guard <files>` on the files you will touch.
- After: `fallow architecture`, `bun run react-doctor` if `apps/web` changed, and `bun run verify`.
