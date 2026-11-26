import Anthropic from '@anthropic-ai/sdk';
import type { Ask } from './llm.ts';

/**
 * Claude 호출. 키는 SDK가 ANTHROPIC_API_KEY 환경 변수에서 읽는다.
 * 429·5xx·연결 오류는 SDK가 스스로 두 번까지 다시 시도한다.
 */
export function makeClaudeAsk(opts: { model: string; client?: Pick<Anthropic, 'messages'>; onUsage?: (input: number, output: number) => void }): Ask {
  const client = opts.client ?? new Anthropic();
  return async (system, user, schema) => {
    const res = await client.messages.create({
      model: opts.model,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: { type: 'json_schema', schema: schema as Record<string, unknown> } },
    });
    opts.onUsage?.(res.usage?.input_tokens ?? 0, res.usage?.output_tokens ?? 0);
    // 거절(refusal)이나 잘림(max_tokens)이면 내용이 형식에 맞지 않을 수 있다.
    if (res.stop_reason !== 'end_turn') throw new Error(`Claude 응답이 끝까지 오지 않음: ${res.stop_reason}`);
    const text = res.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text;
    if (!text) throw new Error('Claude 응답에 내용이 없음');
    return JSON.parse(text);
  };
}
