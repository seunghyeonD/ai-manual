import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fetchFeeds, type Source } from './lib/rss.ts';
import { fetchArticleText } from './lib/article.ts';
import { filterNew } from './lib/dedupe.ts';
import { makeAsk, selectCandidates, summarize, type Ask } from './lib/llm.ts';
import { newsFileName, readExistingUrls, toMarkdown } from './lib/newsFile.ts';

/** 한국 시간 기준 YYYY-MM-DD. */
export const seoulDate = (d: Date): string =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d);

type Deps = {
  sources: Source[];
  newsDir: string;
  /** YYYY-MM-DD, 게시 날짜 */
  today: string;
  ask: Ask;
  fetchFn?: typeof fetch;
  now?: Date;
  dryRun?: boolean;
};

/** 수집 → 중복 제거 → 선별 → 본문 받기 → 요약 → 저장. 한 글의 실패는 그 글만 건너뛴다. */
export async function runCollect(deps: Deps): Promise<{ written: string[] }> {
  const { sources, newsDir, today, ask, fetchFn, now, dryRun = false } = deps;
  const candidates = await fetchFeeds(sources, { now, fetchFn });
  const fresh = filterNew(candidates, await readExistingUrls(newsDir));
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
  return { written };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY 환경 변수가 필요합니다.');
    process.exit(1);
  }
  const root = new URL('..', import.meta.url);
  await runCollect({
    sources: JSON.parse(await readFile(new URL('sources.json', root), 'utf8')),
    newsDir: new URL('src/content/news', root).pathname,
    today: seoulDate(new Date()),
    ask: makeAsk({ apiKey, model: process.env.LLM_MODEL || 'openrouter/free' }),
    dryRun: process.argv.includes('--dry-run'),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
