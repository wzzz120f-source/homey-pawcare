/**
 * 把 Supabase / Postgres / Auth 错误转换为对用户友好的中文提示。
 */

const PG_PATTERNS: { match: RegExp; msg: string }[] = [
  { match: /duplicate key value/i, msg: "该记录已存在，请勿重复提交" },
  { match: /violates foreign key/i, msg: "关联数据不存在，请刷新后重试" },
  { match: /violates not-null/i, msg: "缺少必填字段" },
  { match: /violates check constraint/i, msg: "提交的数据不符合规则" },
  { match: /row-level security/i, msg: "无权进行该操作" },
  { match: /permission denied/i, msg: "无权进行该操作" },
  { match: /JWT expired/i, msg: "登录已过期，请重新登录" },
  { match: /Invalid login credentials/i, msg: "邮箱或密码错误" },
  { match: /Email not confirmed/i, msg: "请先在邮箱中点击确认链接" },
  { match: /User already registered/i, msg: "该邮箱已注册" },
  { match: /Password should be at least/i, msg: "密码长度不足" },
  { match: /Failed to fetch|NetworkError/i, msg: "网络异常，请检查网络后重试" },
  { match: /rate limit|429/i, msg: "操作过于频繁，请稍后再试" },
  { match: /Bucket not found/i, msg: "上传服务暂不可用" },
  { match: /Payload too large|exceeded the maximum/i, msg: "文件过大，请压缩后再上传" },
];

export function friendlySupabaseError(err: unknown, fallback = "操作失败，请稍后再试"): string {
  if (!err) return fallback;
  const raw = typeof err === "string"
    ? err
    : (err as any)?.message || (err as any)?.error_description || (err as any)?.error || "";
  if (!raw) return fallback;
  for (const p of PG_PATTERNS) {
    if (p.match.test(raw)) return p.msg;
  }
  // 兜底：截断过长的英文堆栈
  if (/^[\x00-\x7F]+$/.test(raw) && raw.length > 60) return fallback;
  return raw;
}

import { toast } from "sonner";
export function toastError(err: unknown, fallback?: string) {
  toast.error(friendlySupabaseError(err, fallback));
}
