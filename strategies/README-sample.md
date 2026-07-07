# trip-persona
## 취향 여행 추천 오케스트레이터 (마이리얼트립 해커톤 · Codex 플러그인)

대화로 여행 성향을 **5축 페르소나 벡터**로 구체화하고, 웹서치(+JSON 캐시)와 마이리얼트립 MCP
실상품(항공·숙소·투어)을 결합해 **"취향 → 장소 → 루트"** 를 추천한 뒤, 모바일 단일 HTML 일정을 만드는 온디맨드 플러그인

- **이용 대상**: "어디로 갈지 모르겠는" 여행자, 취향 기반 일정 추천이 필요한 사람
- **입력**: 대화(성향·목적지·날짜·동행·예산)
- **출력**: 항공·숙소·액티비티 예약 버튼이 붙은 단일 HTML 일정서

## 설치

```bash
codex mcp add myrealtrip --url https://mcp-servers.myrealtrip.com/mcp   # (선택) 실상품 조회
cd src                                          # marketplace.json(.agents/plugins/) 이 있는 디렉터리
codex plugin marketplace add .                  # 로컬 마켓플레이스 myrealtrip-src 등록
codex plugin add trip-persona@myrealtrip-src    # 플러그인 설치 (PLUGIN@MARKETPLACE)
```

`codex plugin marketplace add .`는 현재 디렉터리의 `.agents/plugins/marketplace.json`을 읽어 `myrealtrip-src` 마켓플레이스를 등록하고,
`codex plugin add trip-persona@myrealtrip-src`가 그 스냅샷에서 플러그인을 설치한다(설치 확인: `codex plugin list`).
저장소 루트에서 실행한다면 경로만 바꾸면 된다: `codex plugin marketplace add ./src`.
그다음 **`src/`에서 `codex`를 실행**하면 `src/AGENTS.md`가 세션 시작 시 로드되어 여행 요청을 MCP 즉시 검색이 아닌 `trip-persona` 스킬로 라우팅한다(검색-먼저 방지).
MCP 미등록 상태여도 파이프라인은 폴백 데이터·추정 라벨로 HTML 생성까지 완주한다.

제거: `codex plugin remove trip-persona@myrealtrip-src` (마켓플레이스까지 제거하려면 `codex plugin marketplace remove myrealtrip-src`)

### 일반 codex(대화형 세션·데스크톱 앱)에서 쓰기

위 `codex plugin add` 한 번이면 등록 정보가 전역 설정 `~/.codex/config.toml`(`[marketplaces.myrealtrip-src]`)에 저장되므로,
**CLI 서브커맨드뿐 아니라 대화형 `codex` 세션과 `codex app`(데스크톱) 모두에서 별도 설치 없이 바로 쓸 수 있다.**

- 대화형 세션: `src/`에서 `codex` 실행 → `AGENTS.md` 라우팅이 적용된 상태로 프롬프트에 `trip-persona로 …` 요청.
- 데스크톱 앱: `codex app`으로 실행(미설치 시 인스톨러가 열림). 작업 폴더를 `submission_myrealtrip/src`로 열면 동일하게 동작한다.
- 설치 상태 확인: `codex plugin list`에 `trip-persona@myrealtrip-src  installed, enabled`이 보이면 세션·앱에서도 활성 상태다.
- 로컬 코드를 고친 뒤에는 `.codex-plugin/plugin.json`의 `version`을 올리고 `codex plugin add trip-persona@myrealtrip-src`로 다시 설치해야 세션·앱에 반영된다.

## 사용법

여행 요청을 던지면 스킬이 **4단계(PHASE)** 로 진행한다: ① 일정+성향 테스트(필수) ② 항공·숙소 제시+선호 확인(선택)
③ 원하는 여행 자유 입력(선택) ④ 계획 수립+HTML 생성(필수).

### 1) codex 대화형 세션(TUI)

`codex`를 인자 없이 실행하면 대화형 세션이 열린다. 세션 안에서 스킬을 자연어로 호출한다.

