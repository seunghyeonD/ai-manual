import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { ROLES } from './config/roles';

// YAML은 따옴표 없는 2026-11-24를 Date로 읽으므로 문자열로 되돌린다.
const ymd = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
);
const roles = z.array(z.enum(ROLES)).min(1);

const news = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/news' }),
  schema: z.object({
    title: z.string().min(1),
    date: ymd,
    sourceName: z.string().min(1),
    // 이 값이 그대로 링크가 되므로 http(s)만 받는다.
    sourceUrl: z.url({ protocol: /^https?$/ }),
    lang: z.enum(['ko', 'en']),
    roles,
    summary: z.array(z.string().min(1)).min(3).max(5),
    whyItMatters: z.string().min(1),
  }),
});

const guides = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/guides' }),
  schema: z.object({
    title: z.string().min(1),
    roles,
    difficulty: z.enum(['쉬움', '보통', '어려움']),
    minutes: z.number().int().positive(),
    tools: z.array(z.string()),
    verifiedAt: ymd.optional(),
  }),
});

export const collections = { news, guides };
