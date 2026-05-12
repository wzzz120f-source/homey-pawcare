/**
 * 超级管理员邮箱白名单（兜底）。
 * 与 profiles.is_super_admin 任一为真即视为超管。
 * 774947086@qq.com zyx991201直接在此添加你的特权邮箱即可立即生效，无需迁移。
 */
export const SUPER_ADMIN_EMAILS: string[] = [
  // "774947086@qq.com",zyx991201
];

export const isSuperAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
};