```bash
codex                       # 대화형 세션 시작 (또는 codex "..."로 첫 프롬프트 지정)
```
세션 프롬프트에:
```
내 취향에 맞는 여행 계획 세워줘.
```
- PHASE 1(필수): 일정 3문 + 성향 테스트 5문을 한 턴에 하나씩 묻는다(이미 말한 일정은 건너뜀, 구체화 질문 없음).
- PHASE 2(선택): 항공·숙소 실가격을 예약 링크와 함께 제시하고 선호를 묻는다("아무거나"면 최저가 기준).
- PHASE 3(선택): 어떤 여행을 하고 싶은지 자유 입력을 받는다.
- PHASE 4(필수): 수집 데이터로 계획을 수립하고 HTML 일정서를 생성한다.
- 항공·숙소·액티비티 가격을 제시할 때는 **항상 마이리얼트립 예약 버튼**을 함께 낸다.

### 2) codex CLI(one-shot 실행)

`codex exec`로 프롬프트를 한 번에 실행하고 결과만 받는다. 배치·스크립트에 적합.

```bash
codex exec "trip-persona로 여행 일정 만들어줘"
```

산출물: 중간 JSON은 **`output/<run_id>/source/`**, 최종 HTML은 **`output/<run_id>/result/`** 아래에 생성된다.


## 동작 구조 (대화형 오케스트레이션 · 결정적 코어)

| PHASE | 스크립트/주체 | 성격 | 하는 일 |
|---|---|---|---|
| 1 일정+성향 테스트 (필수) | `trip-persona` 스킬 + `data/questions.json` | 대화 | 일정 3문 + 상황형 5문을 한 문항씩 수집 → `profile`로 5축 벡터·페르소나 산출, 미정이면 `recommend`로 Top3 |
| 2 항공·숙소+선호 (선택) | MCP `flightsFareCalendar`·`searchStays` + `date-options` | LLM+결정적 | 유연 날짜 최저가 비교·실가격 제시(예약 링크 병기) → 선호 확인 |
| 3 자유 입력 (선택) | 스킬 | 대화 | 원하는 여행을 자유 텍스트로 수집 → 스팟 수집·선별에 반영 |
| 4 계획+HTML (필수) | 웹서치 + MCP `searchTnas` 등 + `route`·`build` | LLM+결정적 | 스팟·투어 수집 → 하루 흐름 배치 → payload 임베드 단일 HTML |

**핵심 원칙**: 판단·언어·데이터 수집만 LLM이 하고, 점수·루트·HTML은 코드가 결정적으로 만든다.
모든 가격에는 그 조건에 맞는 **마이리얼트립 예약 버튼**을 붙인다(URL 지어내기 금지 — 없으면 버티컬 페이지로 폴백).

## 성향 축 카탈로그 (5축)

`planning`(즉흥↔계획) · `pace`(여유↔밀도) · `budget`(가성비↔플렉스) · `local`(랜드마크↔로컬) · `food`(관광↔먹거리).
질문지: `../strategy/question-set.md` · 페르소나 정의: `data/personas.json`(P1~P6) · 축 매핑 스펙: `../strategy/plan.md`.

## tripgen.py 서브커맨드

`profile · keys · cache-get · cache-put · recommend · date-options · route · build · run-init · pipeline`

## Claude Code (선택)

루트의 `.claude-plugin/marketplace.json`으로 마켓플레이스를 추가하면 `/trip-persona:trip-persona` 커맨드로 동일 파이프라인이 실행된다.
MCP는 `.mcp.json`으로 자동 등록.

## 디렉토리

```
src/                                제출 루트 (= 플러그인 루트)
├─ .codex-plugin/plugin.json         Codex 매니페스트 (version = 캐시버스터)
├─ .claude-plugin/plugin.json        Claude Code 매니페스트
├─ .agents/plugins/marketplace.json  로컬 마켓플레이스 (myrealtrip-src)
├─ commands/trip-persona.md          Claude Code 슬래시 커맨드
├─ .mcp.json                         마이리얼트립 MCP 등록
├─ skills/trip-persona/SKILL.md      오케스트레이터 지시문 (실행 계약 + STEP 0~7)
├─ scripts/tripgen.py                결정적 코어 (서브커맨드 10종)
├─ templates/trip.html               단일 HTML 템플릿 (payload 임베드 + 5각 레이더 + 예약 버튼)
├─ tools/                            verify_tripgen.py · render_smoke.js
├─ output-sample/                    최종 산출물에 대한 예시(실제 실행 시 output에 저장됨)
└─ data/                             questions·personas(5축)·샘플·회귀 픽 세트·cache/
../strategy/                        기획(plan.md) · 개발계획(devplan.md) · 질문지(question-set.md)
output/                             실행 결과 (source/ 중간 JSON · result/ 최종 HTML)
```
