import { buildReportUrl } from '../lib/report';

export const SITE_NAME = 'AI 사용설명서';
export const SITE_TAGLINE = '바쁜 직장인을 위한, 따라 하면 되는 AI 안내서';

/** Cloudflare Pages의 Preview 환경에서만 'true'로 둔다. */
export const SHOW_DRAFTS = import.meta.env.PUBLIC_SHOW_DRAFTS === 'true';

/** Cloudflare Web Analytics 토큰. 없으면 통계 스크립트를 넣지 않는다. */
export const CF_ANALYTICS_TOKEN: string = import.meta.env.PUBLIC_CF_ANALYTICS_TOKEN ?? '';

/** "여기서 막혔어요" 구글 폼. 비어 있으면 제보 링크를 그리지 않는다. buildReportUrl 참고. */
export const REPORT_FORM_URL = '';
export const reportUrl = (guideTitle: string): string => buildReportUrl(REPORT_FORM_URL, guideTitle);
