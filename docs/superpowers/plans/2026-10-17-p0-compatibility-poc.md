# TGX Terminal P0 Compatibility PoC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows 우선 환경에서 Codex CLI와 Claude Code를 자식 PTY로 실행할 수 있는 단일 세션 PoC를 만들고, 입력·화면·resize·종료 복구의 호환성 증거를 남긴다.

**Architecture:** CLI 엔트리는 공급자 실행 파일과 인자 배열을 검증해 단일 `PtySession`에 전달한다. 세션은 PTY 출력과 입력·resize·종료를 관리하고, 세션별 VT 화면 모델은 안전한 외부 렌더러에 변경 가능한 화면 상태만 제공한다. P0은 탭·분할·실제 사용량 수집을 포함하지 않는다.

**Tech Stack:** Node.js 지원 LTS, TypeScript strict, pnpm, `node-pty` 계열 PTY, 검증된 headless VT 모델, Vitest. 정확한 패키지·버전·Node 엔진은 Task 1의 공식 문서 및 Windows PoC 결과로 고정한다.

**Spec:** `docs/superpowers/specs/2026-10-17-tgx-terminal-design.md`

## Global Constraints

- Windows 네이티브를 우선 지원하고 WSL2/Linux는 미검증으로 기록한다.
- 실행은 셸 문자열 조립이 아니라 실행 파일과 인자 배열을 사용한다.
- 일반 입력·Tab·Ctrl+C·Esc·붙여넣기는 선택된 자식 PTY에 우선 전달한다.
- Codex·Claude Code의 실행 파일, 전역 설정, 승인·샌드박스·권한 통제를 변경하거나 우회하지 않는다.
- PTY 원문 출력을 부모 stdout으로 직접 전달하지 않는다. 자식 출력은 세션별 VT 화면 모델에만 적용한다.
- OSC 52와 창 조작 등 화면 외 효과를 내는 제어 시퀀스는 기본 차단한다. 미확인 제어 시퀀스 원문·대화 내용은 영구 로그로 저장하지 않는다.
- 스크롤백, 출력 큐, 진단 로그에는 명시적 상한을 둔다. fixture와 로그에는 비식별화된 데이터만 둔다.
- 실제 실행 결과와 미실행 검증을 `docs/validation.md`에 구분해 기록한다. 미실행을 통과로 쓰지 않는다.
- npm 게시, 배포, 원격 저장소 생성, 사용자 전역 설정 변경은 수행하지 않는다.

## Review Focus

- 한글 IME/여러 줄 붙여넣기: UTF-8 바이트를 변형하지 않고 선택된 PTY에 전달하는지 — Task 4의 `forwardsKoreanAndMultilinePaste` fixture 테스트와 실제 수동 검사로 고정한다.
- alternate screen: 자식의 버퍼 전환·복귀가 외부 화면 모델 밖으로 제어 시퀀스를 누출하지 않는지 — Task 5의 `rendersAlternateBufferWithoutOuterEscape` 테스트로 고정한다.
- 화면 외 OSC: OSC 52·창 제목 조작이 렌더 바이트에 포함되지 않는지 — Task 5의 `blocksNonVisualOscSequences` 테스트로 고정한다.
- Ctrl+C와 종료: 세션 종료가 자식 프로세스 트리를 정리하고 outer terminal 상태 복구 훅을 실행하는지 — Task 6의 `closesChildBeforeRestoringTerminal` 통합 테스트와 실제 수동 검사로 고정한다.
- resize: 레이아웃에서 계산한 유효 columns/rows가 PTY에 그대로 전달되는지 — Task 4의 `resizesPtyWithValidatedDimensions` 테스트로 고정한다.

---

## File Structure

