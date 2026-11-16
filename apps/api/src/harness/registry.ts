import type { Adapter } from "./adapter";
import { antigravity } from "./antigravity";
import { claudeCode } from "./claude-code";
import { cline } from "./cline";
import { codex } from "./codex";
import { copilotCli } from "./copilot-cli";
import { cursor } from "./cursor";
import { geminiCli } from "./gemini-cli";
import { grok } from "./grok";
import { opencode } from "./opencode";
import { windsurf } from "./windsurf";

export const ADAPTERS: Adapter[] = [
  claudeCode,
  codex,
  cursor,
  copilotCli,
  geminiCli,
  grok,
  antigravity,
  opencode,
  cline,
  windsurf,
];
