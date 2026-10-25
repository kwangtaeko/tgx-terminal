# TGX 시작 배지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** provider 화면 전에 표시되는 TGX 고유 시작 배지를 만든다.

**Architecture:** `startup-brand-view`는 tab bar용 단일 행과 기본 세션용 3행 ANSI frame을 독립적으로 생성한다. CLI의 시작/전환 제어는 바꾸지 않는다.

**Tech Stack:** TypeScript strict, Vitest, ANSI/VT.

**Spec:** `docs/superpowers/specs/2026-10-25-tgx-startup-badge-design.md`

## Global Constraints

- printable ASCII와 고정 폭만 사용한다.
- provider 로고·색상·본문을 복제하지 않는다.
- 자식 PTY와 입력 경계를 수정하지 않는다.

## Review Focus

- 80열 기본 frame의 세 줄 배지와 provider 이름은 Task 1에서 검증한다.
- 좁은 폭 단일 행의 절단·패딩은 Task 1에서 검증한다.
- ANSI full frame이 자식 내용을 포함하지 않는 것은 Task 1에서 검증한다.

### Task 1: ASCII 시작 배지

**Files:**
- Modify: `src/dashboard/startup-brand-view.ts`
- Modify: `tests/unit/startup-brand-view.test.ts`

**Interfaces:**
- Consumes: `createStartupBrandLine(provider: Provider, columns: number)`
- Produces: `renderStartupBrandFrame(provider: Provider, columns: number)`의 3행 TGX ANSI frame

- [x] 실패 테스트로 tab line과 3행 frame의 고정 ASCII 배지를 검증한다.
- [x] focused test를 실행해 기존 단순 시작 문구 assertion이 실패함을 확인한다.
- [x] 기존 호출을 유지하는 optional viewport height로 배지 행을 생성한다.
- [x] focused/full test·typecheck·build를 실행하고 커밋한다.

Ruling: 독립 리뷰에서 1행 terminal의 화면 밖 cursor 이동을 확인했다. `renderStartupBrandFrame`에 optional viewport height를 추가하고 `cli.ts`가 `layout.terminal.rows`를 전달한다. 높이를 모르는 직접 호출은 기존 3행 배지로 유지한다.
