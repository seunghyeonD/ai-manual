import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NewsItem } from './types.ts';
import { normalizeUrl, urlHash } from './url.ts';

/** 모델이 쓴 글에서 태그·링크·주소를 지운다. 게시물의 링크는 sourceUrl 하나뿐이어야 한다. */
export function sanitize(text: string): string {
  // 한 번 지운 결과가 다시 태그·링크 모양이 될 수 있어서([[](x)](y) 등) 더 바뀌지 않을 때까지 반복한다.
  let out = text;
  for (let i = 0; i < 10; i++) {
    const next = out
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (next === out) return out;
    out = next;
  }
  return ''; // 열 번을 돌려도 안정되지 않는 글은 싣지 않는다
}

/** JSON 문자열은 유효한 YAML 스칼라라서 따옴표·콜론·이모지가 있어도 안전하다. */
export function toMarkdown(item: NewsItem): string {
  const q = (s: string) => JSON.stringify(sanitize(s));
  return [
    '---',
    `title: ${q(item.title)}`,
    `date: ${JSON.stringify(item.date)}`,
    `sourceName: ${q(item.sourceName)}`,
    `sourceUrl: ${JSON.stringify(item.sourceUrl)}`,
    `lang: ${JSON.stringify(item.lang)}`,
    `roles: ${JSON.stringify(item.roles)}`,
    'summary:',
    ...item.summary.map((line) => `  - ${q(line)}`),
    `whyItMatters: ${q(item.whyItMatters)}`,
    '---',
    '',
  ].join('\n');
}

export const newsFileName = (item: NewsItem): string => `${item.date}-${urlHash(item.sourceUrl)}.md`;

/** 이미 실린 글들의 주소(normalizeUrl을 거친 값). 폴더가 없으면 빈 집합. */
export async function readExistingUrls(dir: string): Promise<Set<string>> {
  const files = await readdir(dir).catch(() => [] as string[]);
  const urls = new Set<string>();
  for (const f of files.filter((f) => f.endsWith('.md'))) {
    const m = (await readFile(join(dir, f), 'utf8')).match(/^sourceUrl:\s*(.+)$/m);
    if (!m) continue;
    try {
      urls.add(normalizeUrl(m[1].startsWith('"') ? JSON.parse(m[1]) : m[1].trim()));
    } catch {
      // 주소가 깨진 파일은 중복 판정에서 빼고 넘어간다. 빌드의 스키마 검사가 따로 잡는다.
    }
  }
  return urls;
}

/**
 * 내린 글 목록(한 줄에 주소 하나, #은 주석). 파일을 지우기만 하면 48시간 안에 다시 수집될 수 있어서,
 * 내린 글의 주소를 여기에 적어 둔다. 파일이 없으면 빈 집합.
 */
export async function readBlockedUrls(file: string): Promise<Set<string>> {
  const text = await readFile(file, 'utf8').catch(() => '');
  const urls = new Set<string>();
  for (const line of text.split('\n').map((l) => l.trim())) {
    if (!line || line.startsWith('#')) continue;
    try {
      urls.add(normalizeUrl(line));
    } catch {
      // 주소가 아닌 줄은 무시한다.
    }
  }
  return urls;
}

/** 최근 days일 동안 실은 소식의 제목. 같은 사건을 다른 매체 글로 또 싣지 않게 선별에 넘긴다. */
export async function readRecentTitles(dir: string, today: string, days = 3): Promise<string[]> {
  const since = new Date(Date.parse(today) - days * 86_400_000).toISOString().slice(0, 10);
  const files = (await readdir(dir).catch(() => [] as string[])).filter((f) => f.endsWith('.md') && f.slice(0, 10) >= since);
  const titles: string[] = [];
  for (const f of files) {
    const m = (await readFile(join(dir, f), 'utf8')).match(/^title:\s*(.+)$/m);
    if (!m) continue;
    try {
      titles.push(m[1].startsWith('"') ? JSON.parse(m[1]) : m[1].trim());
    } catch {
      // 깨진 제목은 넘어간다.
    }
  }
  return titles;
}
