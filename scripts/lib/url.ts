import { createHash } from 'node:crypto';

const TRACKING = /^(utm_.*|fbclid|gclid|ref)$/i;

/** 독자에게 보여 줄 주소에서 추적 꼬리표만 뗀다. 나머지는 건드리지 않는다. */
export function stripTracking(url: string): string {
  const u = new URL(url);
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  return u.toString();
}

/** 같은 글을 가리키는 주소들을 하나의 모양으로 맞춘다. */
export function normalizeUrl(url: string): string {
  const u = new URL(stripTracking(url));
  u.hash = '';
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.toString();
}

export const urlHash = (url: string): string =>
  createHash('sha1').update(normalizeUrl(url)).digest('hex').slice(0, 8);
