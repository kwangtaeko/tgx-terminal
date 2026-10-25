# 분할 Pane 안전 렌더러 설계

## 의도

두 parsed VT screen snapshot을 P3 split geometry 안에 안전하게 합성한다. pane 간 출력 침범 없이 renderer 경계를 먼저 검증하고, PTY 생성·입력 focus는 이후 단계로 남긴다.

## 목표와 제약

- renderer는 `ScreenSnapshot`, `SplitPaneLayout`만 입력으로 받고 raw PTY bytes를 받지 않는다.
- 각 snapshot의 columns/rows는 대응 pane rect와 정확히 일치해야 하며, 불일치는 `RangeError`로 중단한다.
- 첫 frame은 전체 clear, 이후에는 바뀐 물리 행만 다시 그린다.
- 각 물리 행은 한 번만 clear한 후 모든 pane 내용과 separator를 절대 좌표에 쓴다. pane별 `2K`는 금지한다.
- 좌우 separator는 `|`, 상하 separator는 `-`로 TGX가 소유한다.
- 기존 single/sidecar/tab renderer와 CLI에는 연결하지 않는다.

## 고려한 접근

1. 각 pane를 독립 `2K`로 clear한다. 한 pane clear가 같은 물리 행의 다른 pane을 지우므로 제외한다.
2. snapshot 크기를 잘라 맞춘다. wide character/resize 중간 상태를 잘못 자를 수 있으므로 제외한다.
3. 전체 행을 하나의 frame row로 합성하고 strict geometry mismatch를 거부한다. 선택한다.

## 설계

`SplitPaneRenderer.render(first, second, layout)`는 layout canvas 높이의 rendered rows를 만든다. 각 row는 `cursor row, column 1`과 `2K` 뒤, 포함된 pane의 `renderStyledLine` 결과와 separator를 ANSI 절대 좌표로 작성한다. `#previousFrame`은 geometry와 각 row를 비교해 첫 frame 또는 geometry 변경 때만 full repaint하고, 아니면 바뀐 rows만 보낸다.

## 검증

- 좌우 frame은 first·`|`·second를 같은 행의 올바른 absolute columns에 둔다.
- 상하 frame은 전폭 `-` separator row를 둔다.
- 같은 frame은 빈 문자열, 한 pane의 한 행 변경은 그 행만 다시 그린다.
- mismatched snapshot geometry는 throw하고 자식 텍스트를 전달하지 않는다.

## 비목표

pane PTY lifecycle/resize, clipping, input focus, control bindings, sidecar/tab bar 결합, 실제 CLI 연결은 포함하지 않는다.
