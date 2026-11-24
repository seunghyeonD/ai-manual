/** formUrl은 구글 폼의 "미리 채워진 링크"에서 제목 항목 값만 비운 주소(…&entry.123=)다. */
export const buildReportUrl = (formUrl: string, guideTitle: string): string =>
  formUrl ? formUrl + encodeURIComponent(guideTitle) : '';