| 파일 | 책임 |
| --- | --- |
| `package.json` | Node 엔진, ESM 패키지 메타데이터, 검사·테스트·실행 스크립트 |
| `tsconfig.json` | TypeScript strict 컴파일 경계 |
| `vitest.config.ts` | 단위·통합 테스트 실행 설정 |
| `src/cli.ts` | `tgx codex`·`tgx claude` 인자 해석과 단일 세션 조립 |
| `src/launch/command.ts` | 공급자별 실행 파일·전달 인자 계약과 검증 |
| `src/session/contracts.ts` | PTY 포트, 세션 상태, 종료 결과의 공용 타입 |
| `src/session/pty-session.ts` | PTY 생성, 입력, resize, 출력 구독, 종료 수명주기 |
| `src/terminal/control-sequence-policy.ts` | 외부 렌더링 전 OSC/비화면 제어 시퀀스 필터링 |
| `src/terminal/screen-model.ts` | headless VT 모델 래퍼와 유한 스크롤백 상태 |
| `src/terminal/outer-renderer.ts` | VT 화면 스냅샷을 부모 화면의 렌더 바이트로 변환 |
| `src/terminal/terminal-state.ts` | raw 모드·커서·화면 복구를 보장하는 부모 터미널 포트 |
| `tests/unit/*.test.ts` | 인자, 제어 시퀀스, 화면 모델의 결정적 fixture 테스트 |
| `tests/integration/pty-session.test.ts` | 로컬 fixture child를 사용하는 PTY 입력·resize·종료 통합 테스트 |
| `tests/fixtures/*.ts`, `tests/fixtures/*.mjs` | 비식별 ANSI/VT 스트림과 Node 실행형 fixture child 프로세스 |
| `docs/compatibility.md` | OS·터미널 호스트·셸·Node·CLI 버전별 실제 검증표 |
| `docs/validation.md` | 실행 명령, 기대/실제 결과, 미검증 사유 |
| `docs/decisions/0001-p0-runtime-and-pty.md` | 선택한 Node/PTY/VT 라이브러리와 대안·근거 |

## Tasks

### Task 1: 런타임 선택과 테스트 가능한 프로젝트 골격

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `docs/compatibility.md`
- Create: `docs/validation.md`
- Create: `docs/decisions/0001-p0-runtime-and-pty.md`

**Interfaces:**
- Produces: `pnpm typecheck`, `pnpm test`, `pnpm tgx` 스크립트와 P0의 고정된 런타임·PTY·VT 선택 기록.

- [ ] **Step 1: Node, pnpm, Codex, Claude Code, 터미널 호스트 버전을 읽기 전용으로 수집한다**

`docs/compatibility.md`의 첫 행에 실행일, OS, 셸, 호스트 터미널, Node, pnpm, Codex, Claude Code, ConPTY 여부를 넣는다. 없는 CLI는 `not installed`, 실행 불가는 `not verified`로 기록한다.

- [ ] **Step 2: 후보 PTY와 headless VT 모델의 공식 문서를 확인하고 선택 기준을 작성한다**

Windows ConPTY 지원, Node 지원 버전, resize API, 이벤트 해제 방식, 라이선스를 비교한다. `docs/decisions/0001-p0-runtime-and-pty.md`에 정확한 패키지·버전과 대안·탈락 이유를 기록한다.

- [ ] **Step 3: `package.json`, `tsconfig.json`, `vitest.config.ts`를 추가한다**

`package.json`은 ESM, Node engine, `typecheck`, `test`, `test:unit`, `test:integration`, `tgx` 스크립트만 포함한다. `tsconfig.json`은 `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`를 활성화한다. 아직 선택되지 않은 의존성은 설치하지 않는다.

- [ ] **Step 4: 빈 smoke 테스트를 작성하고 실패를 확인한다**

Create `tests/unit/project-smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";

describe("project harness", () => {
  it("runs unit tests", () => {
    expect(typeof process.version).toBe("string");
  });
});
```

Run: `pnpm test:unit`
Expected: 의존성 설치 전에는 스크립트 또는 Vitest 미설치 오류.

- [ ] **Step 5: 선택한 의존성을 설치하고 smoke 테스트·typecheck를 통과시킨다**

Run: `pnpm test:unit && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Task 1 변경을 커밋한다**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts tests/unit/project-smoke.test.ts docs/compatibility.md docs/validation.md docs/decisions/0001-p0-runtime-and-pty.md
git commit -m "chore: bootstrap P0 compatibility harness"
```

### Task 2: 안전한 공급자 실행 계약

**Files:**
- Create: `src/launch/command.ts`
- Test: `tests/unit/command.test.ts`

**Interfaces:**
- Produces: `type Provider = "codex" | "claude"`.
- Produces: `interface ChildLaunch { file: string; args: readonly string[]; cwd: string; env: NodeJS.ProcessEnv }`.
- Produces: `buildChildLaunch(provider: Provider, passthrough: readonly string[], cwd: string, env: NodeJS.ProcessEnv): ChildLaunch`.

- [ ] **Step 1: 실행 계약의 실패 테스트를 작성한다**

```ts
it("preserves each passthrough argument without shell quoting", () => {
  expect(buildChildLaunch("codex", ["--model", "gpt test", "한글"], "C:/work", {})).toEqual({
    file: "codex",
    args: ["--model", "gpt test", "한글"],
    cwd: "C:/work",
    env: {},
  });
});
```

