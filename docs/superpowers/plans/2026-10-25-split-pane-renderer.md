# Split Pane Renderer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Safely compose two parsed VT snapshots into a split-pane frame.

**Architecture:** A standalone renderer validates snapshot-to-rect geometry, constructs complete physical rows, and diff-repaints changed rows. It shares only the safe styled-line renderer and remains disconnected from CLI/PTY lifecycle.

**Tech Stack:** TypeScript strict, Vitest, existing ScreenSnapshot renderer utilities.

**Spec:** `docs/superpowers/specs/2026-10-25-split-pane-renderer-design.md`

## Global Constraints

- Raw PTY output never reaches the pane renderer.
- A mismatched snapshot is rejected, never clipped or overlaid.
- A row is cleared once before all pane content is placed.

## Review Focus

- Side-by-side second pane survives first pane short output and row clear.
- Stacked separator owns the entire separator row.
- Identical frames emit nothing; changing one pane re-renders only affected rows.
- Geometry mismatch does not emit child-originated text.
- No existing terminal renderer or CLI path changes.

### Task 1: Parsed split frame renderer

**Files:**
- Create: `src/terminal/split-pane-renderer.ts`
- Create: `tests/unit/split-pane-renderer.test.ts`

- [ ] Write failing tests for side-by-side/stacked placement, diff repaint, and geometry rejection.
- [ ] Implement `SplitPaneRenderer.render(first, second, layout): string`.
- [ ] Run focused and full verification; record results.
