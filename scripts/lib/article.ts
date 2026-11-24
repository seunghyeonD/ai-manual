import robotsParser from 'robots-parser';

const UA = 'ai-manual-bot';
const TIMEOUT_MS = 10_000;
const MAX_CHARS = 20_000;

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** 범위를 벗어난 문자 참조는 버린다(String.fromCodePoint는 범위 밖에서 예외를 던진다). */
const codePoint = (n: number): string => (n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : '');

// ponytail: 정규식 기반 본문 추출, 광고·사이드바가 섞일 수 있음. 요약 품질이 떨어지면 @mozilla/readability로 교체
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|nav|header|footer|noscript|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => codePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => codePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

type Opts = { fetchFn?: typeof fetch };
const get = (fetchFn: typeof fetch, url: string) =>
  fetchFn(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });

/** robots.txt가 허용하는지. 없으면(4xx) 허용, 확인할 수 없으면(5xx·오류) 불허. */
async function allowedByRobots(url: URL, fetchFn: typeof fetch): Promise<boolean> {
  const robotsUrl = new URL('/robots.txt', url).toString();
  const res = await get(fetchFn, robotsUrl);
  if (res.status >= 400 && res.status < 500) return true;
  if (!res.ok) return false;
  return robotsParser(robotsUrl, await res.text()).isAllowed(url.toString(), UA) !== false;
}

/**
 * 요약 재료로 쓸 기사 본문. 저장하지 않고 호출자에게만 돌려준다.
 * 받을 수 없거나 받으면 안 되는 경우는 모두 null.
 */
export async function fetchArticleText(url: string, opts: Opts = {}): Promise<string | null> {
  const fetchFn = opts.fetchFn ?? fetch;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (!(await allowedByRobots(u, fetchFn))) return null;
    const res = await get(fetchFn, u.toString());
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('text/html')) return null;
    return htmlToText(await res.text()).slice(0, MAX_CHARS) || null;
  } catch {
    return null;
  }
}
