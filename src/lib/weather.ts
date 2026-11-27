// 빌드할 때 주요 도시의 오늘 하루 예보를 한 번 받는다. 하루 치 예보라 낮에 봐도 틀린 값이 되지 않는다. 방문자 브라우저는 날씨 서버에 요청하지 않는다.
// 자료: Open-Meteo (CC BY 4.0)

export const CITIES: [name: string, lat: number, lon: number][] = [
  ['서울', 37.57, 126.98], ['인천', 37.46, 126.71], ['수원', 37.26, 127.03], ['춘천', 37.88, 127.73],
  ['강릉', 37.75, 128.88], ['대전', 36.35, 127.38], ['청주', 36.64, 127.49], ['전주', 35.82, 127.15],
  ['광주', 35.16, 126.85], ['대구', 35.87, 128.6], ['부산', 35.18, 129.08], ['울산', 35.54, 129.31],
  ['창원', 35.23, 128.68], ['제주', 33.5, 126.53],
];

// WMO 날씨 코드: 각 구간의 마지막 코드 → 쉬운 말
const WMO: [max: number, label: string][] = [[1, '맑음'], [2, '구름 조금'], [3, '흐림'], [48, '안개'], [67, '비'], [77, '눈'], [82, '소나기'], [86, '눈'], [99, '뇌우']];

export function wmoLabel(code: number): string | undefined {
  return code >= 0 ? WMO.find(([max]) => code <= max)?.[1] : undefined;
}

/** 초속(m/s) 기준. 구간은 기상청 바람 세기 표현을 따랐다. */
export function windLabel(ms: number): string {
  return ms < 1.5 ? '바람 거의 없음' : ms < 4 ? '바람 약함' : ms < 9 ? '바람 약간 강함' : ms < 14 ? '바람 강함' : '바람 매우 강함';
}

/** 오늘 비 올 확률(%)과 예상 강수량(mm) → 우산 권고. 확률만 높고 예상 강수량이 0인 날이 있어 둘을 같이 본다. */
export function umbrella(prob: number, mm: number): string {
  if (mm >= 1) return '우산 꼭 챙기기';
  if (mm > 0) return '접는 우산 챙기기';
  return prob >= 70 ? '비 올 수도 있음, 접는 우산이면 안심' : '우산 필요 없음';
}

// ponytail: 흔히 쓰는 기온별 옷차림 표 그대로. 사람마다 다르니 참고용 — 더 세밀하게 하려면 습도·바람을 같이 보기
const OUTFIT: [min: number, wear: string][] = [[28, '반팔, 반바지'], [23, '반팔, 얇은 셔츠'], [20, '긴팔, 얇은 가디건'], [17, '맨투맨, 얇은 니트'], [12, '자켓, 가디건'], [9, '트렌치코트, 점퍼'], [5, '코트, 두꺼운 니트']];

/** 체감 최고기온(℃) → 옷차림 */
export function outfit(feelMax: number): string {
  return OUTFIT.find(([min]) => feelMax >= min)?.[1] ?? '패딩, 목도리, 장갑';
}

export interface CityWeather { sky: string; tip: string; }

const deg = (n: number) => `${Math.round(n) || 0}°`;

/** Open-Meteo 하루 예보 응답(도시가 여럿이면 배열)을 도시별 두 줄로 바꾼다. 값이 이상한 도시는 뺀다. */
export function parseWeather(json: unknown, names: string[]): Record<string, CityWeather> {
  const out: Record<string, CityWeather> = {};
  [json].flat().forEach((d, i) => {
    const daily = (d as { daily?: Record<string, unknown[]> } | null)?.daily;
    const num = (k: string) => { const v = daily?.[k]?.[0]; return typeof v === 'number' ? v : undefined; };
    const [code, max, min, feel, wind] = ['weather_code', 'temperature_2m_max', 'temperature_2m_min', 'apparent_temperature_max', 'wind_speed_10m_max'].map(num);
    const label = code === undefined ? undefined : wmoLabel(code);
    if (!label || max === undefined || min === undefined || feel === undefined || wind === undefined || !names[i]) return;
    const prob = num('precipitation_probability_max'), mm = num('precipitation_sum');
    out[names[i]] = {
      sky: `${label} · ${deg(min)}~${deg(max)} · ${windLabel(wind)}`,
      tip: [prob === undefined || mm === undefined ? '' : umbrella(prob, mm), `${outfit(feel)} (체감 최고 ${deg(feel)})`, max - min >= 10 ? '일교차 큼, 겉옷 챙기기' : ''].filter(Boolean).join(' · '),
    };
  });
  return out;
}

/** 실패하면 빈 결과. 날씨가 없어도 사이트는 만들어져야 한다. */
export async function fetchWeather(): Promise<Record<string, CityWeather>> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CITIES.map((c) => c[1])}&longitude=${CITIES.map((c) => c[2])}&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_probability_max,precipitation_sum,wind_speed_10m_max&wind_speed_unit=ms&timezone=Asia%2FSeoul&forecast_days=1`;
    return parseWeather(await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json(), CITIES.map((c) => c[0]));
  } catch {
    return {};
  }
}
