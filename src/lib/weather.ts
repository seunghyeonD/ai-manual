// 빌드할 때 주요 도시 날씨를 한 번 받는다. 방문자 브라우저는 날씨 서버에 요청하지 않는다.
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

/** Open-Meteo 응답(도시가 여럿이면 배열)을 { 도시: "맑음 15°" }로 바꾼다. 값이 이상한 도시는 뺀다. */
export function parseWeather(json: unknown, names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  [json].flat().forEach((d, i) => {
    const c = (d as { current?: { weather_code?: unknown; temperature_2m?: unknown } } | null)?.current;
    const label = typeof c?.weather_code === 'number' ? wmoLabel(c.weather_code) : undefined;
    if (label && typeof c?.temperature_2m === 'number' && names[i]) out[names[i]] = `${label} ${Math.round(c.temperature_2m) || 0}°`;
  });
  return out;
}

/** 실패하면 빈 결과. 날씨가 없어도 사이트는 만들어져야 한다. */
export async function fetchWeather(): Promise<Record<string, string>> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CITIES.map((c) => c[1])}&longitude=${CITIES.map((c) => c[2])}&current=temperature_2m,weather_code`;
    return parseWeather(await (await fetch(url, { signal: AbortSignal.timeout(8000) })).json(), CITIES.map((c) => c[0]));
  } catch {
    return {};
  }
}
