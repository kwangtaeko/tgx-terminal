# ADR 0001: P0 PTY와 VT 모델 선택

## 상태

승인됨 — P0에서 설치·fixture 검증이 통과할 때까지 실제 CLI 호환성은 미검증입니다.

## 결정

- 런타임은 이 환경에서 확인한 Node.js `22.15.1`과 pnpm `10.33.2`를 기준으로 합니다.
- PTY는 `node-pty` `1.1.0`을 사용합니다.
- 화면 모델은 `@xterm/headless` `6.0.0`을 사용합니다.
- 테스트는 Vitest `5.0.5`, 컴파일은 TypeScript `7.0.2`를 사용합니다.

## 근거

`node-pty`는 Windows 1809 이상에서 ConPTY를 지원하고, 실행 파일과 인자 배열을 받는 `spawn`, 출력 구독 `onData`, 크기 변경 `resize` API를 제공합니다. 공식 선언은 Windows에서 `kill(signal)`의 signal 인자를 지원하지 않음을 명시하므로, 종료 신호 정책은 P0 실제 검증으로 확정합니다.

`@xterm/headless`는 Node.js에서 동작하는 headless 터미널 모델이며 TypeScript 선언을 제공합니다. `write` 결과는 callback이 완료된 뒤에만 buffer에 반영됩니다. 화면 스냅샷에는 버전 고정된 proposed buffer API가 필요하므로 P0은 `allowProposedApi: true`를 명시하고, 이를 alternate screen·한글 fixture로 회귀 검증합니다. proposed API 추가 사용은 하지 않습니다.

설치된 `@xterm/headless` `6.0.0`은 Node ESM 동적 import에서 named export가 아닌 CommonJS default export로 노출됩니다. 따라서 P0 구현은 `createRequire`로 CommonJS `Terminal`을 직접 가져오거나, dynamic import의 `default.Terminal`을 사용합니다.

두 라이브러리는 MIT 라이선스입니다. `node-pty`는 Windows 네이티브 모듈이므로, 설치와 로컬 패키징은 Windows에서 별도로 검증해야 합니다.

## 대안과 제외 이유

- 직접 ANSI 문자열을 부모 stdout에 전달: alternate screen과 지우기 명령이 대시보드·다른 pane을 침범하므로 제외합니다.
- TUI 라이브러리만 사용: 임의 자식 TUI의 VT 화면 모델을 제공하지 않으므로 제외합니다.
- 화면 텍스트 파싱으로 모델 대체: 공급자 UI 버전에 결합되므로 제외합니다.

## 출처

- [node-pty README](https://github.com/microsoft/node-pty/blob/main/README.md) — ConPTY, API, 라이선스 확인일 2026-10-17
- [node-pty TypeScript 선언](https://github.com/microsoft/node-pty/blob/main/typings/node-pty.d.ts) — `spawn`, `resize`, Windows `kill` 제약 확인일 2026-10-17
- [xterm.js README](https://github.com/xtermjs/xterm.js/) — headless 배포와 MIT 라이선스 확인일 2026-10-17
- [@xterm/headless npm 패키지](https://www.npmjs.com/package/%40xterm/headless) — Node.js 지원·실험 상태·버전 확인일 2026-10-17
