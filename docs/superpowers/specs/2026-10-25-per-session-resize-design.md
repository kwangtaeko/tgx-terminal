# Pane별 세션 크기 설계

## 의도

분할 pane은 같은 parent terminal 안에서도 서로 다른 PTY/VT 크기를 가져야 한다. 기존 탭의 전역 resize 동작을 보존하면서, P3 controller가 각 pane을 독립적으로 생성·resize할 수 있는 세션 계약을 추가한다.

## 목표와 제약

- `MultiSessionManager.create(launch, size?)`는 선택적인 per-session size로 PTY와 screen을 함께 생성한다.
- size를 생략하면 기존 manager 기본 size를 사용한다.
- custom-size create는 manager 기본 size나 이미 존재하는 탭의 크기를 바꾸지 않는다.
- `resizeSession(id, size)`는 해당 running session의 PTY와 screen에 같은 validated size를 전달한다.
- 종료·오류 session은 기존 global `resize` 정책과 같이 skip한다.
- resize 오류는 해당 session만 error로 격리하고 다른 session은 바꾸지 않는다.
- 입력 routing, output queue, 화면 renderer, CLI 인자에는 이 단계에서 변경이 없다.

## 고려한 접근

1. manager 전체의 `resize`만 사용한다. pane마다 같은 크기가 되어 실제 split에 쓸 수 없어 제외한다.
2. record internals를 외부에 노출해 직접 resize한다. 소유권·오류 격리가 깨져 제외한다.
3. manager가 custom create와 one-session resize API를 제공한다. 선택한다.

## 설계

`create`의 두 번째 선택 인자는 `TerminalSize`다. 인자가 있으면 `validateTerminalSize` 후 해당 PTY/screen factory에 전달하고, 없으면 현재 `#size`를 쓴다. `resizeSession`도 validation 후 record의 `port.resize`와 `screen.resize`를 순서대로 호출한다. 둘 중 하나가 throw하면 `#markError`로 해당 record만 격리한다.

`resize(size)`는 계속 모든 running session에 적용하면서 future default create size만 갱신한다. 이는 tabs의 현재 동작을 보존한다.

## 검증

- 두 session이 서로 다른 custom creation size를 factory에 전달한다.
- one-session resize가 그 session의 PTY/screen만 바꾼다.
- custom-size session 뒤 size 없는 create가 기존 manager default size를 사용한다.
- invalid/unknown size or id는 다른 session을 건드리지 않는다.

## 비목표

pane rect에서 size를 고르는 policy, pane renderer 연결, focus, split CLI, state persistence는 다음 단계다.
