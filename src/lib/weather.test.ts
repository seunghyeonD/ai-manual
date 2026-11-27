import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wmoLabel, parseWeather } from './weather.ts';

const cur = (code: unknown, temp: unknown) => ({ current: { weather_code: code, temperature_2m: temp } });

test('날씨 코드를 쉬운 말로 바꾼다', () => {
  assert.equal(wmoLabel(0), '맑음');
  assert.equal(wmoLabel(3), '흐림');
  assert.equal(wmoLabel(61), '비');
  assert.equal(wmoLabel(73), '눈');
  assert.equal(wmoLabel(95), '뇌우');
  assert.equal(wmoLabel(150), undefined);
  assert.equal(wmoLabel(-1), undefined);
});

test('여러 도시 응답을 도시 이름별 날씨로 만든다', () => {
  assert.deepEqual(parseWeather([cur(0, 14.6), cur(71, -2.4)], ['서울', '춘천']), { 서울: '맑음 15°', 춘천: '눈 -2°' });
});

test('도시가 하나면 배열이 아닌 응답도 읽는다', () => {
  assert.deepEqual(parseWeather(cur(3, 8), ['서울']), { 서울: '흐림 8°' });
});

test('값이 이상한 도시만 빼고 나머지는 살린다', () => {
  assert.deepEqual(parseWeather([cur(0, 'x'), null, cur(999, 3), cur(2, 0.2)], ['서울', '인천', '수원', '부산']), { 부산: '구름 조금 0°' });
});

test('응답이 엉뚱하면 빈 결과를 준다', () => {
  assert.deepEqual(parseWeather({ error: true }, ['서울']), {});
  assert.deepEqual(parseWeather(undefined, ['서울']), {});
});
