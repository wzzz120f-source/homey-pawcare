# 开发者后台 Console（隐藏入口 + 超管特权）

## 一、隐藏入口（双触发）

1. **秘密 URL**：`/__dev`（不在导航中暴露），打开即弹出特权登录窗口。
2. **底部 Logo 连点 7 次**：在 `BottomNav` 版权区添加隐藏热区，2 秒内连点 7 次唤起同一登录窗口。

成功登录后跳转 `/__dev/console`（开发者总控台），并在 sessionStorage 写入 `dev_console_unlocked=1` 用于会话内显示开发者快捷栏。

## 二、超管特权账号机制（白名单 + DB 标记 双保险）

```text
登录态 → 超管判定（任一为真即超管）
  ├─ profiles.is_super_admin = true                    ← DB 标记（持久）
  └─ email ∈ SUPER_ADMIN_EMAILS（环境/常量白名单）       ← 兜底（部署即生效）
```

- 新增 `profiles.is_super_admin boolean default false`，仅由 service-role / 现有超管可写。
- 新增 `src/config/superAdmins.ts` 维护邮箱白名单（你的账号写在这里）。
- 新增 `useSuperAdmin()` hook：聚合两路判断；提供 `isSuperAdmin`、`loading`。
- **不写入 user_roles，不写入任何冗余角色数据**。

## 三、顶层放行（全角色访问，零数据污染）

改造 `RoleGuard`：在判断 `roles.includes(allow)` 之前增加最高优先级分支——

```ts
if (isSuperAdmin) return <>{children}</>;
```

同步改造 `useUserRoles`：
- 当 `isSuperAdmin === true` 时，`availableRoles` 直接返回全部 6 个角色（user/sitter/groomer/driver/merchant/admin），但 `roles` 原值不变（不污染数据）。
- `RoleSwitcher` 即可让超管自由切换到任何角色界面预览。

## 四、特权登录窗口（`SuperAdminLoginDialog`）

- 邮箱 + 密码登录（走 `supabase.auth.signInWithPassword`，无独立后端）。
- 登录成功后再次校验 `isSuperAdmin`；不是超管则立即 `signOut` 并提示"非特权账号"。
- 提供"已登录直接进入"按钮（当前会话已是超管时直接跳 `/__dev/console`）。

## 五、开发者总控台 `/__dev/console`

复用现有 `AdminLayout` 风格，新增侧栏快捷入口卡片：

```text
开发者总控台
├─ 角色模拟（一键切换 user/sitter/groomer/driver/merchant/admin → 跳对应首页）
├─ 用户管理      → /__dev/users
├─ 功能开关      → /__dev/flags
├─ 系统健康      → /__dev/health
├─ 审计日志      → /admin/audit（复用）
└─ 现有管理模块  → /admin、/admin/applications、/admin/withdrawals…
```

### 5.1 用户管理 `/__dev/users`
- 列表：搜索（邮箱/用户名/uid）、分页、显示 roles、love_points、是否封禁、KYC 状态。
- 操作：封禁/解封（`profiles.is_banned`）、改资料（username/avatar）、重置密码（生成 magic link/重置邮件）、授予/撤销 admin 角色、切换 `is_super_admin`（仅当前超管可写）。
- 全部走新建 RPC：`admin_list_users / admin_update_profile / admin_set_ban / admin_reset_password / admin_set_role`，每次写 `admin_audit_logs`。

### 5.2 功能开关 `/__dev/flags`
- 新表 `feature_flags(key text pk, enabled boolean, payload jsonb, updated_at, updated_by)`。
- 内置 key：`maintenance_mode`、`payment_enabled`、`community_post_enabled`、`ai_chat_enabled`、`flash_sale_enabled` 等。
- `useFeatureFlag(key)` hook + 全局 `MaintenanceGate`：当 `maintenance_mode=true` 时，非超管全站显示维护页。

### 5.3 系统健康 `/__dev/health`
- DB：最近 24h `postgres_logs` 错误计数（来自 `analytics_query`，由一个 edge function `dev-health` 代理，仅超管可调）。
- Edge：`function_edge_logs` 4xx/5xx 数量。
- 应用错误：读取现有 `content_violations` / `admin_audit_logs` 概览。
- Realtime/Storage：基本心跳测试。
- 卡片化展示，10s 自动刷新。

## 六、安全与审计

- 所有 `__dev/*` 路由用 `<SuperAdminGuard>`（顶层放行 + 未登录跳 `/__dev`）。
- 每个特权操作 RPC 内部 `has_super_admin(auth.uid())` 校验 + `log_admin_action` 写审计。
- 新建 SECURITY DEFINER 函数 `is_super_admin(uid)` 用于 RLS 复用，避免递归。
- `feature_flags`、`profiles.is_super_admin` 写权限仅授予超管；读权限对登录用户开放（`feature_flags` 读公开，方便客户端 gate）。

## 七、文件清单

新增：
- `src/config/superAdmins.ts` — 邮箱白名单
- `src/hooks/useSuperAdmin.ts`
- `src/components/dev/SuperAdminLoginDialog.tsx`
- `src/components/dev/SuperAdminGuard.tsx`
- `src/components/dev/DevLogoTrigger.tsx`（接入 `BottomNav` 版权区）
- `src/pages/dev/DevConsolePage.tsx`
- `src/pages/dev/DevUsersPage.tsx`
- `src/pages/dev/DevFlagsPage.tsx`
- `src/pages/dev/DevHealthPage.tsx`
- `src/hooks/useFeatureFlag.ts` + `src/components/MaintenanceGate.tsx`
- `supabase/functions/dev-health/index.ts`
- 1 份迁移：`profiles.is_super_admin` + `feature_flags` 表 + 相关 RPC + RLS

修改：
- `src/App.tsx` — 注册 `/__dev`、`/__dev/console`、`/__dev/users`、`/__dev/flags`、`/__dev/health`；包裹 `MaintenanceGate`。
- `src/components/RoleGuard.tsx` — 顶层 `isSuperAdmin` 放行。
- `src/hooks/useUserRoles.ts` — 超管 `availableRoles` 返回全角色（不写 DB）。
- `src/components/BottomNav.tsx` — 版权区接入连点触发。

## 八、验收

1. 普通账号无法访问 `/__dev`，连点 7 次后弹窗输入非超管账号 → 提示拒绝并登出。
2. 超管账号登录 → `/__dev/console` 可见全部模块。
3. 超管在 `RoleSwitcher` 中可切换到任何角色，所有 `RoleGuard` 路由直接通过；`user_roles` 表零新增。
4. 开关 `maintenance_mode=true` → 非超管打开任何页面看到维护页；超管不受影响。
5. 用户管理执行封禁/改密 → `admin_audit_logs` 留痕。
