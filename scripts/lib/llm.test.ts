import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Candidate } from './types.ts';
import { makeAsk, selectCandidates, summarize, type Ask } from './llm.ts';

const cands = (n: number): Candidate[] =>
  Array.from({ length: n }, (_, i) => ({
    title: `제목 ${i}`, url: `https://ex.com/${i}`, excerpt: `발췌 ${i}`, sourceName: '출처',
    lang: 'ko' as const, official: false, publishedAt: '2026-11-24T00:00:00Z',
  }));
const c = cands(1)[0];
const longBody = '이 기사는 새로운 인공지능 서비스가 공개되었다는 소식을 길게 다룹니다. '.repeat(20);
const ok = {
  skip: false,
  title: '새 AI 서비스가 나왔어요',
  roles: ['개발자', '일반 사무'],
  summary: ['새 서비스가 공개됐습니다.', '누구나 무료로 써 볼 수 있습니다.', '한국어도 지원합니다.'],
  whyItMatters: '문서 작업 시간이 줄어듭니다.',
};
const today = '2026-11-24';
const answer = (value: unknown): Ask => async () => value;

test('10건을 넘게 골라도 10건만 남는다', async () => {
  const out = await selectCandidates(cands(15), answer({ picks: [...Array(15).keys()] }));
  assert.equal(out.length, 10);
});

test('범위 밖·중복 번호는 무시한다', async () => {
  const out = await selectCandidates(cands(3), answer({ picks: [0, 0, 7, -1, 2, 1.5, '1'] }));
  assert.deepEqual(out.map((x) => x.url), ['https://ex.com/0', 'https://ex.com/2']);
});

test('선별 호출이 실패하면 조용히 넘어가지 않고 오류를 낸다', async () => {
  await assert.rejects(selectCandidates(cands(3), async () => { throw new Error("HTTP 401"); }, 10, 0), /401/);
  await assert.rejects(selectCandidates(cands(3), answer("oops"), 10, 0), /형식/);
});

test('고를 글이 없다는 답은 오류가 아니다', async () => {
  assert.deepEqual(await selectCandidates(cands(3), answer({ picks: [] })), []);
});

test('두 번 지워야 빈 줄이 되는 요약도 건너뛴다', async () => {
  const nested = { ...ok, summary: ['[[](x)](y)', '둘째 줄입니다.', '셋째 줄입니다.'] };
  assert.equal(await summarize(c, longBody, answer(nested), today), null);
});

test('makeAsk는 JSON이 아닌 답에서 예외를 던진다', async () => {
  const fetchFn = (async () => Response.json({ choices: [{ message: { content: '죄송하지만 할 수 없습니다' } }] })) as unknown as typeof fetch;
  await assert.rejects(makeAsk({ apiKey: 'k', model: 'm', fetchFn })('s', 'u', {}));
});

test('후보가 없으면 모델을 부르지 않는다', async () => {
  let called = false;
  assert.deepEqual(await selectCandidates([], async () => { called = true; return { picks: [] }; }), []);
  assert.equal(called, false);
});

test('재료가 500자 미만이면 모델을 부르지 않고 건너뛴다', async () => {
  let called = false;
  const ask: Ask = async () => { called = true; return ok; };
  assert.equal(await summarize({ ...c, excerpt: '짧음' }, null, ask, today), null);
  assert.equal(called, false);
});

test('본문을 못 받아도 발췌가 충분히 길면 요약한다', async () => {
  const item = await summarize({ ...c, excerpt: longBody }, null, answer(ok), today);
  assert.equal(item?.title, ok.title);
});

test('모델이 건너뛰라고 하면 건너뛴다', async () => {
  assert.equal(await summarize(c, longBody, answer({ ...ok, skip: true }), today), null);
});

test('목록에 없는 직군이 오면 건너뛴다', async () => {
  assert.equal(await summarize(c, longBody, answer({ ...ok, roles: ['의사'] }), today), null);
  assert.equal(await summarize(c, longBody, answer({ ...ok, roles: [] }), today), null);
});

test('요약이 3~5줄이 아니면 건너뛴다', async () => {
  assert.equal(await summarize(c, longBody, answer({ ...ok, summary: ['하나', '둘'] }), today), null);
  assert.equal(await summarize(c, longBody, answer({ ...ok, summary: ['1', '2', '3', '4', '5', '6'] }), today), null);
});

test('원문을 베낀 요약은 건너뛴다', async () => {
  const copied = { ...ok, summary: [longBody.slice(0, 50), '둘째 줄입니다.', '셋째 줄입니다.'] };
  assert.equal(await summarize(c, longBody, answer(copied), today), null);
});

test('태그와 주소를 지우고 나면 빈 줄이 되는 요약은 건너뛴다', async () => {
  const hollow = { ...ok, summary: ['https://evil.example/x', '둘째 줄입니다.', '셋째 줄입니다.'] };
  assert.equal(await summarize(c, longBody, answer(hollow), today), null);
});

test('깨진 응답은 건너뛴다', async () => {
  assert.equal(await summarize(c, longBody, answer('oops'), today), null);
  assert.equal(await summarize(c, longBody, answer(null), today), null);
  assert.equal(await summarize(c, longBody, async () => { throw new Error('x'); }, today), null);
});

