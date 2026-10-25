# Split Pane Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a pure, validated two-pane geometry planner for later P3 PTY integration.

**Architecture:** The planner receives only the already-owned child terminal canvas and caller-provided minimum pane dimensions. It returns zero-based rectangles or `undefined`; no existing single-session layout, renderer, or CLI lifecycle is changed.

**Tech Stack:** TypeScript strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-split-pane-layout-design.md`

## Global Constraints

- No input interception, PTY allocation, raw VT output, or parent-terminal rendering occurs in this increment.
- Narrow canvases must return `undefined`, never create undersized panes.
- Rectangles use zero-based coordinates; ANSI conversion is a later renderer responsibility.

## Review Focus

- Odd available columns/rows must go only to the second pane.
- Separator must be exactly one logical cell wide/high.
- Success rectangles must cover the canvas without overlap or gaps.
- Constraints and canvas dimensions must reject invalid numeric values.
- Sidecar and tab bar must not leak into this child-canvas-only contract.

### Task 1: Pure split geometry

**Files:**
- Create: `src/layout/split-pane-layout.ts`
- Create: `tests/unit/split-pane-layout.test.ts`

- [ ] Write failing tests for even/odd side-by-side and stacked geometry, narrow fallback, and invalid dimensions.
- [ ] Implement `computeSplitPaneLayout(canvas, orientation, constraints): SplitPaneLayout | undefined`.
- [ ] Run focused tests, full suite/typecheck/build/diff verification, and record results.
