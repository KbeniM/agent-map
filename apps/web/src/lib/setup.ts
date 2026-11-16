export type Snippet = { title: string; file?: string; content: string };
type Context = { url: string; secured: boolean };

const json = (value: unknown) => JSON.stringify(value, null, 2);
const isWindows = () => typeof navigator !== "undefined" && /windows/i.test(navigator.userAgent);
const hook = (adapter: string, event?: string) => `rancher-hook ${adapter}${event ? ` ${event}` : ""}`;

const installForwarder = ({ url, secured }: Context): Snippet =>
  isWindows()
    ? {
        title: "Install the Windows forwarder in PowerShell (in a folder on PATH)",
        content: [
          `New-Item -ItemType Directory -Force "$HOME\\.local\\bin" | Out-Null`,
          `irm ${url}/hook.ps1 -OutFile "$HOME\\.local\\bin\\rancher-hook.ps1"`,
          `irm ${url}/hook.cmd -OutFile "$HOME\\.local\\bin\\rancher-hook.cmd"`,
          `[Environment]::SetEnvironmentVariable("RANCHER_URL", "${url}", "User")`,
          ...(secured ? [`[Environment]::SetEnvironmentVariable("RANCHER_TOKEN", "<token>", "User")`] : []),
        ].join("\n"),
      }
    : {
        title: "Install the forwarder, then export the bridge address",
        content: [
          `curl -fsSL ${url}/hook.sh -o ~/.local/bin/rancher-hook && chmod +x ~/.local/bin/rancher-hook`,
          `export RANCHER_URL=${url}`,
          ...(secured ? ["export RANCHER_TOKEN=<token>"] : []),
        ].join("\n"),
      };

const CLAUDE_EVENTS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "SubagentStart",
  "SubagentStop",
  "Stop",
  "SessionEnd",
];

function claudeHttpHooks({ url, secured }: Context) {
  const handler = {
    type: "http",
    url: `${url}/v1/hooks/claude-code`,
    timeout: 5,
    ...(secured ? { headers: { Authorization: "Bearer $RANCHER_TOKEN" }, allowedEnvVars: ["RANCHER_TOKEN"] } : {}),
  };
  return json({ hooks: Object.fromEntries(CLAUDE_EVENTS.map((event) => [event, [{ hooks: [handler] }]])) });
}

const commandHooks = (adapter: string, events: string[], shape: (command: string) => unknown) =>
  Object.fromEntries(events.map((event) => [event, [shape(hook(adapter))]]));

