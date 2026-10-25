# Child Cursor 복구 설계

## 문제 근거

`OuterRenderer`와 `SidecarRenderer`는 parsed child snapshot을 absolute cursor position으로 다시 그리지만, frame 마지막에 child의 `snapshot.cursor` 위치로 parent cursor를 돌려놓지 않는다. 또한 `ProcessTerminal.enter()`는 cursor를 숨긴다. 따라서 parent terminal의 현재 cursor가 마지막 repaint 행에 남아 한글 IME 조합·backspace·일반 입력의 표시 위치를 깨뜨릴 수 있다.

## 목표

- 모든 child snapshot frame 끝에서 ANSI cursor를 child snapshot의 cursor 위치로 복구하고 표시한다.
- sidecar/tab bar가 있을 때 child row offset을 정확히 더한다.
- cursor 위치만 바뀌어도 changed-row paint 없이 cursor restore frame을 낸다.
- raw PTY bytes를 renderer에 전달하지 않고 기존 frame content filtering을 유지한다.
- 아직 output batching 또는 TGX shell 디자인을 함께 변경하지 않는다.

## 설계

`OuterRenderer`는 previous lines와 previous cursor를 함께 보관한다. full/diff repaint 뒤 `CSI 0m`, `CUP(row;column)`, `CSI ?25h`를 붙인다. pure `renderSnapshot`도 같은 final cursor sequence를 붙인다.

`SidecarRenderer`의 rendered frame은 physical child cursor를 보관한다. `tabBar`가 있으면 child cursor row에 한 줄 offset을 더한다. content rows가 같고 cursor만 달라도 cursor sequence만 낸다. cursor x/y는 snapshot viewport 범위로 clamp한다.

## 검증

- outer full/diff frame이 child cursor 위치와 show-cursor sequence로 끝난다.
- 동일 content에서 cursor 이동은 content row repaint 없이 cursor만 복구한다.
- sidecar/tab bar frame은 child cursor y에 tab row offset을 더한다.

## 비목표

Windows IME의 모든 조합 세부 동작, output backpressure, provider CLI TUI behavior, TGX 고유 shell redesign은 별도 단계다.
