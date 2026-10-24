# Multi-session Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve independent PTY and VT state for several sessions while routing input only to the selected session.

**Architecture:** Add a session-only coordinator in `src/session/` that owns session ports, screen models, output subscriptions, selection, bounded creation, resize, and ordered cleanup. It has no parent-terminal keyboard handling and does not modify `runCli`; a later opt-in control plane will invoke this core.

**Tech Stack:** Node.js 22, TypeScript strict, Vitest 5, existing PTY and xterm-headless adapters.

**Spec:** `docs/superpowers/specs/2026-10-24-multi-session-core-design.md`

## Global Constraints

- Do not inject input, approval bypasses, or global configuration changes into Codex or Claude Code.
- Preserve raw Korean input, multiline paste, Tab, Ctrl+C, and Esc for the selected child PTY.
- Do not relay child-originated control bytes directly to the parent terminal.
- Bound the session count; retain the existing bounded VT scrollback policy.
- Do not persist credentials, conversation text, or raw child logs.
- A single session failure must not interrupt another session.

## Review Focus

- Selection changes during inactive-session output: Task 1 verifies output stays in the producer's screen model.
- Input with no selected session or an unknown ID: Task 1 verifies it is rejected without reaching any PTY.
- Maximum session count: Task 1 verifies creation is rejected before a PTY or screen is allocated.
- Resize after more than one session starts: Task 2 verifies every running session receives the validated size while a terminated session is unchanged.
- Cleanup if one close rejects: Task 2 verifies subscriptions and remaining sessions still dispose after queued output drains.
- A screen write failure: Task 2 verifies only the producer becomes `error` and another session continues to render.
- Slow or bursty output: Task 2 verifies queued bytes are bounded and a failed setup rolls back its allocated PTY.

---

### Task 1: Bounded session ownership and selected-input routing

**Files:**
- Create: `src/session/multi-session-manager.ts`
- Create: `tests/unit/multi-session-manager.test.ts`

**Interfaces:**
- Consumes: `ChildLaunch`, `Disposable`, `SessionExit`, `TerminalSize`, `ScreenSnapshot`.
- Produces: `MultiSessionManager`, `ManagedSession`, `ManagedSessionStatus`, `MultiSessionDependencies`.

- [ ] **Step 1: Write failing manager tests**

Cover creating two sessions, selecting each one, routing an unchanged Korean multiline string only to the selected session, retaining separate screen snapshots for concurrent output, and rejecting an unknown selection or input with no selection.

- [ ] **Step 2: Run the manager test to verify it fails**

Run: `pnpm.cmd exec vitest run tests/unit/multi-session-manager.test.ts`
Expected: FAIL because `multi-session-manager` does not exist.

- [ ] **Step 3: Implement the minimum session manager**

Define a session port with `onData`, `onExit`, `write`, `resize`, and `close`; define a screen port with `write`, `resize`, `snapshot`, and optional `dispose`. `create(launch)` allocates a generated ID, subscribes output only to that session's screen, and selects the first session. `writeSelected(data)` forwards unchanged data only to the selected active port.

- [ ] **Step 4: Run the manager test and typecheck**

Run: `pnpm.cmd exec vitest run tests/unit/multi-session-manager.test.ts; pnpm.cmd typecheck`
Expected: PASS.

### Task 2: Bounds, resize, exit isolation, and ordered cleanup

**Files:**
- Modify: `src/session/multi-session-manager.ts`
- Modify: `tests/unit/multi-session-manager.test.ts`
- Modify: `docs/validation.md`

**Interfaces:**
- Consumes: Task 1 manager interfaces.
- Produces: `resize(size)`, `close(id)`, `closeAll()` and status snapshots.

- [ ] **Step 1: Write failing lifecycle tests**

Assert the configured retained-tab limit rejects before allocation; resize reaches every running session and screen but not a terminated tab; an inactive session exit does not deselect a live selected session; output received before exit drains into the retained screen; a screen write rejection or queued-output limit marks only its session `error`; setup failure closes its PTY; and `closeAll` continues cleanup after one close rejects.

- [ ] **Step 2: Run the lifecycle tests to verify they fail**

Run: `pnpm.cmd exec vitest run tests/unit/multi-session-manager.test.ts`
Expected: FAIL for missing bound, resize, exit, or cleanup behavior.

- [ ] **Step 3: Implement bounded lifecycle behavior**

Validate sizes before mutating sessions. Preserve a terminal exit and final screen until explicit `close`, and select the next running session only if the selected one exits. Bound queued UTF-8 bytes and chunks; catch a screen write rejection, mark only that session `error`, and discard its later output. Drain already accepted output before disposing a screen. Roll back a partially created session by disposing subscriptions and screen, then closing the PTY. Use `Promise.allSettled` in `closeAll`, dispose every screen, then report the first close failure.

- [ ] **Step 4: Run focused and full verification; record it**

Run: `pnpm.cmd exec vitest run tests/unit/multi-session-manager.test.ts; pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check`
Expected: PASS. Add the exact command and observed result to `docs/validation.md`; mark real interactive multi-tab behavior as pending manual verification.

## Plan Self-Review

- Spec coverage: Task 1 establishes independent PTY/screen/input ownership; Task 2 establishes bounds, resize, exit isolation, cleanup, and validation evidence.
- Type consistency: both tasks use the session and screen port types defined in Task 1; `ScreenSnapshot` remains the renderer boundary.
- Review focus: all five listed failure modes have named Task 1 or Task 2 tests.
- Proportion: the plan deliberately excludes terminal key interception and visual tab rendering until a separate opt-in control-plane decision is made.
