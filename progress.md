# Progress — LaunchPass 개발 진행 관리

> 계획 문서: `strategies/dev-plan.md` (단위 작업 정의의 원본 — 산출물·완료 기준·의존성은 그쪽 참조)
> 본 문서는 **진행 상태만** 관리한다. 계획 변경은 `strategies/dev-plan.md`를 수정한 뒤 이 보드에 반영한다.

Active LLM: Claude Code

## 운영 지침

1. 작업 착수 시: 해당 단위 작업을 **다음 단계 → 현재 진행 중**으로 이동한다. 동시 진행은 의존성이 없는 작업만 허용한다.
2. 작업 완료 시:
   - `strategies/dev-plan.md`의 완료 기준을 충족했는지 확인한다.
   - 해당 작업을 **현재 진행 중 → 완료사항**으로 이동하고 완료일을 기록한다.
   - **git commit을 반드시 수행한다.** 커밋 메시지 형식: `[{작업번호}] {작업명 요약}` (예: `[1-2] concerns 스키마 설계`). 커밋에는 해당 작업 산출물과 progress.md 갱신을 함께 포함한다.
   - `## Task Log`에 한국어 엔트리를 추가한다.
3. 단위 작업 도중에는 커밋하지 않는다 (1 단위 작업 = 1 커밋 원칙).

---

## 현재 진행 중

- (없음) — **전 Phase 완료. 제출 직전 `python build_submission.py` 재실행으로 최신 로그 반영.**

## 다음 단계

- (없음)

## 완료사항

- [x] **P0-1** `strategies/plan.md` 기획서 확정 — 2026-07-07
- [x] **P0-2** `strategies/dev-plan.md` 개발 계획서 작성 — 2026-07-07
- [x] **P0-3** `progress.md` 작업 보드 구성 및 지침 문서 업데이트 — 2026-07-07
- [x] **1-1** 디렉토리 구조 및 `plugin.json` 셋업 — 2026-07-07
- [x] **1-2** `concerns/_schema.json` 설계 — 2026-07-07
- [x] **1-3** `rules/_schema.json` 설계 — 2026-07-07
- [x] **1-4** `personas/_schema.json` 설계 — 2026-07-07
- [x] **1-5** 부트스트랩 절차 SKILL.md 초안 작성 — 2026-07-07 **(Phase 1 완료)**
- [x] **2-1** `validate_copy.py` 코어 구현 — 2026-07-07
- [x] **2-2** 한국어 개념 매핑 탐지 — 2026-07-07
- [x] **2-3** 출력 JSON 포맷 구현 — 2026-07-07
- [x] **2-4** 신선도 체크 구현 — 2026-07-07
- [x] **2-5** 단위 테스트 — 2026-07-07 **(Phase 2 완료)**
- [x] **3-1** SKILL.md STAGE 0 (국가 리졸브) — 2026-07-07
- [x] **3-2** SKILL.md STAGE 1 (시장 스캔) — 2026-07-07
- [x] **3-3** SKILL.md STAGE 2 (규제 검증) — 2026-07-07
- [x] **3-4** SKILL.md STAGE 3 (파생 + 자가 루프) — 2026-07-07
- [x] **3-5** SKILL.md STAGE 4 (리포트 생성) — 2026-07-07
- [x] **3-6** 신선도 체크·업데이트 절차 SKILL.md 반영 — 2026-07-07
- [x] **3-7** `readiness_report.html` 템플릿 구현 — 2026-07-07
- [x] **3-8** `.mcp.json` web_search 설정 — 2026-07-07 **(Phase 3 완료)**
- [x] **4-1** E2E 실행 (부트스트랩→리포트, 로그 기록) — 2026-07-07
- [x] **4-2** 실제 사례 검증 (링클핏) — 2026-07-07
- [x] **4-3** 자가 루프 검증 — 2026-07-07
- [x] **4-4** 예제 입력 작성 — 2026-07-07
- [x] **4-5** README.md 작성 — 2026-07-07
- [x] **4-6** 로그 정리 + submission.zip 패키징 — 2026-07-07 **(Phase 4 완료 · 전체 개발 완료)**

---

## Task Log

### 2026-07-07 — [4-6] 로그 정리 + submission.zip 패키징 (Phase 4 완료)

