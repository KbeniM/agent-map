import { join } from "node:path";
import type { AgentEvent } from "@rancher/shared/events";
import { agentEventSchema } from "@rancher/shared/events";
import { applyAll, emptyGraph, mergeGraphs } from "@rancher/shared/graph";
import { toMap } from "@rancher/shared/layout";
import { createApp } from "../apps/api/src/app";
import { createStore } from "../apps/api/src/events/store";
import { createRuntime } from "../apps/api/src/runtime";
import { parseBlocks } from "../apps/web/src/lib/sse";

// why: a heavy user keeps weeks of sessions; these sizes put the bench near 200k events
const SESSIONS = Number(process.env.BENCH_SESSIONS ?? 100);
const SUBAGENTS = 4;
const TOOLS = 200;

function synthetic(sessions = SESSIONS): AgentEvent[] {
  const events: AgentEvent[] = [];
  let clock = Date.parse("2026-11-01T00:00:00.000Z");
  const at = () => {
    clock += 37;
    return new Date(clock).toISOString();
  };
  for (let s = 0; s < sessions; s++) {
    const sessionId = `session-${s}`;
    events.push({
      type: "session.started",
      sessionId,
      harness: s % 3 ? "claude-code" : "codex",
      title: `Task ${s}`,
      cwd: `/repo/${s}`,
      at: at(),
    });
    events.push({ type: "message", sessionId, agentId: sessionId, role: "user", text: `Fix bug ${s}`, at: at() });
    const agents = [sessionId];
    for (let a = 0; a < SUBAGENTS; a++) {
      const toolId = `${sessionId}-spawn-${a}`;
      const agentId = `${sessionId}-agent-${a}`;
      events.push({
        type: "tool.started",
        sessionId,
        agentId: sessionId,
        toolId,
        name: "Task",
        summary: `agent ${a}`,
        at: at(),
      });
      events.push({
        type: "agent.started",
        sessionId,
        agentId,
        name: `worker-${a}`,
        parentToolId: toolId,
        model: "claude-sonnet-5-5",
        at: at(),
      });
      agents.push(agentId);
    }
    for (let t = 0; t < TOOLS; t++) {
      for (const agentId of agents) {
        const toolId = `${agentId}-tool-${t}`;
        events.push({
          type: "tool.started",
          sessionId,
          agentId,
          toolId,
          name: "Read",
          summary: `src/file-${t}.ts`,
          at: at(),
        });
        events.push({ type: "tool.finished", sessionId, toolId, ok: t % 17 !== 0, at: at() });
        if (t % 20 === 0)
          events.push({
            type: "message",
            sessionId,
            agentId,
            role: "assistant",
            text: `Step ${t} done with **markdown** and \`code\``,
            model: "claude-opus-5-5",
            at: at(),
          });
      }
    }
    for (let a = 0; a < SUBAGENTS; a++)
      events.push({ type: "tool.finished", sessionId, toolId: `${sessionId}-spawn-${a}`, ok: true, at: at() });
  }
  return events;
}

const time = async <T>(label: string, run: () => T | Promise<T>, results: Record<string, number>) => {
  const start = performance.now();
  const value = await run();
  results[label] = Math.round(performance.now() - start);
  return value;
};

async function replay(app: ReturnType<typeof createApp>, total: number) {
  const response = await app.request("/v1/stream");
  const reader = (response.body as ReadableStream<Uint8Array>).pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let count = 0;
  let bytes = 0;
  const events: AgentEvent[] = [];
  while (true) {
    const { value } = await reader.read();
    bytes += value?.length ?? 0;
    const parsed = parseBlocks(buffer + value);
    buffer = parsed.rest;
    for (const message of parsed.messages) {
      if (message.event !== "message") continue;
      const event = agentEventSchema.safeParse(JSON.parse(message.data));
      if (event.success) events.push(event.data);
      count++;
    }
    if (count >= total) {
      await reader.cancel();
      return { count, bytes, events };
    }
  }
}

if (import.meta.main) {
  const path = process.argv[2] === "--seed" ? join(process.argv[3], "events.db") : ":memory:";
  const events = synthetic();
  const results: Record<string, number> = { events: events.length };
  const store = createStore(path);
  await time(
    "publish ms",
    () => {
      for (let i = 0; i < events.length; i += 1000) store.publish(events.slice(i, i + 1000));
    },
    results,
  );
  await time("republish duplicates ms", () => store.publish(events.slice(0, 20_000)), results);
  if (path !== ":memory:") {
    console.log(`seeded ${path} with ${events.length} events`);
    process.exit(0);
  }
  const runtime = createRuntime({
    adapters: [],
    store,
    dataDir: join(import.meta.dir, "..", ".bench"),
    defaults: { retentionDays: 3650, sinceHours: 24 },
  });
  const app = createApp({ store, runtime, token: "", origins: [], version: "bench" });
  const replayed = await time("stream replay + parse ms", () => replay(app, events.length), results);
  results["stream MB"] = Math.round(replayed.bytes / 1e5) / 10;
  const graph = await time("applyAll ms", () => applyAll(emptyGraph(), replayed.events), results);
  await time(
    "apply 1000 frames of 1 event ms",
    () => {
      let next = graph;
      for (const event of events.slice(-1000)) next = applyAll(next, [event]);
    },
    results,
  );
  await time("mergeGraphs x1 ms", () => mergeGraphs([graph]), results);
  await time("toMap ms", () => toMap(graph, Date.now()), results);
  console.table(results);
  process.exit(0);
}
