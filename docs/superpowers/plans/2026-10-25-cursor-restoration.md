# Cursor Restoration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the child VT cursor after every safe TGX repaint so typed input remains at the child cursor.

**Architecture:** Extend the existing safe outer and sidecar renderer frame state with clamped cursor coordinates. After full or changed-row paints, emit reset + CUP + show-cursor; a cursor-only move emits no row clear.

**Tech Stack:** TypeScript strict, Vitest, Windows VT cursor sequences.

**Spec:** `docs/superpowers/specs/2026-10-25-cursor-restoration-design.md`

## Global Constraints

- Only parsed `ScreenSnapshot.cursor` controls the restored cursor.
- No raw child escape sequence is relayed.
- Tab-bar offset applies only to the sidecar renderer child cursor.

## Review Focus

- Cursor-only movement must not repaint text rows.
- Full and diff outer frames end at the correct one-based cursor position.
- Tab bar cursor row offset is exact.
- Out-of-range snapshot cursor values are clamped.
- Existing styling and sidecar content remain unchanged.

### Task 1: Safe cursor-aware renderers

**Files:**
- Modify: `src/terminal/outer-renderer.ts`, `src/terminal/sidecar-renderer.ts`
- Modify: `tests/unit/screen-model.test.ts`, `tests/unit/sidecar-renderer.test.ts`

- [ ] Write failing tests for outer cursor restoration, cursor-only update, and tab-bar offset.
- [ ] Add cursor state and final cursor sequence to both renderers.
- [ ] Run focused/full verification and then perform Windows Korean input manual validation.
