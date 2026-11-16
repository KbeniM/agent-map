# Harness formats (researched 2026-11-16)

Facts verified against official docs or source; everything else is listed as unverified. Re-check when a harness ships a breaking release.

## Claude Code
- Transcripts: `~/.claude/projects/<project>/<session>.jsonl`; subagents in `<session>/subagents/agent-<id>.jsonl` with `agent-<id>.meta.json` (`agentType`, `toolUseId`). Verified on a real install (v2.1.325).
- Hooks: https://code.claude.com/docs/en/hooks. Common `session_id`, `cwd`, `hook_event_name`, `agent_id`/`agent_type` inside subagents. `PostToolUseFailure` exists. `SubagentStart` has no spawning `tool_use_id`. Only `SessionStart` carries `model`. HTTP hooks are synchronous; non-2xx and timeouts do not block.
- Cloud sessions run the repository's committed `.claude/settings.json` hooks; `$CLAUDE_CODE_REMOTE` is `"true"`. Unverified: whether the cloud network allowlist needs the bridge host (assume yes).

## Codex (github.com/openai/codex, codex-rs)
- `~/.codex/sessions/YYYY/MM/DD/rollout-<ts>-<thread_id>.jsonl`, lines `{timestamp, type, payload}`. `session_meta` (`id`, `session_id`, `cwd`, `source`), `turn_context.model`, `event_msg` (`user_message`, `agent_message`, `patch_apply_end`), `response_item` (`function_call`/`custom_tool_call`/`local_shell_call` with `call_id`, outputs by `call_id`).
- Failure is not a field on tool outputs; the adapter reads `Process exited with code N`. Subagents are separate rollouts with `source.subagent.thread_spawn.parent_thread_id`.
- Hooks: command only, Claude-style snake_case payloads, `model` on most events. Unverified: legacy vs paginated history mode default, `hooks.json` matcher schema.

## T3 Code (local SQLite store, verified on a real install)
- `~/.t3/userdata/statev2.sqlite` (WAL mode, companion `-wal` / `-shm`): `projection_projects` (`project_id`, `workspace_root`), `orchestration_v2_projection_threads` (`thread_id`, `project_id`, `title`, `default_provider`, `created_at`, `updated_at`, `deleted_at`), `orchestration_v2_projection_provider_sessions` (`payload_json.model`), `orchestration_v2_projection_runs` (`payload_json.modelSelection.model`), `orchestration_v2_projection_subagents` (`subagent_id`, `thread_id`, `provider`, `child_thread_id`, `status`, `started_at`, `completed_at`, `payload_json`), `orchestration_v2_projection_messages` (`thread_id`, `role`, `created_at`, `payload_json.text`), `orchestration_v2_projection_turn_items` (`turn_item_id`, `thread_id`, `type`, `status`, `updated_at`, `payload_json`).

## Cursor — https://cursor.com/docs/agent/hooks
- Transcripts (verified on a real install): `~/.cursor/projects/<project>/agent-transcripts/<session>/<session>.jsonl` and `.../subagents/<agent>.jsonl`; lines `{role, message:{content: string | [{type:"text"|"tool_use"|"tool_result", text?, id?, name?, input?, tool_use_id?, is_error?}]}}` without per-line timestamps.
- `~/.cursor/hooks.json` `{version:1, hooks:{event:[{command}]}}`, stdin JSON with `conversation_id`, `generation_id`, `model`; `preToolUse`/`postToolUse`/`postToolUseFailure` with `tool_use_id`; `subagentStart` with `subagent_id`, `tool_call_id`, `parent_conversation_id`, `subagent_model`.
- Unverified: whether a subagent's own events use `subagent_id` as `conversation_id`; whether `cursor-agent` CLI runs hooks; what an empty stdout means for `preToolUse`.

## GitHub Copilot CLI — https://docs.github.com/en/copilot/reference/hooks-configuration
- Transcripts (verified on a real install): `~/.copilot/session-state/<session>/events.jsonl`; JSONL `{type, timestamp, data}` covering `session.start`, `user.message`, `assistant.message`, `tool.execution_start`, `tool.execution_complete`, `subagent.started`, `subagent.completed`.
- `~/.copilot/hooks/*.json`, camelCase stdin `sessionId`, `timestamp`, `toolName`, `toolArgs`, `toolResult.resultType`. No tool ids, no model, no event name in the payload.

## Gemini CLI — docs/hooks/reference.md in google-gemini/gemini-cli
- Hooks in `settings.json`: `session_id`, `hook_event_name`, `BeforeTool`/`AfterTool` (`tool_response.error`), `BeforeAgent`/`AfterAgent`, `BeforeModel.llm_request.model`. No tool id. Unverified: the hook definition schema.
- Chat files are append-only JSONL with `$set`/`$patch`/`$rewindTo` lines (not used: patch semantics undocumented).

## Grok Build (xai-org/grok-build) — user-guide/10-hooks.md
- camelCase `hookEventName`, `sessionId`, `toolName`, `toolInput`, `toolUseId`, `lastAssistantMessage`. Unverified: the prompt field name, the SubagentStart payload.

## Antigravity — https://antigravity.google/docs/hooks
- Transcripts (verified on a real install): `~/.gemini/antigravity/brain/<session>/.system_generated/logs/transcript.jsonl`; JSONL `{step_index, source, type, status, created_at, content, tool_calls}`.
- `~/.gemini/config/hooks.json`; stdin `conversationId`, `workspacePaths`, `modelName`, `lastUserInput`, `toolCall{name,args}`, `stepIdx`, `error`. Event name field undocumented (sent as `?event=`). Conversation `.pb` storage is undocumented.

## OpenCode (anomalyco/opencode v1.2.27)
- Plugins in `~/.config/opencode/plugins/`; the `event` hook receives every bus event: `session.created|updated` (`info.parentID`), `message.updated`, `message.part.updated` (tool parts with `callID` and `state.status`). Storage moved to SQLite in v1.2.0 (not used).

## Cline (v3.40.0 source)
- Executables named after events in `~/Documents/Cline/Hooks/`; stdin `task_id`, `pre_tool_use{tool_name, parameters}`, `post_tool_use{…, success}`. Unverified: key casing (both accepted).

## Windsurf — docs.devin.ai cascade hooks
- `trajectory_id`, `agent_action_name`, `model_name`, `tool_info`; read/write/run_command/mcp pre and post events. Unverified: exact config path.

## Not supported
- Kiro: payloads for most triggers undocumented. Amp: thread storage and plugin location undocumented. Roo Code: no hooks.
