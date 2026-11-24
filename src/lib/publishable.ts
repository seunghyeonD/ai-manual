/** 직접 따라 해본 날짜(verifiedAt)가 없는 가이드는 초안 표시가 켜진 빌드에서만 보인다. */
export const isPublishable = (guide: { verifiedAt?: string }, showDrafts: boolean): boolean =>
  showDrafts || Boolean(guide.verifiedAt);
