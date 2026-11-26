# AI 사용설명서

바쁜 직장인과 비전공자를 위한 AI 안내 사이트입니다. 회원가입 없이 봅니다.

- **뉴스**: 국내외 AI 소식을 매일 자동으로 모아 쉬운 한국어 3~5줄로 줄이고 원문으로 연결합니다.
- **가이드**: 운영자가 직접 따라 해보고 확인한 사용법만 싣습니다.
- **직군별 보기**: 개발자, 디자이너, 기획·PM, 마케터, 일반 사무

## 구조

```
매일 07:00 KST (GitHub Actions: daily-news)
  RSS 수집 → 주소 중복 제거 → 같은 사건 묶기·최대 10건 선별
  → 본문 받기(저장 안 함) → 요약·직군 분류 → 베낌 검사
  → src/content/news/*.md 커밋 → 호스팅이 자동 배포
```

서버와 DB가 없습니다. 글은 전부 이 저장소의 마크다운 파일입니다.

| 위치 | 내용 |
|---|---|
| `sources.json` | RSS 출처 목록 |
| `scripts/collect.ts` | 매일 수집 작업 |
| `scripts/lib/llm.ts` | AI 호출(`makeAsk`), 선별, 요약 |
| `src/content/news`, `src/content/guides` | 글 |
| `src/content.config.ts` | 글 형식. 어기면 빌드가 실패합니다 |
| `docs/guide-prompt.md` | 가이드 초안 만드는 법 |
| `docs/superpowers/specs` | 설계 문서 |

## 로컬 실행

Node 24가 필요합니다(`nvm use`).

```bash
npm install
npm run dev          # 화면 보기
npm test             # 테스트
npm run build        # 빌드 + 검색 색인

OPENROUTER_API_KEY=... npm run collect -- --dry-run   # 저장 없이 요약만 출력
```

## 환경 변수

| 이름 | 어디에 | 용도 |
|---|---|---|
| `ANTHROPIC_API_KEY` | GitHub Actions 시크릿 | 뉴스 선별·요약 (Claude Haiku). 있으면 이쪽을 씁니다 |
| `OPENROUTER_API_KEY` | GitHub Actions 시크릿 | Claude 키가 없을 때 쓰는 무료 모델 |
| `LLM_MODEL` | GitHub Actions 변수(선택) | 모델 지정. 기본 `openrouter/free` |
| `PUBLIC_SHOW_DRAFTS` | 호스팅의 Preview 환경에만 `true` | 미검증 가이드를 "미검증 초안" 띠와 함께 표시 |
| `PUBLIC_CF_ANALYTICS_TOKEN` | 호스팅의 Production 환경 | Cloudflare 방문 통계 |

"여기서 막혔어요" 폼 주소는 `src/config/site.ts`의 `REPORT_FORM_URL`에 넣습니다.

## 운영

- **출처 추가**: `sources.json`에 한 줄 추가합니다. 피드 주소가 실제로 열리는지 먼저 확인하세요.
- **잘못된 요약 내리기**: `src/content/news`에서 해당 파일을 지우고, 그 글의 원문 주소를 `blocked-urls.txt`에 한 줄 추가해 커밋합니다. 주소를 적지 않으면 다음 날 다시 수집될 수 있습니다.
- **가이드 올리기**: `docs/guide-prompt.md`를 따릅니다. `verifiedAt`이 없는 가이드는 사이트에 나오지 않습니다.
- **AI 제공자 바꾸기**: `scripts/lib/llm.ts`의 `makeAsk`만 다시 쓰면 됩니다.

## 원칙

- 기사 원문과 이미지는 저장하거나 싣지 않습니다. 직접 쓴 요약과 원문 링크만 둡니다.
- robots.txt로 수집을 막은 사이트는 읽지 않습니다.
- 요약하는 AI에는 도구를 주지 않고, 게시물의 링크는 원문 링크 하나만 허용합니다.

## 첫 주에 눈으로 확인할 것

자동 테스트로 잡을 수 없는 부분입니다.

- 같은 사건을 다룬 기사가 하나로 묶이는가
- 요약이 정말 쉬운 말인가, 전문용어에 풀이가 붙는가
- 건너뛴 글이 너무 많지 않은가 (Actions 로그의 `건너뜀`)
- 무료 모델이 형식을 자주 어기지 않는가
