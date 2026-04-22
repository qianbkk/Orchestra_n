# ATO Copilot Instructions

This file is based on `README.md`, `TASK.md`, and `CLAUDE.md` and extends the existing instructions with concrete run commands, architecture flow, and repository-specific conventions.

## Current repository state

This repository is currently spec-first (documentation exists, implementation files are planned in `TASK.md`). Follow the documented target architecture and scripts when adding code.

## Build, test, and lint commands

Use these project commands as defined in docs (`README.md` + `TASK.md`):

```bash
# install dependencies (workspace root)
npm install

# run frontend + backend in dev mode
npm run dev

# build frontend
npm run build

# start backend server (serves app in production flow)
npm start
```

Backend commands (workspace):

```bash
# backend dev
npm run dev -w backend

# backend tests
npm run test -w backend

# run one backend test file
npm run test -w backend -- tests/<name>.test.js
```

No lint command is currently documented in this repository.

## High-level architecture

ATO is a localhost-only multi-agent orchestrator:

1. User submits a task from the React frontend.
2. Backend `scheduler` sends it to the coordinator agent.
3. Coordinator either replies directly or emits strict `<ato-dispatch>` XML.
4. `dispatchParser` extracts serial/parallel subtasks.
5. `agentManager` executes subtasks through per-CLI adapters (`claude-code`, `gemini`, `codex`, `copilot`) using per-message subprocess calls.
6. Streaming chunks are forwarded to frontend over WebSocket (`AGENT_OUTPUT`, status/progress/error events), persisted by `historyManager`, and tracked by `healthChecker`.
7. Subtask outputs are aggregated and sent back to coordinator until final answer or max rounds.

Persistence model:

- `<workdir>/.agent-team`: team and coordinator configuration
- `<workdir>/.agent-history/<taskId>.json`: append-only task execution history

Frontend model:

- Zustand store is the single source of truth for connection state, agent statuses, logs, running task state, timeout alerts, and history.
- WebSocket hook dispatches backend events into store actions.

## Key conventions for this codebase

### Locked protocol and orchestration behavior

- Coordinator delegation must use **only** this XML envelope:

```xml
<ato-dispatch>
  <task agent="EXACT_AGENT_NAME" mode="serial|parallel" id="UNIQUE_ID">...</task>
  <timeout seconds="N" />
  <collect-after ids="id1,id2" />
</ato-dispatch>
```

- If response has no `<ato-dispatch>`, treat it as final user-facing output.
- Scheduler guardrails from specs:
  - max dispatch rounds: `10`
  - default timeout: `120s`
  - health-check tick: `15s`
  - timeout override is coordinator-driven only (`<timeout seconds="..."/>`, 30-1800)

### Coordinator prompt injection is mandatory

- `configManager.saveConfig` must inject the coordinator protocol prompt automatically and include the real team member name list.
- Coordinator `systemPrompt` from UI is not authoritative and should be overwritten during save.

### CLI adapter/runtime conventions

- Process lifecycle is fixed: **one subprocess per message**, then exit.
- Claude standard invocation: `claude --dangerously-skip-permissions -c`.
- Detect session-continuation flags at runtime for each CLI; if unavailable, prepend short conversation summary (<=1000 chars).
- Adapter availability failures should surface explicit install/actionable errors (not silent fallback).

### Frontend performance and UX conventions

- Agent log retention limit: latest 500 entries per agent.
- `AgentLogViewer` must use virtualization (`@tanstack/react-virtual`).
- WebSocket message handling should be debounced (~50ms) to avoid render storms.
- `copilot` agent option must show warning that Copilot CLI is command-suggestion oriented.

### Security and boundary constraints (do not relax)

- Server bind address must stay `127.0.0.1` only.
- Every subprocess call must set `cwd` to resolved workdir.
- Validate all file paths with `path.resolve` and prevent path traversal.
- Do not add externally exposed network interfaces.

### Documentation/update workflow conventions

- Chinese docs are authoritative for requirements and behavior.
- After functional/file changes, sync docs deliberately:
  - `index.md` for file additions/removals/moves/renames
  - `README.md` for user-visible behavior/config/flow changes
  - `progress.txt` for encountered issues and resolutions
- `CLAUDE.md` changes are reserved for architecture-level decisions only.

