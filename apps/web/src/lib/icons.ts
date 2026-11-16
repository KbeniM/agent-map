import {
  CheckListIcon,
  ComputerIcon,
  ComputerTerminal01Icon,
  CubeIcon,
  File01Icon,
  FileEditIcon,
  Globe02Icon,
  LeftToRightListBulletIcon,
  Menu01Icon,
  Message01Icon,
  Moon02Icon,
  Plug01Icon,
  RoboticIcon,
  Search01Icon,
  SparklesIcon,
  SquareIcon,
  Sun03Icon,
  ViewOffSlashIcon,
  Wrench01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
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
import type { Provider } from "@rancher/shared/providers";
import type { Theme, ToolDisplay, View } from "@/stores/preferences";

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

const TOOL_ICONS: [RegExp, IconSvgElement][] = [
  [/^(bash|shell|exec|run|terminal|powershell)/i, ComputerTerminal01Icon],
  [/^(read|view|cat|open)/i, File01Icon],
  [/^(edit|write|multiedit|notebookedit|apply_?patch|patch|create)/i, FileEditIcon],
  [/^(grep|glob|search|find|ls|list)/i, Search01Icon],
  [/^(webfetch|websearch|fetch|browse|web)/i, Globe02Icon],
  [/^(agent|task|subagent)/i, RoboticIcon],
  [/^(todo|plan)/i, CheckListIcon],
  [/^mcp__/i, Plug01Icon],
  [/^skill/i, SparklesIcon],
  [/handback|sendmessage|message/i, Message01Icon],
];

export const AGENT_ICON = RoboticIcon;

export const toolIcon = (name: string) => TOOL_ICONS.find(([pattern]) => pattern.test(name))?.[1] ?? Wrench01Icon;

const escapeAttribute = (value: string) => value.replace(/[&<"]/g, (char) => `&#${char.charCodeAt(0)};`);
const kebab = (name: string) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

// why: the map turns icons into textures; serialising the icon data directly keeps react-dom/server out of the bundle
export function iconMarkup(icon: IconSvgElement, size: number, strokeWidth: number) {
  const children = icon.map(([tag, attributes]) => {
    const pairs = Object.entries({ ...attributes, strokeWidth })
      .filter(([name]) => name !== "key")
      .map(([name, value]) => `${kebab(name)}="${escapeAttribute(String(value))}"`);
    return `<${tag} ${pairs.join(" ")}></${tag}>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" color="white" stroke-width="${strokeWidth}" stroke="currentColor">${children.join("")}</svg>`;
}

export const THEME_ICONS: Record<Theme, IconSvgElement> = { system: ComputerIcon, light: Sun03Icon, dark: Moon02Icon };
export const VIEW_ICONS: Record<View, IconSvgElement> = { "2d": SquareIcon, "3d": CubeIcon };
export const TOOL_DISPLAY_ICONS: Record<ToolDisplay, IconSvgElement> = {
  detailed: LeftToRightListBulletIcon,
  simple: Menu01Icon,
  off: ViewOffSlashIcon,
};
