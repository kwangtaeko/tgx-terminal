# 검증 기록

| 일시 | 명령 | 기대 결과 | 실제 결과 | 판정 |
| --- | --- | --- | --- | --- |
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

실제 공급자 CLI의 비대화형 시작·정상 종료·복구는 확인했습니다. 한글 입력, 여러 줄 붙여넣기, 승인 메뉴, Ctrl+C, resize, alternate screen을 포함한 대화형 공급자 검증은 아직 실행하지 않았습니다.
