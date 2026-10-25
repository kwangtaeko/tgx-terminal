# TGX 시작 배지 디자인

## 의도

TGX가 provider CLI 위에 단순 문구만 덧붙인 래퍼처럼 보이지 않도록, 자식 출력이 도착하기 전 TGX 소유의 시작 배지를 잠시 표시한다. 사용자가 요청한 “TGX 글자나 아이콘이 올라오는” 시작 감각을 ASCII로 제공한다.

## 선택

- 기본 시작 화면은 세 줄 ASCII 배지로 구성한다.
  - `+-----+  TGX / TERMINAL`
  - `| TGX |  CONNECTING TO <PROVIDER>`
  - `+-----+  SAFE PTY SESSION`
- 탭 바는 한 줄만 소유할 수 있으므로 `TGX / CONNECTING / <PROVIDER>` 요약을 쓴다.
- provider 로고·색상·본문을 복제하지 않고 printable ASCII만 사용한다.

## 제약과 비목표

- 첫 자식 출력이 오면 기존처럼 즉시 provider 화면으로 전환한다.
- 입력, PTY 크기, 사용량 데이터, 승인 경계는 변경하지 않는다.
- 별도의 animation timer를 만들지 않는다. 정지 상태에서도 깜빡임 없이 안전한 시작 배지만 보여 준다.
- 시작 frame은 child viewport 높이를 받아 최대 3행만 그리며, 1~2행 terminal에서 화면 밖 행으로 이동하지 않는다.

## 검증

- 80열 기본 frame에 세 줄과 provider 대문자 상태가 존재한다.
- tab line은 한 줄·고정 폭 ASCII이며 시작 연결 상태를 표현한다.
- 좁은 폭에서도 모든 행은 지정 폭으로 절단·패딩된다.
