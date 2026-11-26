import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeClaudeAsk } from './claude.ts';

const fake = (message: object) => {
  const seen: any[] = [];
  const client = { messages: { create: async (params: any) => { seen.push(params); return message; } } };
  return { client: client as any, seen };
};

test('Claude 호출은 도구 없이 형식을 지정하고 글 블록의 JSON을 돌려준다', async () => {
  const { client, seen } = fake({
    stop_reason: 'end_turn',
    usage: { input_tokens: 120, output_tokens: 30 },
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"picks":[1]}' }],
  });
  const schema = { type: 'object' };
  const used: number[] = [];
  assert.deepEqual(await makeClaudeAsk({ model: 'claude-haiku-5-5', client, onUsage: (i, o) => used.push(i, o) })('sys', 'usr', schema), { picks: [1] });
  assert.deepEqual(used, [120, 30]);
  assert.equal(seen[0].model, 'claude-haiku-5-5');
  assert.equal(seen[0].system, 'sys');
  assert.deepEqual(seen[0].messages, [{ role: 'user', content: 'usr' }]);
  assert.deepEqual(seen[0].output_config, { format: { type: 'json_schema', schema } });
  assert.equal(seen[0].tools, undefined);
});

test('거절하거나 잘린 응답은 오류로 올린다', async () => {
  for (const stop_reason of ['refusal', 'max_tokens']) {
    const { client } = fake({ stop_reason, content: [{ type: 'text', text: '{"a":' }] });
    await assert.rejects(makeClaudeAsk({ model: 'm', client })('s', 'u', {}), new RegExp(stop_reason));
  }
});
