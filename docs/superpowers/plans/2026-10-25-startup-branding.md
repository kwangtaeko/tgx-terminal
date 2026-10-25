# Startup Branding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a short, TGX-owned startup indicator without altering provider terminal behavior.

**Architecture:** A pure branding view creates safe ASCII frames. The single-session lifecycle owns its initial frame; tab mode derives branding visibility from explicit manager output metadata and renders it only in the existing TGX-owned tab row.

**Tech Stack:** TypeScript strict, Vitest, existing PTY/VT renderer.

**Spec:** `docs/superpowers/specs/2026-10-25-startup-branding-design.md`

## Global Constraints

- No raw child bytes, provider logo assets, credential data, or input mutations enter branding.
- Branding disappears after first successful child output, lifecycle error, or exit.
- One-row tab view preserves the complete child viewport.

## Review Focus

- A failed screen write must not falsely end branding.
- Natural exit before any output must not leave a stale starting state.
- The first normal renderer frame must fully replace the single-session branding frame.
- Tab creation/selection after startup must not replay branding.
- Existing input, resize, cleanup, and default renderer calls remain compatible.

### Task 1: Pure branding view and output metadata

**Files:**
- Create: `src/dashboard/startup-brand-view.ts`
- Modify: `src/session/multi-session-manager.ts`
- Test: `tests/unit/startup-brand-view.test.ts`, `tests/unit/multi-session-manager.test.ts`

- [ ] Write failing tests for bounded branding text and success-only output metadata.
- [ ] Implement the pure view and `hasReceivedOutput` session metadata.
- [ ] Run focused tests.

### Task 2: Single and tabbed lifecycle wiring

**Files:**
- Modify: `src/cli.ts`, `src/dashboard/tab-strip-view.ts`
- Test: `tests/integration/cli-lifecycle.test.ts`, `tests/unit/tab-strip-view.test.ts`

- [ ] Write failing lifecycle tests for startup frame and the tab-state transition.
- [ ] Render the startup frame safely, carry explicit tab startup state, and switch after the initial session output or terminal lifecycle end.
- [ ] Run full test/typecheck/build/diff verification, direct PTY smoke, and update `docs/validation.md`.