// why: each harness has its own hook file format; these follow each vendor's documented shape
export const SETUP: Record<string, (context: Context) => Snippet[]> = {
  t3: () => [
    {
      title: "Nothing to set up on this machine: the bridge reads ~/.t3/userdata/statev2.sqlite for all T3 providers.",
      content: "",
    },
  ],
  "claude-code": (context) => [
    {
      title:
        "Nothing to set up on this machine: the bridge reads ~/.claude/projects. For cloud or remote sessions, add HTTP hooks",
      file: ".claude/settings.json (commit it for Claude Code on the web)",
      content: claudeHttpHooks(context),
    },
    {
      title:
        "Cloud sessions also need the bridge host allowed in the environment's network settings, and the token as RANCHER_TOKEN",
      content: `Network: allow ${new URL(context.url).host}`,
    },
  ],
  codex: (context) => [
    {
      title:
        "Sessions on this machine need nothing: the bridge reads ~/.codex/sessions. Elsewhere, forward Codex hooks",
      content: "",
    },
    installForwarder(context),
    {
      title: "Codex hooks",
      file: "~/.codex/config.toml",
      content: [
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "SubagentStart",
        "SubagentStop",
        "Stop",
      ]
        .map((event) => `[[hooks.${event}]]\n[[hooks.${event}.hooks]]\ntype = "command"\ncommand = "${hook("codex")}"`)
        .join("\n\n"),
    },
  ],
  cursor: (context) => [
    {
      title: "Sessions on this machine need nothing: the bridge reads ~/.cursor/projects. For live hooks, add:",
      content: "",
    },
    installForwarder(context),
    {
      title: "Cursor hooks",
      file: "~/.cursor/hooks.json",
      content: json({
        version: 1,
        hooks: commandHooks(
          "cursor",
          [
            "sessionStart",
            "sessionEnd",
            "beforeSubmitPrompt",
            "preToolUse",
            "postToolUse",
            "postToolUseFailure",
            "subagentStart",
            "subagentStop",
            "afterAgentResponse",
          ],
          (command) => ({ command }),
        ),
      }),
    },
  ],
  "copilot-cli": (context) => [
    {
      title: "Sessions on this machine need nothing: the bridge reads ~/.copilot/session-state. For live hooks, add:",
      content: "",
    },
    installForwarder(context),
    {
      title: "Copilot CLI hooks",
      file: "~/.copilot/hooks/rancher.json",
      content: json({
        version: 1,
        hooks: Object.fromEntries(
          [
            "sessionStart",
            "sessionEnd",
            "userPromptSubmitted",
            "preToolUse",
            "postToolUse",
            "postToolUseFailure",
            "subagentStart",
            "subagentStop",
          ].map((event) => [event, [{ type: "command", bash: hook("copilot-cli", event), timeoutSec: 5 }]]),
        ),
      }),
    },
  ],
  "gemini-cli": (context) => [
    installForwarder(context),
    {
      title: "Gemini CLI hooks",
      file: "~/.gemini/settings.json",
      content: json({
        hooks: commandHooks(
          "gemini-cli",
          ["SessionStart", "SessionEnd", "BeforeAgent", "AfterAgent", "BeforeModel", "BeforeTool", "AfterTool"],
          (command) => ({ hooks: [{ type: "command", command }] }),
        ),
      }),
    },
  ],
  grok: (context) => [
    installForwarder(context),
    {
      title: "Grok Build hooks",
      file: "~/.grok/hooks/rancher.json",
      content: json({
        hooks: commandHooks(
          "grok",
          [
            "SessionStart",
            "SessionEnd",
            "UserPromptSubmit",
            "PreToolUse",
            "PostToolUse",
            "PostToolUseFailure",
            "SubagentStart",
            "SubagentStop",
            "Stop",
          ],
          (command) => ({ hooks: [{ type: "command", command }] }),
        ),
      }),
    },
  ],
  antigravity: (context) => [
    {
      title:
        "Sessions on this machine need nothing: the bridge reads ~/.gemini/antigravity/brain. For live hooks, add:",
      content: "",
    },
    installForwarder(context),
    {
      title: "Antigravity hooks",
      file: "~/.gemini/config/hooks.json",
      content: json({
        rancher: Object.fromEntries(
          ["SessionStart", "PreInvocation", "PreToolUse", "PostToolUse", "Stop"].map((event) => [
            event,
            [{ command: hook("antigravity", event) }],
          ]),
        ),
      }),
    },
  ],
  opencode: ({ url, secured }) => [
    isWindows()
      ? {
          title: "Install the plugin in PowerShell, then set RANCHER_URL before starting OpenCode",
          content: [
            `New-Item -ItemType Directory -Force "$HOME\\.config\\opencode\\plugins" | Out-Null`,
            `irm ${url}/opencode-plugin.js -OutFile "$HOME\\.config\\opencode\\plugins\\rancher.js"`,
            `$env:RANCHER_URL="${url}"`,
            ...(secured ? [`$env:RANCHER_TOKEN="<token>"`] : []),
          ].join("\n"),
        }
      : {
          title: "Install the plugin, then export the bridge address before starting OpenCode",
          content: [
            `curl -fsSL ${url}/opencode-plugin.js -o ~/.config/opencode/plugins/rancher.js`,
            `export RANCHER_URL=${url}`,
            ...(secured ? ["export RANCHER_TOKEN=<token>"] : []),
          ].join("\n"),
        },
  ],
  cline: (context) => [
    installForwarder(context),
    {
      title: "Cline runs one executable per event from its hooks folder",
      content: ["TaskStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "TaskComplete", "TaskCancel"]
        .map(
          (event) =>
            `printf '#!/bin/sh\\nexec ${hook("cline")}\\n' > ~/Documents/Cline/Hooks/${event} && chmod +x ~/Documents/Cline/Hooks/${event}`,
        )
        .join("\n"),
    },
  ],
  windsurf: (context) => [
    installForwarder(context),
    {
      title: "Windsurf Cascade hooks",
      file: "~/.codeium/windsurf/hooks.json",
      content: json({
        hooks: commandHooks(
          "windsurf",
          [
            "pre_user_prompt",
            "post_cascade_response",
            "pre_read_code",
            "post_read_code",
            "pre_write_code",
            "post_write_code",
            "pre_run_command",
            "post_run_command",
            "pre_mcp_tool_use",
            "post_mcp_tool_use",
          ],
          (command) => ({ command }),
        ),
      }),
    },
  ],
};

export const pushSnippet = ({ url, secured }: Context): Snippet => ({
  title: "Any other harness: post events in the shared schema",
  content: `curl -X POST ${url}/v1/events \\
  -H 'content-type: application/json' ${secured ? "\\\n  -H 'authorization: Bearer <token>' " : ""}\\
  -d '{"type":"tool.started","sessionId":"run-1","agentId":"run-1","toolId":"t1","name":"search","at":"${new Date().toISOString()}"}'`,
});
