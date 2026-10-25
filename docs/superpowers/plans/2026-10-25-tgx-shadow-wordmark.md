# TGX Shadow Wordmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the block ASCII startup logo with a transparent ANSI TGX wordmark whose front face has a one-cell down-right shadow.

**Architecture:** `startup-brand-view.ts` remains the sole TGX-owned startup renderer. It will format a bounded compact or large wordmark from static ASCII rows, emitting dark shadow rows before bright front rows so the terminal background remains untouched. Tests will specify the terminal bytes and height boundaries.

**Tech Stack:** TypeScript strict, Vitest, ANSI SGR/CUP/EL, xterm-256color.

**Spec:** `docs/superpowers/specs/2026-10-25-tgx-shadow-wordmark-design.md`

## Global Constraints

- Do not alter provider PTY input, output, launch arguments, or global configuration.
- Use only bounded ASCII text and ANSI SGR/CUP/EL; reset SGR at the end of every frame.
- Do not paint a background colour or add provider branding.
- Preserve the 1-row and 7-row startup height boundaries.

## Review Focus

- One-row terminals must not emit a second cursor row; Task 1 tests the compact frame.
- Six-row terminals must remain compact; Task 1 tests the boundary.
- Seven-row terminals must render the shadow and front rows without an eighth row; Task 1 tests the boundary.
- Each rendered row must clear stale characters without a background colour; Task 1 tests CUP/EL and foreground-only SGR.
- The final reset must prevent style leakage into provider output; Task 1 tests the trailing reset.

---

### Task 1: Render and verify the ANSI shadow wordmark

**Files:**
- Modify: `src/dashboard/startup-brand-view.ts`
- Modify: `tests/unit/startup-brand-view.test.ts`
- Modify: `docs/validation.md`

**Interfaces:**
- Consumes: `renderStartupBrandFrame(provider, columns, availableRows)`.
- Produces: the same function signature with a compact and large foreground/shadow wordmark frame.

- [x] **Step 1: Write failing startup view assertions**

Assert that the large frame includes a dark foreground-only shadow at a down-right coordinate, a bright foreground-only `TGX` front row, excludes the former block-ASCII rows, preserves row bounds, and ends in reset.

- [x] **Step 2: Run the focused test to verify failure**

Run: `pnpm.cmd exec vitest run tests/unit/startup-brand-view.test.ts`

Expected: FAIL because the current block-ASCII frame has neither the required foreground SGR values nor the new row coordinates.

- [x] **Step 3: Implement the bounded frame update**

Keep `createStartupBrandLine` unchanged. Replace only startup frame rows with static ASCII `TGX` front/shadow rows and foreground SGR constants; do not change the function signature or renderer consumers.

- [x] **Step 4: Run focused and full verification**

Run: `pnpm.cmd exec vitest run tests/unit/startup-brand-view.test.ts; pnpm.cmd test; pnpm.cmd typecheck; pnpm.cmd build; git diff --check`

Expected: all tests, typecheck, build, and whitespace check succeed.

- [x] **Step 5: Record validation and commit**

Record the exact commands and the unverified Windows visual smoke check in `docs/validation.md`, then commit the feature and tests.
