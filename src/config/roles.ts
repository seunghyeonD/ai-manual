export const ROLES = ['개발자', '디자이너', '기획·PM', '마케터', '일반 사무'] as const;
export type Role = (typeof ROLES)[number];

const SLUGS: Record<Role, string> = {
  개발자: 'dev',
  디자이너: 'design',
  '기획·PM': 'pm',
  마케터: 'marketing',
  '일반 사무': 'office',
};

export const roleSlug = (role: Role): string => SLUGS[role];
export const roleFromSlug = (slug: string): Role | undefined => ROLES.find((r) => SLUGS[r] === slug);
