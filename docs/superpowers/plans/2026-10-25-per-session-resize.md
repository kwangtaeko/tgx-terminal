# Per-Session Resize Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the session manager create and resize individual PTY/VT pairs at pane-specific sizes.

**Architecture:** Extend only `MultiSessionManager` ownership methods: optional custom creation size and a validated one-session resize API. Existing global resize keeps its current tab semantics.

**Tech Stack:** TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-per-session-resize-design.md`

## Global Constraints

- The PTY and screen for one session always receive the same size.
- Invalid sizes and unknown ids do not mutate other sessions.
- Global tab resize and selected-input routing remain unchanged.

## Review Focus

- Custom creation must not overwrite the default size for later size-less sessions.
- Exited/error sessions remain untouched by individual resize.
- A resize failure is contained to the target session.
- PTY and screen receive the same validated dimensions.
- No renderer or CLI lifecycle change is introduced.

### Task 1: Per-session size ownership

**Files:**
- Modify: `src/session/multi-session-manager.ts`
- Modify: `tests/unit/multi-session-manager.test.ts`

- [ ] Write failing manager tests for custom create, targeted resize, default-size preservation, and target-only failure isolation.
- [ ] Add `create(launch, size?)` and `resizeSession(id, size)` with existing validation/error policies.
- [ ] Run focused and full verification; record results.