Add equivalent coverage for `claude`, an empty provider rejection, and immutable copied `args`.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run tests/unit/command.test.ts`
Expected: FAIL because `src/launch/command.ts` does not exist.

- [ ] **Step 3: `buildChildLaunch`를 구현한다**

Provider 이름은 고정된 실행 파일 이름으로만 매핑한다. `passthrough`를 문자열로 합치거나 shell flag를 추가하지 않는다. `cwd`와 `env`는 호출자가 제공한 값을 보존한다.

- [ ] **Step 4: 단위 테스트와 typecheck를 통과시킨다**

Run: `pnpm vitest run tests/unit/command.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Task 2 변경을 커밋한다**

```bash
git add src/launch/command.ts tests/unit/command.test.ts
git commit -m "feat: define safe provider launch contract"
```

### Task 3: PTY 세션 포트와 수명주기 상태

**Files:**
- Create: `src/session/contracts.ts`
- Create: `src/session/pty-session.ts`
- Test: `tests/integration/pty-session.test.ts`
- Create: `tests/fixtures/pty-child.mjs`

**Interfaces:**
- Consumes: `ChildLaunch` from Task 2.
- Produces: `interface PtyProcess { write(data: string): void; resize(columns: number, rows: number): void; kill(signal?: string): void; onData(listener: (data: string) => void): Disposable; onExit(listener: (event: { exitCode: number; signal?: number }) => void): Disposable }`.
- Produces: `interface TerminalSize { columns: number; rows: number }`.
- Produces: `type PtyFactory = (launch: ChildLaunch, size: TerminalSize) => PtyProcess`.
- Produces: `class PtySession` with `onData(listener: (data: string) => void): Disposable`, `onExit(listener: (exit: SessionExit) => void): Disposable`, `write(data: string): void`, `resize(size: TerminalSize): void`, `close(): Promise<SessionExit>`.

- [ ] **Step 1: fixture child가 입력과 종료를 에코하는 테스트를 작성한다**

`pty-child.mjs`는 비식별 문자열 `READY`, `INPUT:<payload>`, `EXITING`만 출력한다. `pty-session.test.ts`는 실제 `node-pty` factory를 통해 child를 만들고 입력·출력·종료 순서를 기대한다. resize는 Windows ConPTY에서 자식 신호를 전제하지 않고 Task 4의 PTY port 테스트로 검증한다.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test:integration -- pty-session.test.ts`
Expected: FAIL because `PtySession`과 `PtyFactory`가 없다.

- [ ] **Step 3: `PtySession` 최소 구현을 작성한다**

출력 리스너는 세션 종료 시 해제한다. close는 중복 호출해도 같은 완료 Promise를 반환하고, `closing`/`closed` 상태에서 write를 거부한다. P0 세션은 PTY 출력을 동기적으로 listener에 전달하고 애플리케이션 출력 큐를 만들지 않는다. 렌더러가 나중에 batch queue를 도입하면 별도 상한·overflow 정책을 갖는다.

- [ ] **Step 4: 통합 테스트를 통과시킨다**

Run: `pnpm test:integration -- pty-session.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Task 3 변경을 커밋한다**

```bash
git add src/session tests/integration/pty-session.test.ts tests/fixtures/pty-child.mjs
git commit -m "feat: add bounded single PTY session"
```

### Task 4: 입력과 resize의 PTY 전달

**Files:**
- Modify: `src/session/pty-session.ts`
- Create: `src/terminal/size.ts`
- Modify: `tests/integration/pty-session.test.ts`

**Interfaces:**
- Consumes: `PtySession` from Task 3.
- Consumes: `TerminalSize` from Task 3.
- Produces: `validateTerminalSize(size: TerminalSize): TerminalSize`.

- [ ] **Step 1: 한글·여러 줄 paste와 resize의 실패 테스트를 추가한다**

```ts
it("forwards Korean and multiline paste unchanged", async () => {
  session.write("한글\nsecond line");
  await expect(output).toContain("INPUT:한글\nsecond line");
});

it("resizes PTY with validated dimensions", () => {
  session.resize({ columns: 120, rows: 40 });
  expect(fakePty.resize).toHaveBeenCalledWith(120, 40);
});
```