- **Task**: 로그 무편집 포함 + 기획서 §3 구조 submission.zip 패키징 (dev-plan 4-6)
- **LLM**: Claude Code
- **Summary**: `build_submission.py`(재현 가능 패키징 + 필수 산출물 자가 점검 assert) 신규. `submission.zip` 생성 — 33파일/111KB, `src/`+`logs/`(AI 대화 로그 2건 무편집)+`README.md`, 기획서 §3 구조 일치. `strategies/`·progress.md·CLAUDE.md·AGENTS.md·.codex/·tools/·.agents/·__pycache__ 제외. 데모 산출물로 GlowC 렌더 리포트를 `src/examples/`에 포함(sample_run_log가 참조). submission.zip은 빌드 산출물이므로 .gitignore 처리 — 제출 직전 스크립트 재실행으로 최신 로그 반영
- **Files changed**: `build_submission.py`(신규), `src/examples/launchpass_report_GlowC_2026-07-07.html`(신규), `.gitignore`, `progress.md`
- **Checks run**: `python build_submission.py` → 33 files 자가 점검 통과(README/validate_copy.py/SKILL.md/logs 존재 assert)
- **Result**: 완료 — **Phase 4 전체 완료. 전 개발 단계(P0~4) 완료**
- **Open issues**: 없음. (제출 직전 build_submission.py 재실행 권장 — 이번 세션 로그 최신화)
- **Next**: 없음 — 제출 준비 완료

### 2026-07-07 — [4-5] README.md 작성

- **Task**: 설치·실행·아키텍처·질문지 5문항 README 작성 (dev-plan 4-5)
- **LLM**: Claude Code
- **Summary**: 루트 `README.md` 신규. 핵심 원칙(판정=코드/국가무종속/생성-검증-재생성), 설치(`codex plugin marketplace add ./` + `codex plugin add launchpass@launchpass-marketplace`), 사용(입력 계약 표), 5단계 파이프라인 아키텍처, 디렉토리, 검증(unittest+로그), 질문지 5문항(기획서 §5) 포함. 설치가 실제 동작하도록 `.agents/plugins/marketplace.json`(launchpass-marketplace, source ./src, authentication ON_USE) 생성
- **Files changed**: `README.md`(신규), `.agents/plugins/marketplace.json`(신규), `progress.md`
- **Checks run**: marketplace.json JSON 파싱 확인. (설치 CLI는 로컬 Codex 환경 필요 — 문서화)
- **Result**: 완료
- **Next**: 4-6 로그 정리 + 패키징

### 2026-07-07 — [4-4] 예제 입력 작성

- **Task**: 제품 예제 입력 작성 (dev-plan 4-4)
- **LLM**: Claude Code
- **Summary**: `src/examples/sample_input_wrinklefit.md` 신규. 입력 계약(product_name/desc/target_country 필수, ko_copy 선택) 기반 링클핏 예제. **국가는 실행 시 지정** 형태 명시, 자연어 트리거 예시·부트스트랩 분기 설명 포함
- **Files changed**: `src/examples/sample_input_wrinklefit.md`(신규), `progress.md`
- **Checks run**: 없음(예제 문서)
- **Result**: 완료
- **Next**: 4-5 README.md 작성

### 2026-07-07 — [4-3] 자가 루프 검증

- **Task**: AI 생성 카피가 엔진 100% 통과까지 재생성되는지 검증 (dev-plan 4-3)
- **LLM**: Claude Code
- **Summary**: `src/examples/sample_selfloop_log.md` 신규. 생성→검증→재생성 루프 실증 — 1차 생성 카피(`美白`+`シミを消す`) 🔴 VIOLATION 0/1 → alternatives 참조 재생성 → 2차 🟢 PASS 2/2. 실제 엔진 출력 기록. 판정은 전적으로 코드(`validate_copy.py`)가 수행, AI는 생성·재생성만 담당함을 명시
- **Files changed**: `src/examples/sample_selfloop_log.md`(신규), `progress.md`
- **Checks run**: iter1 → VIOLATION 0/1(JP-002/JP-001), iter2 → PASS 2/2 엔진 실행 확인 (완료 기준: 100% PASS까지 재생성 확인 충족)
- **Result**: 완료
- **Next**: 4-4 예제 입력 작성

### 2026-07-07 — [4-2] 실제 사례 검증 (링클핏)

