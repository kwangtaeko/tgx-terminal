# 검증 기록

| 일시 | 명령 | 기대 결과 | 실제 결과 | 판정 |
| --- | --- | --- | --- | --- |
| 2026-10-24 | `pnpm.cmd exec vitest run tests/integration/cli-lifecycle.test.ts; pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check` | `--tgx-tabs` 다중 세션 생성·닫기 및 부모 터미널 복구 검증 | CLI 수명주기 9개 테스트와 전체 suite 통과; typecheck/build exit 0 | pass; 실제 Windows 대화형 검증은 pending manual verification |
| 2026-10-24 | `pnpm.cmd exec vitest run tests/unit/tab-mode-arguments.test.ts; pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check` | `--tgx-tabs` 래퍼 인자와 provider passthrough 분리 검증 | 인자 parser 4개 테스트 및 전체 16개 파일·65개 테스트 통과; typecheck/build exit 0; `git diff --check` clean | pass; 제어면 연결은 후속 단계 |
| 2026-10-24 | `pnpm.cmd exec vitest run tests/unit/tab-control-decoder.test.ts; pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check` | opt-in 탭 prefix 디코더의 pass-through·명령·분할 입력·미완성 prefix 검증 | 디코더 5개 테스트 및 전체 15개 파일·61개 테스트 통과; typecheck/build exit 0; `git diff --check` clean | pass; `runCli` 연결 및 실제 terminal 제어면은 pending manual verification |
| 2026-10-24 | `pnpm.cmd exec vitest run tests/unit/multi-session-manager.test.ts; pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check` | P3 다중 세션 코어의 입력·출력 격리, resize, 종료·오류 정리 검증 | 다중 세션 12개 테스트 및 전체 14개 파일·56개 테스트 통과; typecheck/build exit 0; `git diff --check` clean | pass; 실제 다중 탭 제어면은 pending manual verification |
| 2026-10-24 | `node --version; pnpm.cmd --version; codex.cmd --version; claude --version; pnpm.cmd exec vitest run; pnpm.cmd typecheck; pnpm.cmd build; git diff --check` | P2 출처 메타데이터 재검증 | Node `v22.15.1`, pnpm `10.33.2`, Codex `0.164.0`, Claude `2.1.302`; 13 files, 44 tests passed; typecheck/build exit 0; `git diff --check` clean | pass with `.npmrc` `NODE_AUTH_TOKEN` warning |
| 2026-10-18 | `pnpm.cmd exec vitest run && pnpm.cmd typecheck && pnpm.cmd build && git diff --check` | P1 Sidecar layout, safe dashboard view, renderer, resize integration verification | 13 files, 44 tests passed; typecheck/build exit 0; diff check clean | pass |
| 2026-10-18 | `node dist/cli.js codex --version; node dist/cli.js claude --version` | Windows PTY launch and parent-terminal restoration smoke check after P1 | Codex `0.163.0` and Claude `2.1.302` exited 0; command runner was 80 columns, so the 92-column Sidecar visual scenario remains manual | pass with manual follow-up |
| 2026-10-17 | `node --version` | Node 실행 가능 | `v22.15.1` | pass |
| 2026-10-17 | `pnpm.cmd --version` | pnpm 실행 가능 | `10.33.2`; 사용자 `.npmrc`의 미설정 환경 변수 경고가 있었음 | pass with warning |
| 2026-10-17 | `codex.cmd --version` | Codex CLI 실행 가능 | `codex-cli 0.163.0`; sandbox의 PATH alias 경고가 있었음 | pass with warning |
| 2026-10-17 | `claude --version` | Claude Code 실행 가능 | `2.1.302 (Claude Code)` | pass |
| 2026-10-17 | `pnpm.cmd install` | 고정 의존성 설치 | 42개 패키지 설치; `node-pty` 빌드 스크립트는 pnpm 정책으로 처음 보류됨 | pass with follow-up |
| 2026-10-17 | `pnpm.cmd approve-builds --all` | 보류된 네이티브 의존성만 빌드 | `node-pty@1.1.0` prebuild와 ConPTY 파일 배치 성공 | pass |
| 2026-10-17 | `pnpm.cmd test:unit` | smoke 테스트 통과 | 1 file, 1 test passed | pass |
| 2026-10-17 | `pnpm.cmd typecheck` | strict TypeScript 검사 통과 | exit 0 | pass |
| 2026-10-17 | Node ESM import probe | `node-pty`와 headless VT API 로드 | `node-pty.spawn` 및 `@xterm/headless` default export의 `Terminal`이 function | pass |
| 2026-10-17 | `pnpm.cmd test:integration -- pty-session.test.ts` | 실제 PTY fixture와 수명주기 테스트 통과 | 1 file, 2 tests passed | pass |
| 2026-10-17 | `pnpm.cmd typecheck && pnpm.cmd test` | Task 3 이후 strict 검사와 전체 테스트 통과 | typecheck exit 0; 3 files, 7 tests passed | pass |
| 2026-10-17 | `pnpm.cmd test:integration -- pty-session.test.ts` | 한글·여러 줄 입력과 resize 검증 통과 | 1 file, 3 tests passed | pass |
| 2026-10-17 | `pnpm.cmd typecheck && pnpm.cmd test` | Task 4 이후 strict 검사와 전체 테스트 통과 | typecheck exit 0; 3 files, 8 tests passed | pass |
| 2026-10-17 | `pnpm.cmd exec vitest run tests/unit/control-sequence-policy.test.ts tests/unit/screen-model.test.ts` | VT 제어 시퀀스 정책과 화면 모델 fixture 검증 | 2 files, 5 tests passed | pass |
| 2026-10-17 | `pnpm.cmd exec vitest run && pnpm.cmd typecheck && git diff --check` | Task 5 이후 전체 회귀·strict 검사·공백 오류 검사 | 5 files, 13 tests passed; typecheck exit 0; diff check clean | pass |
| 2026-10-17 | `pnpm.cmd exec vitest run tests/integration/cli-lifecycle.test.ts && pnpm.cmd typecheck && pnpm.cmd exec vitest run` | CLI 수명주기·전체 회귀·strict 검사 | 6 files, 17 tests passed; typecheck exit 0 | pass |
| 2026-10-17 | `pnpm.cmd build && node dist/cli.js` | 빌드 산출물과 잘못된 CLI 인자 처리 | `dist/cli.js` 생성; 사용법 출력, exit 1 | pass |
| 2026-10-17 | `node dist/cli.js codex --version` | 실제 Codex CLI의 PTY 시작·정상 종료·부모 터미널 복구 | `codex-cli 0.163.0`, exit 0; Codex가 PATH alias 생성 시 home directory를 찾지 못했다는 경고를 출력 | pass with warning (비대화형) |
| 2026-10-17 | `node dist/cli.js claude --version` | 실제 Claude Code의 PTY 시작·정상 종료·부모 터미널 복구 | `2.1.302 (Claude Code)`, exit 0 | pass (비대화형) |
| 2026-10-17 | `pnpm.cmd exec vitest run && pnpm.cmd typecheck && pnpm.cmd build && git diff --check` | P0 자동 회귀·strict 검사·빌드·공백 오류 검사 | 8 files, 20 tests passed; typecheck/build exit 0; diff check clean | pass |
| 2026-10-17 | `docs/manual-p0-validation.md` 작성 | 자동화할 수 없는 실제 대화형 P0 검사 절차 고정 | 한글 입력·붙여넣기·승인·Ctrl+C·resize·alternate screen·종료 복구의 수동 판정 기준 추가 | pending manual verification |
| 2026-10-18 | `pnpm.cmd exec vitest run tests/unit/screen-model.test.ts && pnpm.cmd typecheck && pnpm.cmd exec vitest run && pnpm.cmd build` | 화면 잔상 회귀·현재 viewport 렌더링·전체 회귀·빌드 검사 | 화면 모델 3 tests passed; 전체 8 files, 21 tests passed; typecheck/build exit 0 | pass |
| 2026-10-18 | `node dist/cli.js codex --version` | 화면 clear/home 프레임을 포함한 실제 PTY 출력 재검증 | `codex-cli 0.163.0`, exit 0; 이전 화면 잔상을 남길 수 있는 렌더 바이트는 출력하지 않음 | pass with warning |
| 2026-10-18 | `pnpm.cmd exec vitest run tests/unit/screen-model.test.ts && pnpm.cmd exec vitest run && pnpm.cmd typecheck && pnpm.cmd build` | palette·RGB·기본 스타일의 VT 화면 스냅샷과 안전한 ANSI 재렌더링 검증 | 화면 모델 4 tests passed; 전체 8 files, 22 tests passed; typecheck/build exit 0 | pass |
| 2026-10-18 | `pnpm.cmd exec vitest run tests/unit/screen-model.test.ts && pnpm.cmd exec vitest run && pnpm.cmd typecheck && pnpm.cmd build` | 첫 프레임 전체 렌더링 뒤 변경 행만 다시 그리는 회귀 검증 | 화면 모델 5 tests passed; 전체 8 files, 23 tests passed; typecheck/build exit 0 | pass |
| 2026-10-18 | `node dist/cli.js codex --version` | 실제 PTY 출력이 첫 프레임 뒤 행 단위 ANSI 갱신을 사용하는지 확인 | `codex-cli 0.163.0`, exit 0; 첫 `2J` 이후 변경 행에만 `2K` 출력 | pass with warning |
| 2026-10-18 | `pnpm.cmd exec vitest run tests/unit/screen-model.test.ts tests/unit/terminal-state.test.ts tests/integration/cli-lifecycle.test.ts` | 부모 터미널 resize → VT 화면 모델·PTY 전달, 행 수 변경 전체 재도색 검증 | 3 files, 14 tests passed | pass |
| 2026-10-18 | `pnpm.cmd exec vitest run && pnpm.cmd typecheck && pnpm.cmd build && git diff --check` | 공급자 상태 계약·미지원 사용량 어댑터·출처 메타데이터 검증 | 10 files, 33 tests passed; typecheck/build exit 0; diff check clean | pass |

실제 공급자 CLI의 비대화형 시작·정상 종료·복구는 확인했습니다. 한글 입력, 여러 줄 붙여넣기, 승인 메뉴, Ctrl+C, resize, alternate screen을 포함한 대화형 공급자 검증은 아직 실행하지 않았습니다.
