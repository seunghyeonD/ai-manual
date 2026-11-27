import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCollect, seoulDate } from './collect.ts';
import type { Ask } from './lib/llm.ts';
import type { Source } from './lib/rss.ts';

const now = new Date('2026-11-24T00:00:00Z');
const today = '2026-11-24';
const sources: Source[] = [{ name: '출처', feedUrl: 'https://feed.example/rss', lang: 'ko', official: false }];
const body = '이 기사는 새로운 인공지능 서비스가 공개되었다는 소식을 길게 다룹니다. '.repeat(20);
const feed = (ids: number[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${ids
    .map((i) => `<item><title>글 ${i}</title><link>https://site.example/a${i}</link><pubDate>${new Date(now.getTime() - 3600_000).toUTCString()}</pubDate><description>발췌</description></item>`)
    .join('')}</channel></rss>`;
const site = (ids: number[]): typeof fetch =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    if (url === 'https://feed.example/rss') return new Response(feed(ids));
    if (url.startsWith('https://site.example/a')) return new Response(`<p>${body}</p>`, { headers: { 'content-type': 'text/html' } });
    return new Response('', { status: 404 });
  }) as typeof fetch;

/** 선별은 전부 고르고, 요약은 정해진 답을 준다. failOn이 원제에 들어 있으면 그 글에서 예외. */
const ask = (failOn?: string): Ask => async (_system, user, schema) => {
  if ('picks' in (schema as { properties: object }).properties) return { picks: [0, 1, 2, 3] };
  if (failOn && user.includes(failOn)) throw new Error('boom');
  return {
    skip: false, title: '쉬운 제목', roles: ['일반 사무'],
    summary: ['첫째 문장입니다.', '둘째 문장입니다.', '셋째 문장입니다.'], whyItMatters: '일이 빨라집니다.',
  };
};
const tmp = () => mkdtemp(join(tmpdir(), 'collect-'));
const mdFiles = async (dir: string) => (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.md'));

test('새 글이 파일로 저장된다', async () => {
  const newsDir = join(await tmp(), 'news');
  const { written } = await runCollect({ sources, newsDir, today, now, ask: ask(), fetchFn: site([1]) });
  assert.equal(written.length, 1);
  const md = await readFile(join(newsDir, written[0]), 'utf8');
  assert.ok(md.includes('sourceUrl: "https://site.example/a1"'));
  assert.ok(md.includes('date: "2026-11-24"'));
});

test('두 번 돌려도 같은 글을 다시 쓰지 않는다', async () => {
  const newsDir = await tmp();
  await runCollect({ sources, newsDir, today, now, ask: ask(), fetchFn: site([1]) });
  const second = await runCollect({ sources, newsDir, today: '2026-11-25', now, ask: ask(), fetchFn: site([1]) });
  assert.deepEqual(second.written, []);
  assert.equal((await mdFiles(newsDir)).length, 1);
});

test('새 글이 없으면 아무 파일도 만들지 않고 정상 종료한다', async () => {
  const newsDir = await tmp();
  const { written } = await runCollect({ sources, newsDir, today, now, ask: ask(), fetchFn: site([]) });
  assert.deepEqual(written, []);
  assert.deepEqual(await mdFiles(newsDir), []);
});

test('한 글이 실패해도 나머지는 저장된다', async () => {
  const newsDir = await tmp();
  const { written } = await runCollect({ sources, newsDir, today, now, ask: ask('글 1'), fetchFn: site([1, 2]) });
  assert.equal(written.length, 1);
  assert.ok((await readFile(join(newsDir, written[0]), 'utf8')).includes('https://site.example/a2'));
});

test('dry-run은 파일을 만들지 않는다', async () => {
  const newsDir = await tmp();
  const { written } = await runCollect({ sources, newsDir, today, now, ask: ask(), fetchFn: site([1]), dryRun: true });
  assert.equal(written.length, 1);
  assert.deepEqual(await mdFiles(newsDir), []);
});

test('날짜는 한국 시간 기준이다', () => {
  assert.equal(seoulDate(new Date('2026-11-23T15:00:00Z')), '2026-11-24');
  assert.equal(seoulDate(new Date('2026-11-23T14:59:59Z')), '2026-11-23');
});

// --- 최종 검토에서 나온 경우들 ---

test('내린 글은 다시 올라오지 않는다', async () => {
  const dir = await tmp();
  const blockedFile = join(dir, 'blocked-urls.txt');
  await writeFile(blockedFile, 'https://site.example/a1\n');
  const { written } = await runCollect({ sources, newsDir: join(dir, 'news'), blockedFile, today, now, ask: ask(), fetchFn: site([1, 2]) });
  assert.equal(written.length, 1);
  assert.ok((await readFile(join(dir, 'news', written[0]), 'utf8')).includes('https://site.example/a2'));
});

test('여러 건을 골랐는데 하나도 못 실으면 오류를 낸다', async () => {
  const failing: Ask = async (_s, _u, schema) => {
    if ('picks' in (schema as { properties: object }).properties) return { picks: [0, 1, 2] };
    throw new Error('HTTP 429');
  };
  await assert.rejects(runCollect({ sources, newsDir: await tmp(), today, now, ask: failing, fetchFn: site([1, 2, 3]) }), /하나도/);
});

test('저장 단계의 실패도 그 글만 건너뛴다', async () => {
  const dir = await tmp();
  const newsDir = join(dir, 'news');
  await writeFile(newsDir, '폴더 자리에 파일이 있음');
  const { written } = await runCollect({ sources, newsDir, today, now, ask: ask(), fetchFn: site([1]) });
  assert.deepEqual(written, []);
});

test('검토에서 지운 글은 다음 수집 때 다시 올라오지 않는다', async () => {
  const dir = await tmp();
  const newsDir = join(dir, 'news');
  const blockedFile = join(dir, 'blocked-urls.txt');
  await writeFile(blockedFile, '# 다시 수집하지 않을 주소\n');
  const first = await runCollect({ sources, newsDir, blockedFile, today, now, ask: ask(), fetchFn: site([1, 2]) });
  assert.equal(first.written.length, 2);
  // 검토하는 사람이 한 건을 지운다.
  await rm(join(newsDir, first.written[0]));
  const second = await runCollect({ sources, newsDir, blockedFile, today, now, ask: ask(), fetchFn: site([1, 2]) });
  assert.deepEqual(second.written, []);
  assert.match(await readFile(blockedFile, 'utf8'), /^# 다시 수집하지 않을 주소\n/);
});

test('시험 실행은 수집한 주소를 기록하지 않는다', async () => {
  const dir = await tmp();
  const blockedFile = join(dir, 'blocked-urls.txt');
  await runCollect({ sources, newsDir: join(dir, 'news'), blockedFile, today, now, ask: ask(), fetchFn: site([1, 2]), dryRun: true });
  assert.equal(await readFile(blockedFile, 'utf8').catch(() => ''), '');
});
