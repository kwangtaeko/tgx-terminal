# TGX Live Statusline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static statusline with verified TGX-owned session, project, and tab facts that refresh once per second.

**Architecture:** A small project-context reader obtains a bounded local Git description once and falls back to the cwd basename. The statusline view formats a supplied live context; CLI lifecycle code owns launch time and a cleaned-up unref'ed refresh ticker, so neither the view nor provider adapter touches a child CLI.

**Tech Stack:** TypeScript strict, Node.js `path` and `child_process`, Vitest, existing ANSI status row renderer.

**Spec:** `docs/superpowers/specs/2026-10-25-tgx-live-statusline-design.md`

## Global Constraints

- Never auto-enter `/status`, parse provider TUI text, or show invented usage values.
- Git uses executable/argument arrays, 250ms timeout, and cannot block child I/O.
- Refresh exactly once per second, use `unref()`, and clear on every CLI cleanup path.
- Keep a background-free, bounded ASCII status row and preserve the child viewport/cursor.

## Review Focus

- Non-Git cwd must show the cwd basename; Task 1 tests fallback.
- Git command failure/timeout must not terminate the CLI; Task 1 tests fallback.
- Dirty flag must ignore untracked files; Task 1 tests tracked-change result only.
- One-hour elapsed values must use `hh:mm:ss`; Task 2 tests formatting boundaries.
- Ticker must not retain a process or render after cleanup; Task 3 tests unref/clear behavior with injected scheduler.

---

### Task 1: Read safe project context

**Files:**
- Create: `src/dashboard/project-context.ts`
- Create: `tests/unit/project-context.test.ts`

**Interfaces:**
- Produces: `readProjectContext(cwd, execute?) -> { projectName, branch?, dirty }`.

- [x] Write failure tests for Git branch, tracked dirty state, non-Git fallback, and command error fallback.
- [x] Run `pnpm.cmd exec vitest run tests/unit/project-context.test.ts` and verify RED.
- [x] Implement bounded read-only Git calls with injected executor and 250ms production timeout.
- [x] Re-run the focused test and verify GREEN.

### Task 2: Format live statusline facts

**Files:**
- Modify: `src/dashboard/status-line-view.ts`
- Modify: `tests/unit/status-line-view.test.ts`

**Interfaces:**
- Consumes: `{ provider, lifecycle, startedAt, now, project, tabs, ready }` and columns.
- Produces: bounded ASCII statusline with elapsed/project/tab/usage guidance.

- [x] Write failing tests for dynamic elapsed, project branch/dirty marker, Codex `/status`, Claude unavailable, and width bounds.
- [x] Run focused test and verify RED.
- [x] Replace provider-version/refresh-source formatting with live context formatting.
- [x] Re-run focused test and verify GREEN.

### Task 3: Refresh status safely during session lifetime

**Files:**
- Modify: `src/cli.ts`
- Modify: `tests/integration/cli-lifecycle.test.ts`

**Interfaces:**
- Produces: a 1-second unref'ed refresh for visible status rows, disposed in single and tabbed cleanup.

- [x] Write failing lifecycle tests with an injected scheduler for scheduled refresh and cleanup.
- [x] Run focused test and verify RED.
- [x] Add the minimal scheduler dependency and status context wiring for single/tab sessions.
- [x] Run focused and full `pnpm.cmd test; pnpm.cmd typecheck; pnpm.cmd build; git diff --check`, record validation, then commit.
