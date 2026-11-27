import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wmoLabel, windLabel, umbrella, outfit, parseWeather } from './weather.ts';

// Open-Meteo 하루 예보 한 도시분. 값을 하나씩 바꿔 가며 쓴다.
const day = (o: Record<string, unknown> = {}) => ({
  daily: Object.fromEntries(Object.entries({
    weather_code: 2, temperature_2m_max: 15.1, temperature_2m_min: 6.1,
    apparent_temperature_max: 13.9, precipitation_probability_max: 77, precipitation_sum: 4.2, wind_speed_10m_max: 2.66, ...o,
  }).map(([k, v]) => [k, [v]])),
});

test('날씨 코드를 쉬운 말로 바꾼다', () => {
  assert.equal(wmoLabel(0), '맑음');
  assert.equal(wmoLabel(3), '흐림');
  assert.equal(wmoLabel(61), '비');
  assert.equal(wmoLabel(73), '눈');
  assert.equal(wmoLabel(95), '뇌우');
  assert.equal(wmoLabel(150), undefined);
  assert.equal(wmoLabel(-1), undefined);
});

test('바람 세기를 말로 바꾼다 (초속 기준)', () => {
  assert.equal(windLabel(1), '바람 거의 없음');
  assert.equal(windLabel(3.9), '바람 약함');
  assert.equal(windLabel(4), '바람 약간 강함');
  assert.equal(windLabel(9), '바람 강함');
  assert.equal(windLabel(14), '바람 매우 강함');
});

test('예상 강수량과 비 올 확률을 함께 보고 우산을 권한다', () => {
  assert.equal(umbrella(10, 0), '우산 필요 없음');
  assert.equal(umbrella(50, 0), '우산 필요 없음');
  assert.equal(umbrella(90, 3.2), '우산 꼭 챙기기');
  assert.equal(umbrella(40, 1), '우산 꼭 챙기기');
  assert.equal(umbrella(40, 0.3), '접는 우산 챙기기');
});

test('확률은 높은데 예상 강수량이 0이면 단정하지 않는다', () => {
  assert.equal(umbrella(77, 0), '비 올 수도 있음, 접는 우산이면 안심');
});

test('체감 최고기온으로 옷차림을 권한다', () => {
  assert.equal(outfit(30), '반팔, 반바지');
  assert.equal(outfit(24), '반팔, 얇은 셔츠');
  assert.equal(outfit(21), '긴팔, 얇은 가디건');
  assert.equal(outfit(18), '맨투맨, 얇은 니트');
  assert.equal(outfit(13.9), '자켓, 가디건');
  assert.equal(outfit(10), '트렌치코트, 점퍼');
  assert.equal(outfit(6), '코트, 두꺼운 니트');
  assert.equal(outfit(-3), '패딩, 목도리, 장갑');
});

test('도시별로 하늘 한 줄과 챙길 것 한 줄을 만든다', () => {
  assert.deepEqual(parseWeather([day(), day({ weather_code: 0, temperature_2m_max: 20.3, temperature_2m_min: 14.8, apparent_temperature_max: 18.1, precipitation_probability_max: 24, precipitation_sum: 0, wind_speed_10m_max: 6.32 })], ['서울', '제주']), {
    서울: { sky: '구름 조금 · 6°~15° · 바람 약함', tip: '우산 꼭 챙기기 · 자켓, 가디건 (체감 최고 14°)' },
    제주: { sky: '맑음 · 15°~20° · 바람 약간 강함', tip: '우산 필요 없음 · 맨투맨, 얇은 니트 (체감 최고 18°)' },
  });
});

test('일교차가 10도 이상이면 겉옷을 덧붙인다', () => {
  assert.match(parseWeather(day({ temperature_2m_max: 18, temperature_2m_min: 6 }), ['서울']).서울.tip, / · 일교차 큼, 겉옷 챙기기$/);
  assert.doesNotMatch(parseWeather(day({ temperature_2m_max: 15, temperature_2m_min: 6 }), ['서울']).서울.tip, /일교차/);
});

test('비 정보가 없으면 우산 말은 빼고 나머지만 보여 준다', () => {
  assert.equal(parseWeather(day({ precipitation_probability_max: null }), ['서울']).서울.tip, '자켓, 가디건 (체감 최고 14°)');
  assert.equal(parseWeather(day({ precipitation_sum: null }), ['서울']).서울.tip, '자켓, 가디건 (체감 최고 14°)');
});

test('영하 기온과 -0은 깔끔하게 적는다', () => {
  assert.equal(parseWeather(day({ temperature_2m_max: -0.2, temperature_2m_min: -7.6, apparent_temperature_max: -4 }), ['서울']).서울.sky, '구름 조금 · -8°~0° · 바람 약함');
});

test('값이 이상한 도시만 빼고 나머지는 살린다', () => {
  const out = parseWeather([day({ temperature_2m_max: 'x' }), null, day({ weather_code: 999 }), day()], ['서울', '인천', '수원', '부산']);
  assert.deepEqual(Object.keys(out), ['부산']);
});

test('응답이 엉뚱하면 빈 결과를 준다', () => {
  assert.deepEqual(parseWeather({ error: true }, ['서울']), {});
  assert.deepEqual(parseWeather(undefined, ['서울']), {});
});
