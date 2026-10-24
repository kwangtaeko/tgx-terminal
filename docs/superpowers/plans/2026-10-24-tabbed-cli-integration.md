# Tabbed CLI Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect explicit tab mode to isolated sessions without changing the default CLI path.

**Architecture:** `runCli` parses wrapper arguments then dispatches unchanged single-session behavior or a tabbed controller. `MultiSessionManager.onChange` drives selected-snapshot rendering; one input queue serializes forwarding and tab commands.

**Spec:** `docs/superpowers/specs/2026-10-24-tabbed-cli-integration-design.md`

### Task 1: Observable session manager

- [ ] Test manager change notifications for create, output completion, selection, resize, exit, and close; listener failure is isolated.
- [ ] Implement `onChange(listener)` with immutable listener ownership and swallowed listener exceptions.

### Task 2: Opt-in CLI tab lifecycle

- [ ] Add failing integration tests for default single session, `Ctrl+T n`, selection/input routing, resize, and final-tab restore.
- [ ] Branch `runCli` using parsed tab arguments; run tabbed lifecycle only for opt-in mode.
- [ ] Serialize control actions and input, render only the selected snapshot, and clean up all tabs before terminal restore.
- [ ] Run full verification and record validation evidence.
