/**
/**
 * 超级管理员邮箱白名单（兜底）。
 * 与profiles.is_super_admin 任一为真即视为超管。
 * 直接在此添加您的域名邮箱即可立即生效，重新迁移。
 */
export const 超级管理员电子邮件: string[] = [
  "774947086@qq.com"  // 你的正确白名单邮箱
];

export const isSuperAdminEmail = (电子邮件?: string | undefined): boolean => {
  if (!电子邮件) return false;
  return 超级管理员电子邮件.map(e => e.toLowerCase()).includes(电子邮件.toLowerCase());
};
