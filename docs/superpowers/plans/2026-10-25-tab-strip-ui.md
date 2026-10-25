# Tab Strip UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render a safe, opt-in TGX-owned tab strip above tabbed PTY sessions.

**Architecture:** A tabbed layout reserves one physical row only when possible. The existing safe sidecar renderer owns that row and offsets child/dashboard coordinates; a pure view formats session metadata into bounded ASCII text.

**Tech Stack:** TypeScript strict, Vitest, existing VT snapshot renderer.

**Spec:** `docs/superpowers/specs/2026-10-25-tab-strip-design.md`

## Global Constraints

- Default single-session launch, provider arguments, and input bytes remain unchanged.
- Tab strip is rendered only from TGX-owned session metadata and never from raw PTY output.
- One-row terminals retain their complete child viewport.

## Review Focus

- Sidecar coordinates must begin below the tab strip without overwriting child line zero.
- Resize must give all running tab PTYs the same child geometry used for rendering.
- Narrow widths must not emit controls or overflow the physical row.
- Exited/error sessions must remain visible until explicit close.
- Default non-tab rendering must preserve its existing calls and geometry.

### Task 1: Tabbed layout and view

**Files:**
- Modify: `src/layout/single-session-layout.ts`
- Create: `src/dashboard/tab-strip-view.ts`
- Test: `tests/unit/single-session-layout.test.ts`, `tests/unit/tab-strip-view.test.ts`

- [ ] Write failing layout/view tests for the two-row boundary, selected status, and bounded ASCII output.
- [ ] Implement `computeTabbedSessionLayout` and `createTabStripView`.
- [ ] Run the focused unit tests.

### Task 2: Safe renderer and CLI wiring

**Files:**
- Modify: `src/terminal/sidecar-renderer.ts`, `src/cli.ts`
- Test: `tests/unit/sidecar-renderer.test.ts`, `tests/integration/cli-lifecycle.test.ts`

- [ ] Write failing renderer/CLI tests for row offsets and tabbed child size/render state.
- [ ] Add the optional tab-render state, render tab strip before child rows, and use tabbed layout only for `--tgx-tabs`.
- [ ] Run focused tests, then full test/typecheck/build/diff verification and record results.
