import type { AgentEvent } from "@rancher/shared/events";

const url = process.env.VITE_BRIDGE_URL ?? "http://localhost:4000";
const sessionId = `demo-${Date.now().toString(36)}`;
const tools = ["Read", "Grep", "Edit", "Bash", "Glob", "WebFetch", "TodoWrite", "mcp__github__get_issue"];
const files = [
  "src/billing/invoice.ts",
  "src/billing/tax.ts",
  "tests/billing.test.ts",
  "bun test billing",
  "stripe docs",
];
const team = [
  {
    name: "scout",
    model: "claude-haiku-5-5",
    task: "Find every caller of createInvoice",
    answer: "7 callers in 4 files",
  },
  {
    name: "implementer",
    model: "gpt-5.1-codex",
    task: "Move tax rounding into tax.ts",
    answer: "Moved, 12 tests pass",
  },
  {
    name: "architect",
    model: "gemini-3-pro",
    task: "Review the new module boundary",
    answer: "Boundary holds, one cycle",
  },
];
const send = (events: AgentEvent[]) =>
  fetch(`${url}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(events),
  });
const now = () => new Date().toISOString();
const say = (agentId: string, role: "user" | "assistant", text: string, model?: string): AgentEvent => ({
  type: "message",
  sessionId,
  agentId,
  role,
  text,
  model,
  at: now(),
});

async function work(agentId: string, calls: number) {
  for (let i = 0; i < calls; i++) {
    const toolId = `${agentId}-${i}`;
    const name = tools[(agentId.length + i) % tools.length];
    const summary = files[(agentId.length + i) % files.length];
    await send([{ type: "tool.started", sessionId, agentId, toolId, name, summary, at: now() }]);
    await Bun.sleep(600 + Math.random() * 1600);
    await send([{ type: "tool.finished", sessionId, toolId, ok: Math.random() > 0.1, at: now() }]);
  }
}

await send([
  {
    type: "session.started",
    sessionId,
    harness: "claude-code",
    title: "Refactor billing module",
    cwd: "~/shop",
    at: now(),
  },
  say(sessionId, "user", "Split tax handling out of the billing module and keep the tests green"),
  say(sessionId, "assistant", "I'll map the callers first, then move the rounding logic.", "claude-opus-5-5"),
]);
await work(sessionId, 2);
await Promise.all(
  team.map(async (member, i) => {
    const agentId = `${sessionId}-${member.name}`;
    const spawn = `${sessionId}-spawn-${i}`;
    await Bun.sleep(i * 1200);
    await send([
      {
        type: "tool.started",
        sessionId,
        agentId: sessionId,
        toolId: spawn,
        name: "Agent",
        summary: member.task,
        at: now(),
      },
      {
        type: "agent.started",
        sessionId,
        agentId,
        name: member.name,
        parentToolId: spawn,
        model: member.model,
        at: now(),
      },
      say(agentId, "user", member.task),
    ]);
    await work(agentId, 4 + i * 2);
    await send([say(agentId, "assistant", member.answer, member.model)]);
    await Bun.sleep(1500);
    await send([{ type: "tool.finished", sessionId, toolId: spawn, ok: true, at: now() }]);
  }),
);
await send([
  say(sessionId, "assistant", "Tax rounding now lives in tax.ts. All billing tests pass.", "claude-opus-5-5"),
]);
console.log(`demo session ${sessionId} done`);
