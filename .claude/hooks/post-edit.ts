#!/usr/bin/env bun
import { $ } from "bun";

const input = await Bun.stdin.json();
const file: string | undefined = input?.tool_input?.file_path;
if (!file) process.exit(0);

const result = await $`bunx biome check --no-errors-on-unmatched --files-ignore-unknown=true ${file}`
  .nothrow()
  .quiet();
if (result.exitCode !== 0) {
  console.error(result.stdout.toString() + result.stderr.toString());
  process.exit(2);
}
