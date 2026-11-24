import Parser from 'rss-parser';
import type { Candidate } from './types.ts';
import { htmlToText } from './article.ts';

export type Source = { name: string; feedUrl: string; lang: 'ko' | 'en'; official: boolean };

const WINDOW_MS = 48 * 3600_000;
const EXCERPT_CHARS = 3000;
const parser = new Parser();

async function fetchFeed(source: Source, now: Date, fetchFn: typeof fetch): Promise<Candidate[]> {
  const res = await fetchFn(source.feedUrl, {
    headers: { 'user-agent': 'ai-manual-bot' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const feed = await parser.parseString(await res.text());
  const out: Candidate[] = [];
  for (const item of feed.items) {
    const published = item.isoDate ? new Date(item.isoDate) : null;
    if (!item.link || !item.title || !published || Number.isNaN(published.getTime())) continue;
    const age = now.getTime() - published.getTime();
    if (age < 0 || age > WINDOW_MS) continue;
    out.push({
      title: htmlToText(item.title),
      url: item.link.trim(),
      excerpt: htmlToText(item['content:encoded'] ?? item.content ?? item.contentSnippet ?? '').slice(0, EXCERPT_CHARS),
      sourceName: source.name,
      lang: source.lang,
      official: source.official,
      publishedAt: published.toISOString(),
    });
  }
  return out;
}

/** 최근 48시간 글을 모은다. 출처 하나가 실패하면 경고만 남기고 나머지는 계속한다. */
export async function fetchFeeds(
  sources: Source[],
  opts: { now?: Date; fetchFn?: typeof fetch } = {},
): Promise<Candidate[]> {
  const now = opts.now ?? new Date();
  const results = await Promise.allSettled(sources.map((s) => fetchFeed(s, now, opts.fetchFn ?? fetch)));
  return results.flatMap((r, i) => {
    if (r.status === 'fulfilled') return r.value;
    console.warn(`[rss] ${sources[i].name} 건너뜀: ${r.reason instanceof Error ? r.reason.message : r.reason}`);
    return [];
  });
}
