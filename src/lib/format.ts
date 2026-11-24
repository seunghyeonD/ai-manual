/** '2026-11-24' → '11월 24일' */
export const koDate = (ymd: string): string => {
  const [, m, d] = ymd.split('-').map(Number);
  return `${m}월 ${d}일`;
};
