# Agent Map

A live 3D map of every coding-agent session on this machine: who spawned whom, and which tool calls are running.

## Language

**Harness**:
A program that runs agents and records what they do: Claude Code, Codex, a custom loop.
_Avoid_: Client, provider, runtime

**Bridge**:
The server that reads harnesses, keeps the events and streams them to the map. Local on a laptop, or hosted for cloud sessions.
_Avoid_: Backend, API server, daemon

**Hook**:
A harness's own callback that hands one activity record to a command or URL as it happens.
_Avoid_: Webhook, trigger, callback

**Forwarder**:
The small `agent-map-hook` script that posts a hook's payload to a bridge.
_Avoid_: Shim, relay, agent

**Adapter**:
The bridge code that turns one harness's records into events.
_Avoid_: Connector, plugin, integration

**Event**:
One fact about a session, in the shared schema: a session, agent or tool call started or finished.
_Avoid_: Message, log line, update

**Session**:
One run of a harness, from the first prompt on. Drawn as the root of its tree.
_Avoid_: Conversation, chat, thread, run

**Main agent**:
The agent the user talks to in a session. It shares the session's id and node.
_Avoid_: Root agent, parent agent, orchestrator

**Subagent**:
An agent spawned by a tool call of another agent in the same session.
_Avoid_: Child agent, worker, sidechain

**Provider**:
The company whose model an agent runs on, such as Anthropic or OpenAI. Shown as its logo.
_Avoid_: Vendor, model, LLM

**Message**:
A prompt to an agent or a reply from it. A subagent's first message is its task, its last reply its answer.
_Avoid_: Chat, turn, text

**Tool call**:
One use of a tool by an agent, from start to result.
_Avoid_: Action, step, invocation

**Summary**:
The single short field of a tool call's input that the bridge keeps, such as a file path or a command's first line.
_Avoid_: Input, args, details

**Live**:
A tool call still running, or a session with an event in the last 30 seconds.
_Avoid_: Active, online, busy

**Map**:
The 3D view of all sessions, agents and tool calls.
_Avoid_: Graph view, canvas, visualizer
