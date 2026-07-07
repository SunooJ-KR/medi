# E2E 실행 로그 — GlowC 세럼 / 일본(JP)

> 작업 4-1 산출물. 입력 → 부트스트랩(draft 생성→승인→승격) → 규제 검증 → 자가 루프 → HTML 리포트까지 전 과정 기록.
> 생성 리포트: `src/output/launchpass_report_GlowC_2026-07-07.html`

## 입력

- product_name: GlowC 세럼 (グロウCセラム / ビタミンC ブライトニング美容液)
- target_country: 일본
- ko_copy: `기미를 완벽하게 지워주는 미백 세럼입니다. 재생 성분이 피부를 되살립니다. 일본 판매 1위 제품!`

## STAGE 0 — 국가 리졸브

- "일본" → alpha-2 `JP`.
- 데이터 파일 확인: 첫 실행 시 `rules/jp.json`·`concerns/jp.json`·`personas/jp.json` **부재** → 부트스트랩 분기.
- **국가 무종속 입증**: 코드는 국가 상수를 갖지 않는다. 국가별 지식은 전부 데이터 파일에만 존재.

## 부트스트랩 (§4-8 A) — concerns → rules → personas

1. `concerns/jp.draft.json` 생성 (`verified_by: draft`) — 나이대별 고민 격자 + evidence·source_urls.
2. `rules/jp.draft.json` 생성 (`verified_by: draft`) — 薬機法/景表法 NG 패턴 + legal_basis·source_urls.
3. `personas/jp.draft.json` 생성 (`verified_by: draft`) — concerns 셀에서 파생, linked_concerns·evidence 필수.
4. **사람 승인·승격**: draft 검토 후 `verified_by: human`으로 승격 → `jp.json` 3종 확정.
   - draft 원본(`*.draft.json`)은 승격 이력으로 보존.
- **입증**: 위 데이터는 저장소에 사전 내장돼 있지 않았고 실행 중 생성됐다. `*.draft.json` 잔존이 부트스트랩 경로의 증거.

## STAGE 1 — 시장 스캔

- web_search 3종(트렌드/경쟁제품 가격/소비자 고민) 현지어 병행. 결과는 배경 신호일 뿐 규제 판정 비관여.

## STAGE 2 — 규제 검증 (코드 전담, AI 판단 없음)

실행:
```
python src/scripts/validate_copy.py --input "{ko_copy}" --rules src/rules/jp.json --today 2026-07-07
```

결과(엔진 실제 출력):
```
verdict   VIOLATION
pass_rate 0/3 문장 통과
JP-001  기미를 완벽하게 지워   VIOLATION
JP-002  미백                  VIOLATION
JP-003  재생                  VIOLATION
JP-003  되살                  VIOLATION
JP-004  1위                   WARNING
```

- **토큰 효율 입증**: 룰셋 본문(jp.json)은 스크립트가 디스크에서 직접 읽는다. 룰 텍스트가 LLM 컨텍스트에 진입하지 않고, 반환 JSON(verdict/violations/pass_rate)만 소비된다.
- **한국어 개념 매핑 입증**: 룰의 ng_patterns가 일본어(`美白`/`再生`)여도 한국어 입력("미백"/"재생")이 개념 브리지로 사전 탐지됨.

## STAGE 3 — 파생 + 자가 루프

- concerns 셀 × 제품 효능(비타민C 브라이트닝) 매칭 → 페르소나 3종 파생(20대 모공/피지, 30대 칙칙함/건조, 40대 기미예방/잔주름).
- copy_direction 기반 승인 카피 생성 → validate_copy.py 재투입 → 전건 PASS까지 반복.

승인 카피 검증(엔진 실제 출력, 각 PASS):
```
毛穴の目立たないなめらかな肌印象へ。ビタミンCでキメを整えるうるおい美容液。      PASS 2/2
うるおいで肌を整え、透明感のある印象へ。ビタミンC配合のなめらか美容液。          PASS 2/2
日焼けによるシミ・そばかすを防ぎ、乾燥による小じわを目立たなくする。うるおいでハリのある肌印象へ。 PASS 2/2
```
- 원본 0/3 → 승인 카피 6/6 문장 통과.

## STAGE 4 — 리포트

- `templates/readiness_report.html` 채워 `src/output/launchpass_report_GlowC_2026-07-07.html` 생성.
- 미해결 VIOLATION 존재(원본) → 신호등 판정 반영. 원본 🔴 / 승인 카피 🟢.

## 검증 요약

| 항목 | 결과 |
|------|------|
| 국가 무종속(데이터만 국가별) | ✅ `*.draft.json` 잔존이 실행 중 생성 입증 |
| 규제 판정 = 코드 | ✅ 엔진 출력이 리포트와 정확히 일치 |
| 토큰 효율(룰셋 컨텍스트 미진입) | ✅ 스크립트 디스크 로드, JSON만 소비 |
| 자가 루프(100% PASS) | ✅ 원본 0/3 → 승인 6/6 |
