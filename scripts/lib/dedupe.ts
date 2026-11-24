import type { Candidate } from './types.ts';
import { normalizeUrl } from './url.ts';

/** 이미 실린 글과, 후보끼리 겹치는 글을 뺀다. existingUrls는 normalizeUrl을 거친 값이어야 한다. */
export function filterNew(cands: Candidate[], existingUrls: Set<string>): Candidate[] {
  const seen = new Set(existingUrls);
  return cands.filter((c) => {
    const key = normalizeUrl(c.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
