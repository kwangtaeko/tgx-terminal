# Tab Control Decoder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decode opt-in tab prefix commands without changing ordinary provider CLI input.

**Architecture:** Add a pure state machine in `src/control/` with no terminal, PTY, or manager dependencies. It emits immutable actions; future CLI integration decides whether to instantiate it with `enabled: true`.

**Tech Stack:** TypeScript strict, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-24-tab-control-decoder-design.md`

## Global Constraints

- Disabled control mode forwards every input byte sequence unchanged.
- The decoder must not write to a PTY, alter provider arguments, or inspect child output.
- Ctrl+C, Tab, Esc, Korean input, and multiline paste remain forward actions unless a user-enabled `Ctrl+T` command sequence matches.

## Review Focus

- A prefix at the end of one input chunk: Task 1 tests `flush()` and a command in the next chunk.
- Unknown prefix command: Task 1 tests the literal prefix and code point return to the child unchanged.
- Paste containing a prefix: Task 1 tests deterministic opt-in command consumption and ordinary text preservation around it.
- Reuse after flush: Task 1 tests the decoder returns to idle state.

---

### Task 1: Pure opt-in prefix decoder

**Files:**
- Create: `src/control/tab-control-decoder.ts`
- Create: `tests/unit/tab-control-decoder.test.ts`
- Modify: `docs/validation.md`

**Interfaces:**
- Produces: `TabControlDecoder`, `TabControlAction`, `TabCommand`, `createTabControlDecoder(options)`.

- [ ] **Step 1: Write failing behavior tests**

Assert disabled pass-through for Korean multiline data and control keys; active `Ctrl+T` plus `n`, `]`, `[`, `x`; command split over chunks; unknown command and double prefix forwarding; and `flush()` forwarding an unfinished prefix.

- [ ] **Step 2: Run the decoder test to verify it fails**

Run: `pnpm.cmd exec vitest run tests/unit/tab-control-decoder.test.ts`
Expected: FAIL because `tab-control-decoder` does not exist.

- [ ] **Step 3: Implement `createTabControlDecoder(options)`**

Use `\u0014` as the default prefix and an internal awaiting-command state. Coalesce adjacent forwarded text while preserving command ordering. Never emit an empty forward action.

- [ ] **Step 4: Run focused and complete verification; record evidence**

Run: `pnpm.cmd exec vitest run tests/unit/tab-control-decoder.test.ts; pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check`
Expected: PASS. Add the command and observed result to `docs/validation.md`.

## Plan Self-Review

- Spec coverage: Task 1 covers disabled safety, explicit prefix commands, chunk boundaries, unknown input, and unfinished prefix recovery.
- Review focus: each listed failure mode has a named Task 1 test.
- Proportion: no PTY, manager, or renderer integration is included because explicit wrapper activation is a separate behavior change.
