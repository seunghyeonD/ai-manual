// 요약에 나온 숫자가 원문에 실제로 있는지 대조한다. AI를 쓰지 않는 단순 비교다.

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
// 영어 큰 단위 → 한국어로 옮길 때 숫자에 곱해지는 값 (5 million = 500만, 2 billion = 20억, 3 trillion = 3조)
const SCALE: Record<string, number> = { thousand: 1000, million: 100, billion: 10, trillion: 1 };

/** 숫자 표기를 하나로 맞춘다: 쉼표 제거, 소수점 뒤 0 제거 */
const norm = (n: string): string => String(Number(n.replace(/,/g, '')));
const digits = (s: string): string[] => [...s.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => norm(m[0]));

/** 원문에서 "있는 것으로 볼" 숫자들 */
function sourceNumbers(source: string): Set<string> {
  const out = new Set(digits(source));
  const lower = source.toLowerCase();
  MONTHS.forEach((m, i) => { if (lower.includes(m)) out.add(String(i + 1)); });
  WORDS.forEach((w, i) => { if (new RegExp(`\\b${w}\\b`).test(lower)) out.add(String(i)); });
  for (const m of lower.matchAll(/(\d[\d,]*(?:\.\d+)?)\s*(thousand|million|billion|trillion)/g)) {
    out.add(norm(String(Number(m[1].replace(/,/g, '')) * SCALE[m[2]])));
  }
  return out;
}

/**
 * 요약 문장들에 있는데 원문에는 없는 숫자를 돌려준다. 빈 배열이면 통과.
 * ponytail: 단위를 바꿔 쓴 경우(12개월 → 1년, 0.5 → 절반)는 잡지 못하고 틀렸다고 본다. 안전한 쪽으로 틀리는 것이라 그대로 둔다.
 */
export function unsupportedNumbers(lines: string[], source: string): string[] {
  const have = sourceNumbers(source);
  return [...new Set(lines.flatMap(digits))].filter((n) => !have.has(n));
}