test('정상 응답은 NewsItem이 된다', async () => {
  const item = await summarize(c, longBody, answer({ ...ok, title: '<b>새</b> 서비스', roles: ['개발자', '개발자'] }), today);
  assert.deepEqual(item, {
    title: '새 서비스', date: '2026-11-24', sourceName: c.sourceName, sourceUrl: c.url, lang: 'ko',
    roles: ['개발자'], summary: ok.summary, whyItMatters: ok.whyItMatters,
  });
});

test('기사 본문은 자료 표시 안에 넣어 보낸다', async () => {
  let seen = { system: '', user: '' };
  await summarize(c, longBody, async (system, user) => { seen = { system, user }; return ok; }, today);
  assert.ok(seen.user.includes(`<article>\n${longBody}\n</article>`));
  assert.match(seen.system, /지시.*따르지/);
});

test('makeAsk는 도구 없이 형식을 지정해 요청하고 JSON을 돌려준다', async () => {
  let sent: { url: string; headers: Record<string, string>; body: any } | undefined;
  const fetchFn = (async (url: string, init: RequestInit) => {
    sent = { url, headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
    return Response.json({ choices: [{ message: { content: '```json\n{"picks":[1]}\n```' } }] });
  }) as unknown as typeof fetch;
  const ask = makeAsk({ apiKey: 'k-test', model: 'm', fetchFn });
  assert.deepEqual(await ask('sys', 'usr', { type: 'object' }), { picks: [1] });
  assert.equal(sent?.url, 'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(sent?.headers.authorization, 'Bearer k-test');
  assert.equal(sent?.body.model, 'm');
  assert.deepEqual(sent?.body.messages, [{ role: 'system', content: 'sys' }, { role: 'user', content: 'usr' }]);
  assert.equal(sent?.body.response_format.type, 'json_schema');
  assert.equal('tools' in sent!.body, false);
});

test('makeAsk는 오류 응답에서 예외를 던지되 키를 메시지에 넣지 않는다', async () => {
  const fetchFn = (async () => new Response('{"error":"nope"}', { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(makeAsk({ apiKey: 'k-secret', model: 'm', fetchFn })('s', 'u', {}), (e: Error) => {
    assert.match(e.message, /429/);
    assert.equal(e.message.includes('k-secret'), false);
    return true;
  });
});

test('원문 제목을 그대로 쓴 것은 베낌으로 보지 않는다', async () => {
  const headline = '앤트로픽, 새 도구 출시…AI가 코드 검토부터 수정과 승인까지 자동으로 처리';
  const item = await summarize(c, `${headline} ${longBody}`, answer({ ...ok, title: headline }), today);
  assert.equal(item?.title, headline);
});

test('저장하는 원문 주소에서 추적 꼬리표를 뗀다', async () => {
  const tracked = { ...c, url: 'https://ex.com/a/?utm_source=geeknews&id=3#top' };
  const item = await summarize(tracked, longBody, answer(ok), today);
  assert.equal(item?.sourceUrl, 'https://ex.com/a/?id=3#top');
});

test('다른 나라 글자가 섞인 요약은 건너뛴다', async () => {
  for (const bad of ['300단어 이상 người 쓴 글입니다.', '새로운 模型을 공개했습니다.', 'Новая 모델을 공개했습니다.']) {
    assert.equal(await summarize(c, longBody, answer({ ...ok, summary: [bad, ...ok.summary.slice(1)] }), today), null, bad);
  }
  assert.equal(await summarize(c, longBody, answer({ ...ok, whyItMatters: '업무가 更 편해집니다.' }), today), null);
});

test('"~습니다"체가 아닌 요약은 건너뛴다', async () => {
  const plain = { ...ok, summary: ['회사가 새 서비스를 공개했다.', ...ok.summary.slice(1)] };
  assert.equal(await summarize(c, longBody, answer(plain), today), null);
});

test('요약 지시문은 말투와 숫자 규칙을 담는다', async () => {
  let system = '';
  await summarize(c, longBody, async (s) => { system = s; return ok; }, today);
  assert.match(system, /습니다/);
  assert.match(system, /숫자/);
});

test('선별은 실패하면 두 번까지 다시 시도한다', async () => {
  let calls = 0;
  const flaky: Ask = async () => { if (++calls < 3) throw new Error('timeout'); return { picks: [1] }; };
  assert.deepEqual(await selectCandidates(cands(3), flaky, 10, 0), [cands(3)[1]]);
  assert.equal(calls, 3);

  calls = 0;
  await assert.rejects(selectCandidates(cands(3), async () => { calls++; throw new Error("HTTP 401"); }, 10, 0), /401/);
  assert.equal(calls, 3);
});

test('모델을 쉼표로 여럿 주면 앞 모델이 막혔을 때 다음 모델로 넘어간다', async () => {
  const tried: string[] = [];
  const fetchFn = (async (_u: string, init: RequestInit) => {
    const model = JSON.parse(String(init.body)).model;
    tried.push(model);
    return model === 'a:free' ? new Response('rate limited', { status: 429 }) : Response.json({ choices: [{ message: { content: '{"n":1}' } }] });
  }) as unknown as typeof fetch;
  assert.deepEqual(await makeAsk({ apiKey: 'k', model: 'a:free, b:free, c:free', fetchFn })('s', 'u', {}), { n: 1 });
  assert.deepEqual(tried, ['a:free', 'b:free']);

  const down = (async () => new Response('x', { status: 429 })) as unknown as typeof fetch;
  await assert.rejects(makeAsk({ apiKey: 'k', model: 'a:free,b:free', fetchFn: down })('s', 'u', {}), /429/);
});
