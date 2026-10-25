# 분할 Pane 레이아웃 설계

## 의도

P3의 실제 다중 pane PTY 연결 전에, terminal canvas를 서로 침범하지 않는 두 사각형과 한 칸 분할선으로 나누는 순수 레이아웃 계약을 검증한다. 이 단계는 CLI 인자, 단축키, 입력 focus, PTY 생성, renderer를 바꾸지 않는다.

## 목표와 제약

- 좌우(`side-by-side`)와 상하(`stacked`) 두 pane을 지원한다.
- 모든 좌표는 ANSI가 아닌 zero-based 논리 좌표다.
- 성공한 레이아웃은 두 pane과 1칸 separator가 terminal canvas를 빈틈·겹침 없이 덮는다.
- canvas 또는 호출자가 넘긴 pane 최소 크기가 유효하지 않으면 `RangeError`를 던진다.
- canvas가 최소 크기를 충족하지 않으면 강제 축소하지 않고 `undefined`를 반환해 후속 CLI 단계가 단일 pane fallback을 선택하게 한다.
- 기존 sidecar/tab bar는 이미 child canvas 바깥을 소유하므로 planner에 전달하지 않는다.

## 고려한 접근

1. 기존 `SingleSessionLayout`에 pane 필드를 추가한다. 단일 세션·sidecar 계약을 불필요하게 바꾸므로 제외한다.
2. child canvas를 입력으로 받는 독립 planner를 둔다. 선택한다. PTY와 renderer 단계에서 같은 결과를 소비할 수 있다.
3. 바로 두 PTY를 생성하고 renderer에 좌표 오프셋을 추가한다. VT 화면의 clipping·입력 focus가 미검증이라 제외한다.

## 설계

`src/layout/split-pane-layout.ts`는 `SplitOrientation`, `PaneRect`, `SplitPaneLayout`, `SplitPaneConstraints`, `computeSplitPaneLayout`을 제공한다. caller가 최소 columns/rows를 명시한다. 좌우 분할은 `columns >= 2 * minimumColumns + 1`, 상하 분할은 `rows >= 2 * minimumRows + 1`일 때만 성립한다.

separator는 항상 정확히 한 column 또는 한 row다. separator를 제외한 남은 공간을 절반으로 나누며, 홀수 여분은 second pane에 준다. planner는 `validateTerminalSize`로 canvas를 확인하고, constraint 각 값은 양의 safe integer인지 확인한다.

## 검증

- 101×24 좌우 40×8은 50/1/50 columns가 된다.
- 100×24 좌우는 first 49, second 50 columns가 된다.
- 40×17 상하는 8/1/8 rows가 된다.
- 하나라도 최소 크기를 못 맞추면 `undefined`다.
- invalid canvas/constraints는 `RangeError`다.

## 비목표

PTY 생성·resize, pane renderer·snapshot clipping, focus/input routing, 단축키, 레이아웃 저장/복원, runtime 기본 최소값은 후속 단계다.