Also assert that zero, negative, fractional, and non-finite dimensions are rejected before `PtyProcess.resize` runs.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test:integration -- pty-session.test.ts`
Expected: FAIL for missing validation or incorrect passthrough behavior.

- [ ] **Step 3: 입력·크기 검증을 구현한다**

입력은 UTF-8 문자열을 재작성하지 않고 `PtyProcess.write`에 한 번 전달한다. size는 양의 안전 정수만 받아 PTY로 전달한다. 최소·최대 PTY 크기는 Task 1에서 고정한 엔진 제약과 함께 `size.ts`에 상수로 둔다.

- [ ] **Step 4: 통합 테스트를 통과시킨다**

Run: `pnpm test:integration -- pty-session.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Task 4 변경을 커밋한다**

```bash
git add src/session/pty-session.ts src/terminal/size.ts tests/integration/pty-session.test.ts
git commit -m "feat: validate PTY input and resize"
```

### Task 5: VT 화면 모델과 안전한 외부 렌더 바이트

**Files:**
- Create: `src/terminal/control-sequence-policy.ts`
- Create: `src/terminal/screen-model.ts`
- Create: `src/terminal/outer-renderer.ts`
- Create: `tests/unit/control-sequence-policy.test.ts`
- Create: `tests/unit/screen-model.test.ts`
- Create: `tests/fixtures/vt-streams.ts`

**Interfaces:**
- Consumes: selected headless VT package from Task 1.
- Produces: `sanitizeForOuterRenderer(data: string): string`.
- Produces: `class ScreenModel` with `write(data: string): Promise<void>` and `snapshot(): ScreenSnapshot`.
- Produces: `renderSnapshot(snapshot: ScreenSnapshot): string`.

- [ ] **Step 1: 제어 시퀀스와 alternate buffer의 실패 테스트를 작성한다**

```ts
it("blocks non-visual OSC sequences", () => {
  expect(sanitizeForOuterRenderer("\u001b]52;c;secret\u0007visible")).toBe("visible");
});

it("renders alternate buffer without outer escape", () => {
  model.write(FIXTURE_ALTERNATE_BUFFER);
  expect(renderSnapshot(model.snapshot())).toContain("ALT SCREEN");
  expect(renderSnapshot(model.snapshot())).not.toContain("\u001b[?1049");
});
```

Add fixtures for cursor movement, erase-line, colours, Korean wide characters, an OSC title sequence, and an unknown CSI sequence. Assertions must inspect only sanitized rendered bytes and model text, never persist raw fixture output.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm vitest run tests/unit/control-sequence-policy.test.ts tests/unit/screen-model.test.ts`
Expected: FAIL because the policy, model, and renderer do not exist.

- [ ] **Step 3: 정책·모델·렌더러 최소 구현을 작성한다**

`sanitizeForOuterRenderer`는 OSC 52, 모든 OSC, 화면 외 CSI window operation을 제거한다. `ScreenModel.write`는 headless VT 엔진에 적용하기 전에 이 정책을 호출하고, 엔진의 write callback이 완료된 뒤 resolve한다. Node ESM에서는 `@xterm/headless`의 default export에서 `Terminal`을 가져오고 버전 고정된 proposed buffer API로 유한 scrollback만 읽는다. `renderSnapshot`은 전체 부모 제어가 아닌 명시적인 frame 시작·끝 제어와 셀 내용만 내보낸다.

- [ ] **Step 4: fixture 테스트와 typecheck를 통과시킨다**

Run: `pnpm vitest run tests/unit/control-sequence-policy.test.ts tests/unit/screen-model.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Task 5 변경을 커밋한다**

```bash
git add src/terminal tests/unit/control-sequence-policy.test.ts tests/unit/screen-model.test.ts tests/fixtures/vt-streams.ts
git commit -m "feat: add safe VT screen model"
```

### Task 6: 단일 세션 CLI 조립과 종료 복구

**Files:**
- Create: `src/terminal/terminal-state.ts`
- Create: `src/cli.ts`
- Modify: `tests/integration/pty-session.test.ts`
- Create: `tests/integration/cli-lifecycle.test.ts`

**Interfaces:**
- Consumes: `buildChildLaunch`, `PtySession`, `ScreenModel`, `renderSnapshot`.
- Produces: `interface ParentTerminal { enter(): Promise<void>; render(frame: string): Promise<void>; restore(): Promise<void> }`.
- Produces: `runCli(argv: readonly string[], dependencies: CliDependencies): Promise<number>`.

- [ ] **Step 1: lifecycle 실패 테스트를 작성한다**

```ts
it("closes child before restoring terminal", async () => {
  await runCli(["codex"], dependencies);
  expect(events).toEqual(["terminal.enter", "session.close", "terminal.restore"]);
});
```

