import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { NewsItem } from './types.ts';
import { normalizeUrl, urlHash } from './url.ts';

/** 모델이 쓴 글에서 태그·링크·주소를 지운다. 게시물의 링크는 sourceUrl 하나뿐이어야 한다. */
export function sanitize(text: string): string {
  return text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
