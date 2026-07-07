# LaunchPass — K-뷰티 글로벌 런칭 레디니스 검증

K-뷰티 제품의 해외 런칭 준비도를 검증하는 Codex 플러그인. 실행 시 입력한 **타겟 국가**를 기준으로 현지 시장 스캔 → 광고 표현 규제 검증 → 페르소나별 승인 카피 생성 → 신호등 레디니스 리포트를 자동 생성한다. **특정 국가에 종속되지 않으며**, 데이터가 없는 국가는 실행 중 자동 부트스트랩된다.

## 핵심 원칙

- **규제 판정 = 코드**: 위반 판정은 AI가 아니라 공개 법령 기반 룰셋 + `validate_copy.py` 코드 실행으로 수행. AI 환각이 컴플라이언스 판정에 개입 불가.
- **국가 무종속**: 코드·스키마는 국가 상수를 갖지 않는다. 국가별 지식은 전부 데이터 파일(`rules/`·`concerns/`·`personas/`)에만 존재. 저장소에 특정 국가 데이터가 사전 내장되지 않는다(_schema.json만 상시 존재).
- **생성(AI) → 검증(코드) → 재생성(AI)**: 카피가 검증 엔진을 100% 통과할 때까지 반복.

## 설치

Codex CLI 기준. 저장소 루트에서:

```bash
# 1) 마켓플레이스 등록 (루트의 .agents/plugins/marketplace.json 인식)
codex plugin marketplace add ./

# 2) 플러그인 설치 (반드시 <플러그인>@<마켓플레이스> 형태)
codex plugin add launchpass@launchpass-marketplace

# 확인 / 제거
codex plugin list
codex plugin remove launchpass
```

> 원격 저장소에서 바로 설치하려면 `codex plugin marketplace add <owner>/<repo>` 사용.

## 사용

자연어로 트리거한다:

```
링클핏 리페어 크림 일본 런칭 검증해줘.
카피: "주름을 완벽하게 지워주는 링클핏 크림. 재생 성분이 세포부터 되살립니다. 일본 판매 1위."
```

입력 계약(`skills/launchpass/SKILL.md`):

| 필드 | 필수 | 설명 |
|------|------|------|
| `product_name` | ✅ | 제품명 |
| `product_desc` | ✅ | 카테고리·성분·효능 |
| `target_country` | ✅ | 타겟 국가(실행 시 지정) |
| `ko_copy` | 선택 | 검증할 한국어 마케팅 카피 |

예제: `src/examples/sample_input_wrinklefit.md`

## 아키텍처 — 5단계 파이프라인

| STAGE | 담당 | 내용 |
|-------|------|------|
| 0 국가 리졸브 | 스킬 | 국가명→alpha-2. 데이터 없으면 **부트스트랩**(웹서치→draft→사람 승인→승격) |
| 1 시장 스캔 | web_search | 트렌드·경쟁제품·소비자 고민 (현지어 병행). 배경 신호일 뿐 규제 판정 비관여 |
| 2 규제 검증 | **코드** | `validate_copy.py`가 `rules/{국가}.json` 기반 NG 표현 탐지 → verdict/violations/pass_rate JSON |
| 3 파생 + 자가 루프 | AI+코드 | concerns 셀 매칭 → 페르소나 파생 → 카피 생성 → 검증 재투입(최대 3회) |
| 4 리포트 | 스킬 | `templates/readiness_report.html` 채워 신호등(🟢/🟡/🔴) 리포트 생성 |

**토큰 효율**: 룰셋 본문은 `validate_copy.py`가 디스크에서 직접 읽는다. 룰 텍스트가 LLM 컨텍스트에 진입하지 않고 반환 JSON만 소비된다.

## 디렉토리

```
src/
├── .codex-plugin/plugin.json      # 플러그인 메타데이터
├── skills/launchpass/SKILL.md     # 4-STAGE 실행 절차서
├── .mcp.json                      # web_search MCP 설정
├── rules/_schema.json             # 룰셋 스키마 (국가 데이터는 실행 중 생성)
├── concerns/_schema.json          # 나이대×고민 격자 스키마
├── personas/_schema.json          # 페르소나 스키마
├── scripts/validate_copy.py       # 규제 검증 엔진 (stdlib only)
├── templates/readiness_report.html
└── examples/                      # 예제 입력 + 실행 로그
```

> `rules/jp.json` 등 국가 데이터가 저장소에 보이면, 그것은 사전 내장이 아니라 **부트스트랩으로 생성 후 승격된 결과물**이다(`*.draft.json` 잔존이 그 경로의 증거).

## 검증

```bash
python -m unittest discover -s src/tests    # 룰셋 단위 테스트 14건
```

- 실행 로그: `src/examples/sample_run_log.md`(E2E), `sample_case_wrinklefit.md`(실사례), `sample_selfloop_log.md`(자가 루프)

---

## 질문지 5문항 답변

**Q1. 무엇을, 누가, 어떤 상황에서 쓰나요?**
K-뷰티 브랜드의 마케터·해외사업 담당자가, 제품을 특정 해외 시장(실행 시 입력)에 출시하기 전 마케팅 카피의 규제 적합성을 검증하고 현지 페르소나별 승인 카피를 확보해야 하는 상황에서 사용한다.

**Q2. 왜 이 문제를 선택했나요?**
화장품 광고 표현 규제는 국가마다 다른 이름·기준으로 존재한다(예: 일본 약기법 위반 시 매출 4.5% 과징금). 진출 시장이 늘수록 검증 부담이 국가 수만큼 곱해진다. 제품 라인이 많고 출시 주기가 짧은 브랜드가 매번 외부 법무 검수를 거치는 것은 비용·속도 병목이다. 반복적·규칙 기반·국가 불문 누락 위험이 큰 작업 — AI 에이전트 자동화에 최적이며, 특정 국가에 종속되어선 안 되는 이유이기도 하다.

**Q3. 플러그인은 어떻게 작동하나요?**
위 5단계 파이프라인 참조. 어떤 국가가 입력되어도 동일 절차가 적용되며, 저장소에 특정 국가 데이터가 사전 포함되지 않는다.

**Q4. AI를 어떻게 활용했나요?**
AI는 시장 조사(검색·요약), 카피 생성(페르소나 맞춤), 위반 표현의 대체안 제안을 담당한다. 단 규제 위반 판정은 AI가 아니라 공개 법령 기반 룰셋 + 코드 실행으로 수행해 환각이 컴플라이언스에 개입하지 못하게 설계했다. 생성→검증→재생성 루프가 핵심 AI 활용 구조다.

**Q5. 어떻게 검증했나요?**
① 룰셋 단위 테스트(알려진 위반 표현 탐지, 14건). ② 실제 사례 검증: 링클핏 실제 한국어 설명을 입력, 타겟 국가를 임의 지정(일본)해 위반 탐지→수정→PASS 전환을 로그화. 국가 데이터가 사전 내장이 아니라 실행 중 부트스트랩으로 생성됐음을 로그로 확인. ③ 자가 루프 검증: 생성 카피가 엔진을 100% 통과할 때까지 재생성되는지 확인.
