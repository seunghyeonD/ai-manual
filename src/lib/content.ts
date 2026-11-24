import { getCollection, type CollectionEntry } from 'astro:content';
import { SHOW_DRAFTS } from '../config/site';
import { isPublishable } from './publishable';

export type News = CollectionEntry<'news'>;
export type Guide = CollectionEntry<'guides'>;

/** 최신 날짜가 먼저. */
export async function getNews(): Promise<News[]> {
  return (await getCollection('news')).sort((a, b) => b.data.date.localeCompare(a.data.date));
}

/** 검증된 가이드만(초안 표시가 켜진 빌드에서는 전부). 최근 검증한 것이 먼저, 초안은 맨 위. */
export async function getGuides(): Promise<Guide[]> {
  return (await getCollection('guides'))
    .filter((g) => isPublishable(g.data, SHOW_DRAFTS))
    .sort((a, b) => (b.data.verifiedAt ?? '9999').localeCompare(a.data.verifiedAt ?? '9999'));
}
