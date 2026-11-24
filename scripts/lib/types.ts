import type { Role } from '../../src/config/roles.ts';

/** RSS에서 막 가져온 글. */
export type Candidate = {
  title: string;
  url: string;
  excerpt: string;
  sourceName: string;
  lang: 'ko' | 'en';
  official: boolean;
  /** ISO 8601 */
  publishedAt: string;
};

/** 사이트에 실리는 뉴스 한 건. src/content.config.ts의 news 스키마와 같다. */
export type NewsItem = {
  title: string;
  /** YYYY-MM-DD, Asia/Seoul */
  date: string;
  sourceName: string;
  sourceUrl: string;
  lang: 'ko' | 'en';
  roles: Role[];
  summary: string[];
  whyItMatters: string;
};