Add cases for child exit code forwarding, PTY creation failure restoring the terminal only when entered, and double cleanup not restoring twice.

- [ ] **Step 2: 실패를 확인한다**

Run: `pnpm test:integration -- cli-lifecycle.test.ts`
Expected: FAIL because `runCli` and `ParentTerminal` do not exist.

- [ ] **Step 3: CLI lifecycle을 구현한다**

`runCli`는 첫 위치 인자로 `codex` 또는 `claude`만 받고 나머지는 그대로 전달한다. 부모 terminal 진입 성공 뒤에는 `finally`에서 세션 close 완료 후 restore를 정확히 한 번 실행한다. Ctrl+C의 실제 Windows 전달 방식은 P0 수동 검증으로 확인하며, 구현은 provider CLI에 별도 우회 flag를 주지 않는다.

- [ ] **Step 4: lifecycle 테스트·전체 typecheck를 통과시킨다**

Run: `pnpm test:integration -- cli-lifecycle.test.ts && pnpm test && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Task 6 변경을 커밋한다**

```bash
git add src/cli.ts src/terminal/terminal-state.ts tests/integration/cli-lifecycle.test.ts tests/integration/pty-session.test.ts
git commit -m "feat: run and restore a single CLI session"
```

### Task 7: 실제 CLI 수동 호환성 게이트와 증거 기록

**Files:**
- Modify: `docs/compatibility.md`
- Modify: `docs/validation.md`
- Create: `docs/decisions/0002-p0-compatibility-result.md`

**Interfaces:**
- Consumes: P0 CLI executable and tests from Tasks 1–6.
- Produces: 각 공급자·호스트 조합을 `pass`, `fail`, `not verified` 중 하나로 판정한 호환성 표.

- [ ] **Step 1: 수동 검증 절차를 사전 등록한다**

각 지원 후보 조합에 다음을 한 행으로 둔다: `tgx codex` 또는 `tgx claude` 시작, 한글 입력, 여러 줄 붙여넣기, 승인 메뉴, Ctrl+C, resize, alternate screen, 정상 종료, 강제 중단 뒤 커서·입력 복구. 각 항목에 기대 결과와 증거 위치를 적는다.

- [ ] **Step 2: fixture 기반 자동 검증을 먼저 실행한다**

Run: `pnpm test && pnpm typecheck`
Expected: PASS. 결과와 머신 환경을 `docs/validation.md`에 기록한다.

- [ ] **Step 3: 설치·로그인된 실제 공급자 CLI에서 수동 절차를 실행한다**

실제 프롬프트·대화 전문·토큰은 문서에 저장하지 않는다. 승인이나 계정 상태 때문에 실행 불가한 항목은 `not verified`와 이유로 기록한다.

- [ ] **Step 4: P0 통과 여부를 결정 기록에 남긴다**

모든 P0 필수 항목이 해당 지원 조합에서 통과하면 다음 단계 진행을 승인한다. 입력·승인·종료·화면 침범 중 하나라도 실패하면 `0002-p0-compatibility-result.md`에 원인·재현·대안·P1 차단 여부를 기록한다.

- [ ] **Step 5: P0 증거를 커밋한다**

```bash
git add docs/compatibility.md docs/validation.md docs/decisions/0002-p0-compatibility-result.md
git commit -m "docs: record P0 compatibility evidence"
```

## Plan Self-Review

- Spec coverage: P0의 PTY, VT, 입력, resize, 종료 복구, 제어 시퀀스 보안, 지원 환경 증거를 Tasks 1–7에 모두 매핑했다. P1 이후 대시보드·실제 상태 수집·탭·분할은 이 P0 하위 계획의 범위 밖이다.
- Step clarity: 모든 구현 단계는 파일·시그니처·검증 명령을 지정했고, 엔진 패키지 선택은 설계가 요구한 공식 문서와 PoC 증거 이후로 한정했다.
- Type consistency: `ChildLaunch` → `PtyFactory`/`PtySession` → `ScreenModel`/`renderSnapshot` → `runCli` 흐름과 각 타입의 소유 파일을 고정했다.
- Review focus: 한글 paste, alternate buffer, OSC 차단, 종료 순서, resize가 각각 Tasks 4–6의 자동 테스트와 Task 7의 실제 검증에 배정됐다.
- Proportion: 계획은 P0 구현·검증 경계를 정의하며, 함수 본문이나 미확정 라이브러리의 구현 세부를 미리 고정하지 않는다.
