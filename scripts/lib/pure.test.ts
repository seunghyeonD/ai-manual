import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { Candidate, NewsItem } from './types.ts';
import { normalizeUrl } from './url.ts';
import { filterNew } from './dedupe.ts';
import { hasLongOverlap } from './overlap.ts';
import { sanitize, toMarkdown, newsFileName, readExistingUrls } from './newsFile.ts';

const base: Candidate = {
  title: '제목', url: 'https://ex.com/x', excerpt: '발췌', sourceName: '출처',
  lang: 'ko', official: false, publishedAt: '2026-11-24T00:00:00Z',
};
const item: NewsItem = {
  title: '제목', date: '2026-11-24', sourceName: '출처', sourceUrl: 'https://ex.com/a',
  lang: 'ko', roles: ['개발자'], summary: ['첫 줄', '둘째 줄', '셋째 줄'], whyItMatters: '이유',
};
const parseFrontmatter = (md: string) => parseYaml(md.split('---')[1]);

test('추적 파라미터와 끝 슬래시만 다른 주소는 같은 글이다', () => {
  assert.equal(normalizeUrl('https://Ex.com/a/?utm_source=x&id=3#top'), normalizeUrl('https://ex.com/a?id=3'));
});

test('이미 실린 글과 후보끼리 겹치는 글을 뺀다', () => {
  const c = (url: string) => ({ ...base, url });
  const out = filterNew(
    [c('https://ex.com/a?utm_medium=rss'), c('https://ex.com/b'), c('https://ex.com/b/')],
    new Set([normalizeUrl('https://ex.com/a')]),
  );
  assert.deepEqual(out.map((x) => x.url), ['https://ex.com/b']);
});

test('원문과 30자 이상 그대로 겹치면 베낌으로 본다', () => {
  const src = '오늘 회사는 새로운 인공지능 모델을 공개하고 모든 사용자에게 무료로 제공한다고 발표했습니다.';
  assert.equal(hasLongOverlap([src.slice(3, 40)], src), true);
  assert.equal(hasLongOverlap(['새 AI 모델이 나왔고 누구나 무료로 쓸 수 있습니다.'], src), false);
});

test('공백 차이는 겹침 판정을 피하지 못한다', () => {
  assert.equal(
    hasLongOverlap(
      ['a b  c d e f g h i j k l m n o p q r s t u v w x y z 1 2 3 4'],
      'a b c d e f g h i j k l m n o p q r s t u v w x y z 1 2 3 4',
    ),
    true,
  );
});

test('태그와 링크는 게시물에서 사라진다', () => {
  assert.equal(sanitize('<script>x</script>안녕 [여기](https://evil.example) https://evil.example 끝'), '안녕 여기 끝');
});

test('따옴표·콜론·이모지가 있어도 프론트매터가 유효하다', () => {
  const md = toMarkdown({ ...item, title: '"GPT": 새 기능 🎉 #1', whyItMatters: "it's: fine" });
  const parsed = parseFrontmatter(md);
  assert.equal(parsed.title, '"GPT": 새 기능 🎉 #1');
  assert.equal(parsed.whyItMatters, "it's: fine");
  assert.equal(parsed.summary.length, item.summary.length);
  assert.equal(parsed.date, '2026-11-24');
});

test('게시물에 들어가는 글자에서 태그와 링크를 지운다', () => {
  const parsed = parseFrontmatter(
    toMarkdown({ ...item, summary: ['<b>굵게</b> [클릭](https://evil.example)', '둘', '셋'] }),
  );
  assert.equal(parsed.summary[0], '굵게 클릭');
  assert.equal(parsed.sourceUrl, 'https://ex.com/a');
});

test('같은 날 다른 글은 파일 이름이 다르다', () => {
  assert.notEqual(
    newsFileName({ ...item, sourceUrl: 'https://ex.com/a' }),
    newsFileName({ ...item, sourceUrl: 'https://ex.com/b' }),
  );
  assert.match(newsFileName(item), /^2026-11-24-[0-9a-f]{8}\.md$/);
});

test('저장된 글의 주소를 다시 읽어 온다', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'news-'));
  await writeFile(join(dir, newsFileName(item)), toMarkdown({ ...item, sourceUrl: 'https://ex.com/a/?utm_source=x' }));
  assert.deepEqual(await readExistingUrls(dir), new Set([normalizeUrl('https://ex.com/a')]));
  assert.deepEqual(await readExistingUrls(join(dir, 'missing')), new Set());
});
