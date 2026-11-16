import type { Provider } from "@agent-map/shared/providers";
import anthropic from "@lobehub/icons-static-svg/icons/claude-color.svg?raw";
import cursor from "@lobehub/icons-static-svg/icons/cursor.svg?raw";
import deepseek from "@lobehub/icons-static-svg/icons/deepseek-color.svg?raw";
import google from "@lobehub/icons-static-svg/icons/gemini-color.svg?raw";
import xai from "@lobehub/icons-static-svg/icons/grok.svg?raw";
import moonshot from "@lobehub/icons-static-svg/icons/kimi-color.svg?raw";
import meta from "@lobehub/icons-static-svg/icons/meta-color.svg?raw";
import mistral from "@lobehub/icons-static-svg/icons/mistral-color.svg?raw";
import openai from "@lobehub/icons-static-svg/icons/openai.svg?raw";
import qwen from "@lobehub/icons-static-svg/icons/qwen-color.svg?raw";
import {
  Bot,
  FilePen,
  FileText,
  Globe,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  Plug,
  Search,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";

const LOGOS: Record<Exclude<Provider, "unknown">, string> = {
  anthropic,
  openai,
  google,
  xai,
  deepseek,
  mistral,
  meta,
  qwen,
  moonshot,
  cursor,
};

export const PROVIDER_NAMES: Record<Provider, string> = {
  anthropic: "Claude",
  openai: "OpenAI",
  google: "Gemini",
  xai: "Grok",
  deepseek: "DeepSeek",
  mistral: "Mistral",
  meta: "Llama",
  qwen: "Qwen",
  moonshot: "Kimi",
  cursor: "Cursor",
  unknown: "Agent",
};

// why: single-colour logos draw in currentColor, which an <img> or a texture cannot inherit, so it is filled in here
export function providerSvg(provider: Provider, mono: string) {
  const svg = provider === "unknown" ? undefined : LOGOS[provider];
  return svg
    ?.replaceAll("currentColor", mono)
    .replace(/height="1em"/, 'height="128"')
    .replace(/width="1em"/, 'width="128"');
}

export const isMonoLogo = (provider: Provider) => providerSvg(provider, "x") !== providerSvg(provider, "y");

const TOOL_ICONS: [RegExp, LucideIcon][] = [
  [/^(bash|shell|exec|run|terminal|powershell)/i, Terminal],
  [/^(read|view|cat|open)/i, FileText],
  [/^(edit|write|multiedit|notebookedit|apply_?patch|patch|create)/i, FilePen],
  [/^(grep|glob|search|find|ls|list)/i, Search],
  [/^(webfetch|websearch|fetch|browse|web)/i, Globe],
  [/^(agent|task|subagent)/i, Bot],
  [/^(todo|plan)/i, ListChecks],
  [/^mcp__/i, Plug],
  [/^skill/i, Sparkles],
  [/handback|sendmessage|message/i, MessageSquare],
];

export const toolIcon = (name: string) => TOOL_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Wrench;
