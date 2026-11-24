import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchFeeds, type Source } from './rss.ts';
import { fetchArticleText, htmlToText } from './article.ts';

type Reply = string | number | { body: string; type: string };

/** 주소별로 정해진 응답을 돌려주는 가짜 fetch. 목록에 없는 주소는 404. */
function fake(routes: Record<string, Reply>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const r = routes[String(input)];
    if (r === undefined) return new Response('', { status: 404 });
    if (typeof r === 'number') return new Response('', { status: r });
    const { body, type } = typeof r === 'string' ? { body: r, type: 'text/html; charset=utf-8' } : r;
    return new Response(body, { status: 200, headers: { 'content-type': type } });
  }) as typeof fetch;
}

const now = new Date('2026-11-24T00:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000).toUTCString();
const rssXml = (items: { title: string; link: string; date: string; desc?: string }[]) =>
  `<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>${items
    .map((i) => `<item><title>${i.title}</title><link>${i.link}</link><pubDate>${i.date}</pubDate><description>${i.desc ?? '설명'}</description></item>`)
    .join('')}</channel></rss>`;
const src = (name: string): Source => ({ name, feedUrl: `https://${name}.example/rss`, lang: 'en', official: name === 'ok' });

test('출처 하나가 깨져도 나머지는 수집된다', async () => {
  const fetchFn = fake({
    'https://ok.example/rss': rssXml([{ title: '새 글', link: 'https://ok.example/1', date: hoursAgo(1), desc: '<p>요약 <b>글</b></p>' }]),
    'https://bad.example/rss': '<<<not xml',
    'https://down.example/rss': 500,
  });
  const out = await fetchFeeds([src('ok'), src('bad'), src('down')], { now, fetchFn });
  assert.equal(out.length, 1);
  assert.deepEqual(
    { ...out[0], publishedAt: undefined },
    { title: '새 글', url: 'https://ok.example/1', excerpt: '요약 글', sourceName: 'ok', lang: 'en', official: true, publishedAt: undefined },
  );
  assert.equal(new Date(out[0].publishedAt).getTime(), now.getTime() - 3600_000);
});

test('48시간보다 오래된 글은 버린다', async () => {
  const fetchFn = fake({
    'https://ok.example/rss': rssXml([
      { title: '옛 글', link: 'https://ok.example/old', date: hoursAgo(72) },
      { title: '어제 글', link: 'https://ok.example/new', date: hoursAgo(47) },
    ]),
  });
  const out = await fetchFeeds([src('ok')], { now, fetchFn });
  assert.deepEqual(out.map((c) => c.title), ['어제 글']);
});

test('robots.txt가 막은 주소는 받지 않는다', async () => {
  const fetchFn = fake({
    'https://ex.com/robots.txt': { body: 'User-agent: *\nDisallow: /news/', type: 'text/plain' },
    'https://ex.com/news/1': '<p>본문</p>',
  });
  assert.equal(await fetchArticleText('https://ex.com/news/1', { fetchFn }), null);
});

test('robots.txt가 없으면(404) 받는다', async () => {
  const fetchFn = fake({ 'https://ex.com/news/1': '<html><body><p>본문입니다</p></body></html>' });
  assert.equal(await fetchArticleText('https://ex.com/news/1', { fetchFn }), '본문입니다');
});

test('robots.txt를 확인할 수 없으면(서버 오류) 받지 않는다', async () => {
  const fetchFn = fake({ 'https://ex.com/robots.txt': 503, 'https://ex.com/news/1': '<p>본문</p>' });
  assert.equal(await fetchArticleText('https://ex.com/news/1', { fetchFn }), null);
});

test('HTML이 아니거나 실패하면 null', async () => {
  const fetchFn = fake({ 'https://ex.com/a.pdf': { body: '%PDF', type: 'application/pdf' }, 'https://ex.com/forbidden': 403 });
  assert.equal(await fetchArticleText('https://ex.com/a.pdf', { fetchFn }), null);
  assert.equal(await fetchArticleText('https://ex.com/forbidden', { fetchFn }), null);
  assert.equal(await fetchArticleText('file:///etc/passwd', { fetchFn }), null);
});

test('네트워크 오류가 나도 예외 없이 null', async () => {
  const fetchFn = (async () => { throw new Error('offline'); }) as unknown as typeof fetch;
  assert.equal(await fetchArticleText('https://ex.com/news/1', { fetchFn }), null);
});

test('본문은 20,000자까지만 쓴다', async () => {
  const fetchFn = fake({ 'https://ex.com/long': `<p>${'가'.repeat(30_000)}</p>` });
  assert.equal((await fetchArticleText('https://ex.com/long', { fetchFn }))?.length, 20_000);
});

test('스크립트와 메뉴는 본문에서 빠진다', () => {
  assert.equal(htmlToText('<nav>메뉴</nav><script>x()</script><p>본문 &amp; 내용</p>'), '본문 & 내용');
});
