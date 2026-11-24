const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

/** 요약 어느 줄에든 원문과 minChars자 이상 그대로 겹치는 구간이 있으면 true. */
export function hasLongOverlap(summary: string[], source: string, minChars = 30): boolean {
  const src = squash(source);
  return summary.some((line) => {
    const s = squash(line);
    for (let i = 0; i + minChars <= s.length; i++) {
      if (src.includes(s.slice(i, i + minChars))) return true;
    }
    return false;
  });
}
