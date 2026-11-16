import type { AgentEvent } from "@agent-map/shared/events";

const url = process.env.VITE_BRIDGE_URL ?? "http://localhost:4000";
const sessionId = `demo-${Date.now().toString(36)}`;
const tools = ["Read", "Grep", "Edit", "Bash", "Glob", "WebFetch"];
const send = (events: AgentEvent[]) =>
  fetch(`${url}/v1/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(events),
  });
const now = () => new Date().toISOString();

async function work(agentId: string, calls: number) {
  for (let i = 0; i < calls; i++) {
    const toolId = `${agentId}-${i}`;
    const name = tools[(agentId.length + i) % tools.length];
    await send([{ type: "tool.started", sessionId, agentId, toolId, name, summary: `src/module-${i}.ts`, at: now() }]);
    await Bun.sleep(300 + Math.random() * 900);
    await send([{ type: "tool.finished", sessionId, toolId, ok: Math.random() > 0.1, at: now() }]);
  }
}

await send([
  { type: "session.started", sessionId, harness: "demo", title: "Refactor billing module", cwd: "~/demo", at: now() },
]);
await work(sessionId, 2);
await Promise.all(
  ["scout", "implementer", "architect"].map(async (name, i) => {
    const spawn = `${sessionId}-spawn-${i}`;
    await send([
      { type: "tool.started", sessionId, agentId: sessionId, toolId: spawn, name: "Agent", summary: name, at: now() },
      { type: "agent.started", sessionId, agentId: `${sessionId}-${name}`, name, parentToolId: spawn, at: now() },
    ]);
    await work(`${sessionId}-${name}`, 4 + i * 2);
    await send([{ type: "tool.finished", sessionId, toolId: spawn, ok: true, at: now() }]);
  }),
);
console.log(`demo session ${sessionId} done`);
