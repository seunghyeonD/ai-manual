import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fetchFeeds, type Source } from './lib/rss.ts';
import { fetchArticleText } from './lib/article.ts';
import { filterNew } from './lib/dedupe.ts';
import { makeAsk, selectCandidates, summarize, type Ask } from './lib/llm.ts';
import { makeClaudeAsk } from './lib/claude.ts';
import { newsFileName, readBlockedUrls, readExistingUrls, toMarkdown } from './lib/newsFile.ts';

/** 한국 시간 기준 YYYY-MM-DD. */
export const seoulDate = (d: Date): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);

type Deps = {
  sources: Source[];
  newsDir: string;
  /** 내린 글 주소 목록 파일. readBlockedUrls 참고 */
  blockedFile?: string;
  /** YYYY-MM-DD, 게시 날짜 */
  today: string;
  ask: Ask;
  fetchFn?: typeof fetch;
  now?: Date;
  dryRun?: boolean;
};

/** 수집 → 중복 제거 → 선별 → 본문 받기 → 요약 → 저장. 한 글의 실패는 그 글만 건너뛴다. */
export async function runCollect(deps: Deps): Promise<{ written: string[] }> {
  const { sources, newsDir, blockedFile, today, ask, fetchFn, now, dryRun = false } = deps;
  const candidates = await fetchFeeds(sources, { now, fetchFn });
  const known = new Set([...(await readExistingUrls(newsDir)), ...(blockedFile ? await readBlockedUrls(blockedFile) : [])]);
  const fresh = filterNew(candidates, known);
  const picked = await selectCandidates(fresh, ask);
  console.log(`[collect] 후보 ${candidates.length}건, 새 글 ${fresh.length}건, 선별 ${picked.length}건`);

  const written: string[] = [];
  for (const cand of picked) {
    try {
      const item = await summarize(cand, await fetchArticleText(cand.url, { fetchFn }), ask, today);
      if (!item) {
        console.log(`[collect] 건너뜀: ${cand.title}`);
        continue;
      }
      const name = newsFileName(item);
      const md = toMarkdown(item);
      if (dryRun) {
        console.log(`\n--- ${name} (저장 안 함)\n${md}`);
      } else {
        await mkdir(newsDir, { recursive: true });
        await writeFile(join(newsDir, name), md);
      }
      written.push(name);
    } catch (e) {
      console.warn(`[collect] 실패 (${cand.url}): ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`[collect] ${dryRun ? '시험 실행' : '저장'} ${written.length}건`);
  // 한두 건이 걸러지는 것은 정상이지만, 여러 건을 골라 놓고 전부 실패하면 모델이나 키가 고장 난 것이다.
  if (picked.length >= 3 && written.length === 0) {
    throw new Error(`${picked.length}건을 골랐지만 하나도 싣지 못했습니다`);
  }
  return { written };
}

async function main() {
  // ANTHROPIC_API_KEY가 있으면 Claude를, 없으면 OpenRouter(무료 모델)를 쓴다.
  let ask: Ask;
  if (process.env.ANTHROPIC_API_KEY) {
    const used = { input: 0, output: 0, calls: 0 };
    ask = makeClaudeAsk({
      model: process.env.CLAUDE_MODEL || 'claude-haiku-5-5',
      onUsage: (i, o) => { used.input += i; used.output += o; used.calls++; },
    });
    process.on('exit', () => console.log(`[llm] Claude 호출 ${used.calls}회, 입력 ${used.input} 토큰, 출력 ${used.output} 토큰`));
  } else if (process.env.OPENROUTER_API_KEY) {
    ask = makeAsk({ apiKey: process.env.OPENROUTER_API_KEY, model: process.env.LLM_MODEL || 'openrouter/free' });
  } else {
    console.error('ANTHROPIC_API_KEY 또는 OPENROUTER_API_KEY 환경 변수가 필요합니다.');
    process.exit(1);
  }
  const root = new URL('..', import.meta.url);
  await runCollect({
    sources: JSON.parse(await readFile(new URL('sources.json', root), 'utf8')),
    newsDir: fileURLToPath(new URL('src/content/news', root)),
    blockedFile: fileURLToPath(new URL('blocked-urls.txt', root)),
    today: seoulDate(new Date()),
    ask,
    dryRun: process.argv.includes('--dry-run'),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
