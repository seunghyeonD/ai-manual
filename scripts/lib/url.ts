import { createHash } from 'node:crypto';

const TRACKING = /^(utm_.*|fbclid|gclid|ref)$/i;

/** 같은 글을 가리키는 주소들을 하나의 모양으로 맞춘다. */
export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = '';
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  u.pathname = u.pathname.replace(/\/+$/, '') || '/';
  return u.toString();
}

export const urlHash = (url: string): string =>
  createHash('sha1').update(normalizeUrl(url)).digest('hex').slice(0, 8);
