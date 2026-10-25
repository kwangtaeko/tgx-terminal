# TGX 투명 Statusline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기본 TGX 화면을 ccstatusline 스타일의 투명 하단 상태줄로 전환한다.

**Architecture:** layout은 bottom status row를 명시하고 child PTY viewport를 줄인다. renderer는 parsed child rows 뒤에 fixed-width statusline을 그리고 child cursor를 복구한다. status text builder는 확인된 provider state만 소비한다.

**Tech Stack:** TypeScript strict, Vitest, ANSI/VT.

**Spec:** `docs/superpowers/specs/2026-10-25-tgx-statusline-design.md`

## Global Constraints

- provider 입력·승인·본문을 수정하거나 파싱하지 않는다.
- statusline은 기본 배경색을 설정하지 않는 printable ASCII다.
- 검증되지 않은 usage 값은 만들지 않는다.

## Review Focus

- 1행 narrow terminal fallback은 Task 1에서 검증한다.
- tab top row와 bottom status row cursor offset은 Task 2에서 검증한다.
- unsupported usage의 금지 값 미노출은 Task 1에서 검증한다.
- child cursor 복구는 Task 2에서 검증한다.

### Task 1: Layout과 status text

**Files:**
- Modify: `src/layout/single-session-layout.ts`
- Create: `src/dashboard/status-line-view.ts`
- Test: `tests/unit/single-session-layout.test.ts`, `tests/unit/status-line-view.test.ts`

- [x] 80x24/80x1 layout 및 unsupported status line 실패 테스트를 작성한다.
- [x] bottom status layout과 fixed-width status text를 구현한다.
- [x] focused tests를 통과시킨다.

### Task 2: Bottom-row renderer와 CLI 연결

**Files:**
- Modify: `src/terminal/sidecar-renderer.ts`, `src/cli.ts`
- Test: `tests/unit/sidecar-renderer.test.ts`, `tests/integration/cli-lifecycle.test.ts`

- [x] bottom row/cursor restoration 실패 테스트를 작성한다.
- [x] renderer와 default dependencies에서 status line을 연결한다.
- [x] full test·typecheck·build 후 커밋한다. Windows PTY smoke는 다음 수동 확인 항목이다.