- **Task**: 링클핏 실제 한국어 카피 → 위반 탐지 → 수정 → PASS 전환 기록 (dev-plan 4-2)
- **LLM**: Claude Code
- **Summary**: 링클핏(JP) 실제 카피로 위반→수정→PASS 루프 검증. 검증 중 커버리지 공백 발견 — 링클핏(주름 라인)인데 "주름 완벽하게 지워"·"10년 젊어진다"가 미탐지됨. 근본 수정으로 `rules/jp.json`에 JP-005(若返り·연령역행)·JP-006(シワ除去·개선, 효능범위 초과) 추가(현지어+한국어 병기 패턴), version 1.0.0→1.1.0. 개념맵의 기존 "주름 개선"·"안티에이징(若返り)" 브리지가 이제 활성화. 결과: 원본 🔴 VIOLATION 0/3(JP-003/004/005/006 전건 탐지) → 수정 🟢 PASS 3/3. `src/examples/sample_case_wrinklefit.md` 신규
- **Files changed**: `src/rules/jp.json`(JP-005/006 추가, v1.1.0), `src/examples/sample_case_wrinklefit.md`(신규), `progress.md`
- **Checks run**: 원본 실행 → 0/3 VIOLATION 전건 탐지 확인 / 수정 카피 → 3/3 PASS 확인 / `python -m unittest discover -s src/tests` → 14 tests OK(무회귀) (완료 기준: 위반탐지→수정→PASS 전환 로그 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 4-3 자가 루프 검증

### 2026-07-07 — [4-1] E2E 실행 (부트스트랩→리포트, 로그 기록)

- **Task**: 일본(JP) 전 과정 E2E — 입력→부트스트랩→규제검증→자가루프→HTML 리포트 로그화 (dev-plan 4-1)
- **LLM**: Claude Code
- **Summary**: GlowC 세럼(JP) 시나리오로 E2E 완주. 생성 리포트 `launchpass_report_GlowC_2026-07-07.html`가 실제 엔진 출력과 정확히 일치함을 재검증 — 원본 카피 `validate_copy.py` 실행 결과 verdict=VIOLATION, 0/3, JP-001(기미 지워)·JP-002(미백)·JP-003(재생/되살) VIOLATION, JP-004(1위) WARNING로 리포트와 동일. 승인 카피 3종 각각 PASS(2/2) 재검증 → 원본 0/3 → 승인 6/6. `src/examples/sample_run_log.md` 신규 작성(국가무종속·룰셋 컨텍스트 미진입·자가루프 입증 포함). 저장소 위생: 직전 WIP 커밋에 딸려온 플러그인 캐시(`.agents/skills/`, `skills-lock.json`)와 `__pycache__` 추적 해제, `.gitignore` 추가. (로그 캡처 `logs/*.jsonl`은 제출용으로 유지)
- **Files changed**: `src/examples/sample_run_log.md` (신규), `.gitignore` (신규), `.agents/skills/**`·`skills-lock.json`·`__pycache__` 추적 해제, `progress.md`
- **Checks run**: 원본 카피 엔진 실행 → 리포트와 일치 확인 / 승인 카피 3종 각 PASS(2/2) 확인 (완료 기준: 부트스트랩→리포트 전 과정 로그·국가 데이터 실행 중 생성 입증 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 4-2 실제 사례 검증 (링클핏 라인)

### 2026-07-07 — [3-8] .mcp.json web_search 설정 (Phase 3 완료)

- **Task**: web_search MCP 서버 설정 (dev-plan 3-8)
- **LLM**: Claude Code
- **Summary**: `src/.mcp.json` 생성. `web_search` MCP 서버를 brave-search(`@modelcontextprotocol/server-brave-search`, `BRAVE_API_KEY` env)로 등록. STAGE 1·부트스트랩이 참조. 검색 제공자를 교체해도 도구 이름(web_search)만 유지하면 SKILL.md 절차 불변임을 description에 명시
- **Files changed**: `src/.mcp.json` (신규), `progress.md`
- **Checks run**: JSON 파싱 + mcpServers.web_search 등록 확인 (완료 기준: web_search 호출 가능 충족)
- **Result**: 완료 — **Phase 3 전체 완료 (3-1~3-8)**
- **Open issues**: 없음. (참고: 실제 검색 실행에는 BRAVE_API_KEY 환경변수 필요 — Phase 4 E2E 시 확인)
- **Next**: Phase 4 착수 — 4-1 E2E 실행(부트스트랩→리포트)

### 2026-07-07 — [3-7] readiness_report.html 템플릿 구현

- **Task**: 레디니스 보고서 HTML 템플릿 (기획서 §4-7, dev-plan 3-7)
- **LLM**: Claude Code
- **Summary**: `src/templates/readiness_report.html` 생성. 자립형(인라인 CSS, 라이트/다크 대응) 단일 HTML. 헤더(신호등 대형 표시 ready/conditional/notready + 데이터 버전·기준일 + freshness 경고 슬롯), 5개 섹션(요약, 시장스캔+경쟁제품표+concerns 격자 매칭 강조, 규제검증 위반 하이라이트 표+통과율 게이지, 페르소나 카드 그리드+PASS 배지+파생근거, 액션 아이템+참고 링크). `{{TOKEN}}` 단일 치환 43종과 `<!-- BEGIN/END xxx -->` 반복 블록 10쌍으로 STAGE 4가 채우도록 설계
- **Files changed**: `src/templates/readiness_report.html` (신규), `progress.md`
- **Checks run**: HTMLParser로 태그 균형 확인(unclosed 0), 5개 섹션 헤더·BEGIN/END 10쌍 일치·플레이스홀더 43종 확인 (완료 기준: 5개 섹션 + 데이터 버전·기준일 표기 충족)
- **Result**: 완료
- **Next**: 3-8 .mcp.json web_search 설정 (Phase 3 마지막)

### 2026-07-07 — [3-6] 신선도 체크·업데이트 절차 SKILL.md 반영

- **Task**: 신선도·업데이트 절차를 STAGE 2 freshness 출력과 연결해 정련 (기획서 §4-8 B, dev-plan 3-6)
- **LLM**: Claude Code
- **Summary**: SKILL.md 신선도 섹션 정련. 신선도 체크를 validate_copy.py의 실제 `freshness`(stale/days_since/warning) 반환과 연결하고 concerns·personas도 동일 기준 적용. 업데이트 절차를 web_fetch 재조회 → diff만 생성(토큰 절감) → 사람 승인 → 버전 증가+last_verified 갱신으로 구체화. concerns 갱신 시 personas의 derived_from 버전 불일치 → 재검토/재파생 표시 규칙 명시
- **Files changed**: `src/skills/launchpass/SKILL.md`, `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(재조회·diff·승인·버전증가·personas 재검토) 충족
- **Result**: 완료
- **Next**: 3-7 readiness_report.html 템플릿 구현

### 2026-07-07 — [3-5] SKILL.md STAGE 4 (리포트 생성)

- **Task**: STAGE 4 레디니스 리포트 생성 절차 (dev-plan 3-5)
- **LLM**: Claude Code
- **Summary**: SKILL.md STAGE 3 뒤에 STAGE 4 삽입. 신호등 판정 로직(미해결 VIOLATION→🔴 NOT READY / WARNING만→🟡 CONDITIONAL / 전체 PASS→🟢 READY), templates/readiness_report.html 기반 5개 섹션 채우기(헤더+신호등+데이터 버전·기준일, 요약, 시장스캔+격자, 규제검증 표+통과율, 페르소나 카드+PASS 배지, 액션 아이템), 저장 규칙 `launchpass_report_{제품명}_{YYYY-MM-DD}.html`
- **Files changed**: `src/skills/launchpass/SKILL.md`, `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(판정 로직·저장 규칙) 충족
- **Result**: 완료
- **Next**: 3-6 신선도 체크·업데이트 절차 SKILL.md 반영

### 2026-07-07 — [3-4] SKILL.md STAGE 3 (파생 + 자가 루프)

- **Task**: STAGE 3 고민→페르소나→카피 파생 + 자가 검증 루프 (dev-plan 3-4)
- **LLM**: Claude Code
- **Summary**: SKILL.md STAGE 2 뒤에 STAGE 3 삽입. concerns 로드 → 제품 효능×top_concerns 셀 매칭(STAGE 1 신호 참고) → 페르소나 동적 파생(**개수 고정 금지**, 매칭 셀 수만큼) → copy_direction 입력 카피 생성(NG 회피) → validate_copy.py 재투입 자가 루프(VIOLATION 시 alternatives 참고 재생성, **최대 3회**, 미해결 시 🔴 강등) → 전건 PASS/WARNING만일 때 승인 카피 확정. "생성(AI)→검증(코드)→재생성(AI)" 핵심 구조 명시
- **Files changed**: `src/skills/launchpass/SKILL.md`, `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(셀 매칭·동적 파생·재검증 루프·3회 제한·전건 PASS 게이트) 충족
- **Result**: 완료
- **Next**: 3-5 SKILL.md STAGE 4 (리포트 생성)

### 2026-07-07 — [3-3] SKILL.md STAGE 2 (규제 검증)

- **Task**: STAGE 2 규제 검증 절차 + 코드 실행 강제 조항 (dev-plan 3-3)
- **LLM**: Claude Code
- **Summary**: SKILL.md STAGE 1 뒤에 STAGE 2 삽입. 검증 대상 카피 결정(ko_copy 우선, 없으면 product_desc 추출), `validate_copy.py` 실행 커맨드, freshness.stale→헤더 경고, 결과 JSON(verdict/violations/pass_rate) 파싱. ⚠️ 스크립트 실행 필수·AI 자체 판단 금지, ⚠️ 룰셋 본문 컨텍스트 진입 금지(토큰 효율) 조항 명문화
- **Files changed**: `src/skills/launchpass/SKILL.md`, `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(스크립트 실행 강제·AI 대체 금지·룰셋 컨텍스트 금지) 충족
- **Result**: 완료
- **Next**: 3-4 SKILL.md STAGE 3 (파생 + 자가 루프)

### 2026-07-07 — [3-2] SKILL.md STAGE 1 (시장 스캔)

- **Task**: STAGE 1 시장 스캔 절차 작성 (dev-plan 3-2)
- **LLM**: Claude Code
- **Summary**: SKILL.md STAGE 0 뒤에 STAGE 1 삽입. 국가 무관 고정 절차 + 지역·언어만 치환하는 web_search 쿼리 3종(트렌드/경쟁제품 가격/소비자 고민), 현지어 병행 검색, 출처 URL 병기 원칙. `market_scan` 요약 형식(trend_keywords/competitors/consumer_concerns/sources) 정의. 시장 스캔은 STAGE 3 페르소나 매칭의 배경 신호일 뿐 규제 판정은 STAGE 2 코드 전담임을 명시
- **Files changed**: `src/skills/launchpass/SKILL.md`, `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(쿼리 템플릿·절차 고정·요약 형식) 충족
- **Result**: 완료
- **Next**: 3-3 SKILL.md STAGE 2 (규제 검증)

### 2026-07-07 — [3-1] SKILL.md STAGE 0 (국가 리졸브)

- **Task**: STAGE 0 정련 + 입력 계약 명시 (dev-plan 3-1)
- **LLM**: Claude Code
- **Summary**: SKILL.md에 `## 입력` 섹션(product_name/product_desc/target_country 필수, ko_copy 선택) 추가. STAGE 0을 정련 — 국가 모호/미지정 시 되묻기, 부트스트랩은 사람 승인·승격 후에만 STAGE 1 진행(승인 전 중단) 명시, 신선도 판정은 STAGE 2의 validate_copy.py freshness로 위임하고 헤더 경고로 옮김, 리졸브 결과(국가코드·파일경로·버전) 확정 단계 추가. 1-5의 "STAGE 1~4는 Phase 3에서" placeholder 제거
- **Files changed**: `src/skills/launchpass/SKILL.md`, `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(국가 변환·파일 확인·부트스트랩 분기·미지정 시 질문) 충족
- **Result**: 완료
- **Next**: 3-2 SKILL.md STAGE 1 (시장 스캔)

### 2026-07-07 — [2-5] 단위 테스트 (Phase 2 완료)

- **Task**: validate_copy.py 단위 테스트 + 테스트 전용 룰셋 픽스처 (dev-plan 2-5)
- **LLM**: Claude Code
- **Summary**: `src/tests/fixtures/rules_zz.json`(가상 코드 **ZZ** — 실제 국가 비내장 원칙 준수, 리터럴/정규식/현지어 룰 포함), `src/tests/test_validate_copy.py`(unittest, 14 케이스: 리터럴·정규식 탐지, 위치 기록, 개념 매핑 교차언어 탐지, dedupe 직접 우선, verdict VIOLATION/WARNING/PASS, pass_rate 문장 카운트, 신선도 fresh/stale/누락, build_result 계약 키) 작성. `src/requirements.txt` 추가 — 엔진·테스트는 stdlib만, jsonschema는 스키마 검증용 선택 의존성으로 명시(1-2 open issue 해소)
- **Files changed**: `src/tests/fixtures/rules_zz.json` (신규), `src/tests/test_validate_copy.py` (신규), `src/requirements.txt` (신규), `progress.md`
- **Checks run**: `python -m unittest discover -s src/tests` → 14 tests OK (완료 기준: 알려진 위반 샘플 탐지 + 테스트 전용 픽스처 경로 충족)
- **Result**: 완료 — **Phase 2 전체 완료 (2-1~2-5)**
- **Open issues**: 없음
- **Next**: Phase 3 착수 — 3-1 SKILL.md STAGE 0(국가 리졸브) *(주: STAGE 0 골격은 1-5에서 작성됨, 3-1은 리졸브 절차 상세화·정련)*

### 2026-07-07 — [2-4] 신선도 체크 구현

- **Task**: 룰셋 last_verified 90일 초과 경고 플래그 (기획서 §4-8 B, dev-plan 2-4)
- **LLM**: Claude Code
- **Summary**: `validate_copy.py`에 `FRESHNESS_THRESHOLD_DAYS=90`, `check_freshness`(오늘-last_verified 일수 계산, 임계 초과 시 stale=True+경고 문구, last_verified 누락/형식오류도 stale 처리) 추가. `build_result`에 `freshness` 필드 포함. 결정적 테스트·재현을 위해 CLI `--today` 기준일 주입 옵션 추가
- **Files changed**: `src/scripts/validate_copy.py`, `progress.md`
- **Checks run**: `--today`로 30일 경과→stale=False, 123일 경과→stale=True+경고 문구 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 2-5 단위 테스트 (Phase 2 마지막)

### 2026-07-07 — [2-3] 출력 JSON 포맷 구현

- **Task**: 검증 결과 JSON 계약 확정 (기획서 §4-3, dev-plan 2-3)
- **LLM**: Claude Code
- **Summary**: `validate_copy.py`에 `sentence_spans`(문장별 문자 스팬), `compute_verdict`(VIOLATION>WARNING>PASS), `compute_pass_rate`(위반 매칭이 걸린 문장 제외한 통과율 "N/M 문장 통과"), `build_result`(verdict/violations[rule_id·matched·position·severity·alternatives 등]/violation_count/warning_count/pass_rate) 추가. main을 최종 계약 출력으로 교체(2-1의 임시 matches 출력 제거)
- **Files changed**: `src/scripts/validate_copy.py`, `progress.md`
- **Checks run**: 3문장 중 2문장 위반 카피 → verdict=VIOLATION, violation_count=2, pass_rate="1/3 문장 통과" 확인 / 위반 없는 카피 → verdict=PASS, "1/1 문장 통과" 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 2-4 신선도 체크 구현 (last_verified 90일 초과 경고 플래그)

### 2026-07-07 — [2-2] 한국어 개념 매핑 탐지

- **Task**: 한국어 카피의 NG 개념을 타겟 국가 현지어 룰에 사전 탐지 (기획서 §4-3, dev-plan 2-2)
- **LLM**: Claude Code
- **Summary**: `src/scripts/ko_concept_map.json` 신규 — 한국어 개념 표현→키워드(현지어/영어) 브리지 테이블(재생/치료/미백/주름 개선/안티에이징 등 10개). `validate_copy.py`에 `load_concept_map`, `find_concept_matches`(한국어 개념어가 카피에 있고 룰의 ng_patterns가 해당 키워드를 포함하면 '위반 예정' 경고, source="concept"), `_dedupe`(직접 패턴 우선 보존), `detect`(직접+개념 통합) 추가. CLI `--concept-map`/`--no-concept` 인자 추가. 개념 테이블은 한국어→개념 브리지일 뿐 특정 국가 규제 비포함(국가 무종속 유지)
- **Files changed**: `src/scripts/ko_concept_map.json` (신규), `src/scripts/validate_copy.py`, `progress.md`
- **Checks run**: ng_patterns가 일본어(`再生`/`美白`)뿐인 룰에 한국어 카피("피부 재생과 미백")를 입력 → 개념 매핑으로 JP-001/JP-002 탐지 확인. `--no-concept` 시 0건(교차언어 탐지가 개념 계층 덕분임을 입증) (완료 기준 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 2-3 출력 JSON 포맷 구현 (verdict/pass_rate 확정)

### 2026-07-07 — [2-1] validate_copy.py 코어 구현

- **Task**: 룰셋 기반 카피 위반 탐지 코어 구현 (기획서 §4-3, dev-plan 2-1)
- **LLM**: Claude Code
- **Summary**: `src/scripts/validate_copy.py` 생성. 표준 라이브러리만 사용. `load_ruleset`(디스크에서 룰셋 직접 로드), `split_sentences`(한/일/영 공통 종결부호 분리, 형태소 분석기 비의존), `find_violations`(각 룰 ng_patterns를 정규식 우선→부분문자열 폴백으로 매칭, 위치 인덱스 기록) 구현. `Match` dataclass로 rule_id/matched/pattern/position/severity/alternatives/source 보관. CLI `--input`|`--input-file` + `--rules` 상호배타 인자. 후속 확장 지점 명시(2-2 개념매핑용 source 필드, 2-3 verdict/pass_rate, 2-4 신선도)
- **Files changed**: `src/scripts/validate_copy.py` (신규), `progress.md`
- **Checks run**: 임시 룰셋(스크래치패드)으로 실행 → 리터럴 패턴("재생" VIOLATION, "최고" WARNING)과 정규식 패턴(`No\.?1`→"No1") 모두 탐지, position/문장수 정확 확인 (완료 기준: CLI·패턴매칭·언어비종속 충족)
- **Result**: 완료
- **Open issues**: 현재 출력은 코어 매칭 결과(matches)만 반환. verdict/pass_rate 최종 포맷은 2-3에서 확정
- **Next**: 2-2 한국어 개념 매핑 탐지

### 2026-07-07 — [1-5] 부트스트랩 절차 SKILL.md 초안 작성 (Phase 1 완료)

- **Task**: SKILL.md에 STAGE 0(국가 리졸브)과 부트스트랩 섹션 작성 (기획서 §4-6, §4-8 A)
- **LLM**: Claude Code
- **Summary**: `src/skills/launchpass/SKILL.md` 생성. 핵심 원칙, 트리거, STAGE 0(국가명→alpha-2 코드 변환, 3개 파일 존재 확인, 미존재 시 부트스트랩 분기, 스키마·90일 신선도 체크) 작성. 부트스트랩은 **concerns→rules→personas 순서**와 각 단계의 evidence/source_urls 필수·`verified_by:ai` 초안 규칙, **draft→사람 승인→승격(verified_by:human)** 절차 명문화. 신선도·업데이트(diff 승인) 절차 포함. STAGE 1~4는 Phase 3에서 작성 예정임을 문서에 명시
- **Files changed**: `src/skills/launchpass/SKILL.md` (신규), `progress.md`
- **Checks run**: 없음 (절차 문서). 완료 기준(생성 순서·승격 절차 명문화) 충족 확인
- **Result**: 완료 — **Phase 1 전체 완료 (1-1~1-5)**
- **Open issues**: `jsonschema` 로컬 설치 상태 (requirements 명시는 Phase 2에서 반영 예정)
- **Next**: Phase 2 착수 — 2-1 validate_copy.py 코어 구현

### 2026-07-07 — [1-4] personas/_schema.json 설계

- **Task**: concerns 격자에서 파생되는 페르소나 스키마 정의 (기획서 §4-5)
- **LLM**: Claude Code
- **Summary**: JSON Schema draft 2020-12로 `market`, `version`, `last_verified`, `verified_by`, `derived_from`(파생 원천 concerns 파일·버전 추적), `personas[]`(id, **age_band**, **linked_concerns**(파생 근거), label, description, **evidence 필수**, copy_direction, channels) 정의. evidence·linked_concerns 없으면 스키마 위반 → "근거 없는 페르소나 생성 금지" 강제. 페르소나 개수는 minItems만 두어 가변 허용
- **Files changed**: `src/personas/_schema.json` (신규), `progress.md`
- **Checks run**: `check_schema` 통과 / 유효 인스턴스 PASS / evidence 누락 거부 / linked_concerns 누락 거부 확인 (완료 기준 충족). 스키마 3종(concerns/rules/personas) 완비 확인
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 1-5 부트스트랩 절차 SKILL.md 초안 작성 (Phase 1 마지막)

### 2026-07-07 — [1-3] rules/_schema.json 설계

- **Task**: 국가별 화장품 광고 규제 룰셋 스키마 정의 (기획서 §4-2)
- **LLM**: Claude Code
- **Summary**: JSON Schema draft 2020-12로 `market`, `version`, `last_verified`, `verified_by`, `legal_basis`, `source_urls`(최소 1), `rules[]`(id 패턴 `XX-000`, category, ng_patterns 최소 1, severity `VIOLATION|WARNING`, reason, condition, alternatives, unverified 플래그) 정의. `additionalProperties:false`로 스키마 고정. validate_copy.py가 소비할 계약을 확정
- **Files changed**: `src/rules/_schema.json` (신규), `progress.md`
- **Checks run**: `check_schema` 통과 / 유효 인스턴스 PASS / 잘못된 severity 거부 / ng_patterns 누락 거부 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 1-4 personas/_schema.json 설계

### 2026-07-07 — [1-2] concerns/_schema.json 설계

- **Task**: 국가×나이대×피부고민 격자 스키마 정의 (기획서 §4-4)
- **LLM**: Claude Code
- **Summary**: JSON Schema draft 2020-12로 `market`(alpha-2 패턴), `version`(semver), `last_verified`(date), `verified_by`(ai|human), `age_bands`, `grid[]`(age_band, top_concerns, **evidence 필수**, kbeauty_affinity enum) 정의. `additionalProperties:false`로 스키마 외 필드 차단. evidence 없는 셀은 스키마 위반이 되도록 강제
- **Files changed**: `src/concerns/_schema.json` (신규), `progress.md`
- **Checks run**: `jsonschema` 설치 후 `check_schema` 통과 / 유효 인스턴스 PASS / evidence 누락 인스턴스 거부 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: `jsonschema` 파이썬 패키지를 로컬에 설치함 (스키마 검증용). 추후 requirements 명시 필요
- **Next**: 1-3 rules/_schema.json 설계

### 2026-07-07 — [1-1] 디렉토리 구조 및 plugin.json 셋업

- **Task**: dev-plan.md §2 산출물 구조에 맞춘 `src/` 디렉토리 골격과 `plugin.json` 생성
- **LLM**: Claude Code
- **Summary**: `src/` 하위에 `.codex-plugin`, `skills/launchpass`, `rules`, `concerns`, `personas`, `scripts`, `templates`, `examples` 생성. 기획서 §4-1 메타데이터 그대로 `plugin.json` 작성. 빈 디렉토리는 `.gitkeep`으로 보존
- **Files changed**: `src/.codex-plugin/plugin.json` (신규), `src/**/.gitkeep` (신규), `progress.md`
- **Checks run**: `python -c json.load` — plugin.json 유효 JSON 확인 / `find src/{rules,concerns,personas} -name *.json` — 국가별 데이터 파일 부재 확인 (완료 기준 충족)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: 1-2 concerns/_schema.json 설계

### 2026-07-07 — dev-plan.md 개발 계획서 작성

- **Task**: `strategies/plan.md` 기반 개발 계획 문서 작성
- **LLM**: Claude Code
- **Summary**: 기획서의 4일 일정을 Phase 1~4로 구조화하고, 작업 항목별 산출물·완료 기준·의존성, 검증 계획, 리스크 대응, 완료 정의(DoD)를 포함한 `dev-plan.md` 작성 (이후 사용자가 `strategies/`로 이동)
- **Files changed**: `strategies/dev-plan.md` (신규), `progress.md` (로그 추가)
- **Checks run**: 없음 (문서 작업)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: Phase 1 착수

### 2026-07-07 — progress.md 작업 보드 재구성 + 지침 업데이트

- **Task**: `strategies/dev-plan.md` 기반 단위 작업 보드(현재 진행 중 / 다음 단계 / 완료사항) 구성, 단위 작업당 git commit 규칙 수립
- **LLM**: Claude Code
- **Summary**: dev-plan.md의 Phase 1~4 전체 단위 작업(1-1~4-6)을 체크리스트로 등재하고 의존성을 표기. 운영 지침에 "1 단위 작업 = 1 커밋" 원칙과 커밋 메시지 형식(`[{작업번호}] {요약}`)을 명문화. CLAUDE.md·AGENTS.md에 동일 규칙 반영
- **Files changed**: `progress.md`, `CLAUDE.md`, `AGENTS.md`
- **Checks run**: 없음 (문서 작업)
- **Result**: 완료
- **Open issues**: 없음
- **Next**: Phase 1 착수 (1-1 디렉토리 구조 및 plugin.json 셋업부터)
