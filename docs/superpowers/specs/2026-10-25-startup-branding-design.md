# TGX 시작 브랜딩 설계

## 의도

TGX가 Codex 또는 Claude CLI를 준비하는 짧은 구간에 공급자 로고를 모방하지 않는 TGX 고유 시작 표시를 제공한다. 사용자가 래퍼가 시작되었음을 알 수 있어야 하지만, 자식 CLI의 입력·승인·출력·종료 동작은 바뀌면 안 된다.

## 목표와 제약

- 표시 문자열은 안전한 ASCII `TGX starting <provider>...`만 사용한다.
- 단일 세션은 PTY와 화면 모델 생성 뒤, 첫 성공한 자식 출력 전까지만 TGX 프레임을 표시한다.
- 탭 모드는 기존 TGX 소유 tab bar에 같은 문자열을 표시하며, 첫 탭의 첫 성공 출력 또는 종료/오류 때 일반 탭 바로 전환한다.
- 한 행 탭 터미널은 자식 화면을 덮지 않으므로 브랜딩을 표시하지 않는다.
- 브랜딩은 raw PTY bytes, 인증 데이터, 대화 내용을 소비하지 않는다.
- Ctrl+C, 붙여넣기, 승인 메뉴, resize, alternate screen, provider arguments와 기본 단일 세션의 정상 렌더 경로는 보존한다.

## 고려한 접근

1. child screen 첫 줄에 overlay한다. 출력과 승인 메뉴를 훼손할 수 있어 제외한다.
2. TGX가 소유한 프레임/탭 바에서만 표시하고 첫 성공 출력에서 정상 renderer가 전체 repaint한다. 선택한다.
3. 별도 로딩 프로세스 또는 provider 아이콘을 실행한다. 공급자 동작 모방·추가 실패 경로가 생겨 제외한다.

## 설계

`startup-brand-view`는 bounded ASCII 한 줄과 단일 세션용 안전 ANSI 프레임을 만든다. 단일 세션은 최초 `ScreenOutputModel.write` 성공 전 `ParentTerminal.render`로 이 프레임을 한 번 표시한다. 첫 write 성공 이후 기존 `renderSnapshot`이 전체 화면을 다시 그린다.

`MultiSessionManager`는 각 세션에 `hasReceivedOutput` 메타데이터를 공개한다. 값은 비어 있지 않은 child data를 screen model에 성공적으로 적용한 뒤에만 `true`가 된다. 탭 런너는 최초 세션의 이 값과 lifecycle 상태를 보고 startup state를 끝낸다. `TabRenderState`는 이 상태를 renderer에 명시적으로 전달하며, 기본 renderer는 tab bar가 있을 때에만 branding line을 선택한다.

## 검증

- branding view는 ASCII 안전성과 provider 표기를 단위 검증한다.
- 단일 CLI lifecycle은 child output 전 branding frame, 출력 후 일반 snapshot frame을 검증한다.
- manager는 성공 output만 메타데이터로 표시하고 write 실패는 표시하지 않는지 검증한다.
- 탭 lifecycle은 첫 tab output 전 branding state, 이후 일반 tab state, 자연 종료 시 branding 제거를 검증한다.

## 비목표

실제 로고 이미지, 애니메이션, provider별 아이콘 복제, 새 탭마다 재생되는 로딩 화면, 1행 화면의 overlay는 포함하지 않는다.
