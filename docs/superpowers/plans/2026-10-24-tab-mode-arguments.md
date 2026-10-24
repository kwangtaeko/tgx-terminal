# Tab Mode Arguments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consume an explicit `--tgx-tabs` wrapper option without altering provider arguments.

**Architecture:** Add a pure parser in `src/launch/`; `runCli` integration remains a later change.

**Tech Stack:** TypeScript strict, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-24-tab-mode-arguments-design.md`

### Task 1: Parse wrapper-owned tab mode safely

**Files:**
- Create: `src/launch/tab-mode-arguments.ts`
- Create: `tests/unit/tab-mode-arguments.test.ts`
- Modify: `docs/validation.md`

- [ ] Write failing tests for default mode, a consumed pre-separator option, repeated options, and a literal post-separator option.
- [ ] Run `pnpm.cmd exec vitest run tests/unit/tab-mode-arguments.test.ts` and verify module-not-found failure.
- [ ] Implement `parseTabModeArguments(args)` with `{ tabsEnabled, passthrough }`.
- [ ] Run focused and full Vitest, typecheck, build, and diff checks; record validation evidence.
