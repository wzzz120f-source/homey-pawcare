## 范围

按你的反馈调整为三块：① RoleGuard 跳 `/roles` 高亮 + 返回参数；② 拆分宠托师 / 护理师 / 司机三套独立申请流程；③ 切换身份后联动 BottomNav 与主功能区路由，尽量保留当前 tab/筛选。RoleSwitcher 下拉的隐藏与文案**不动**，`/roles` 只负责跳转，不影响下拉。

---

## 1. RoleGuard 跳 /roles + 高亮未授权角色

**改动 `src/components/RoleGuard.tsx`**
- 越权时不再跳 `fallbackPath="/"`，改为：
  ```ts
  navigate(`/roles?highlight=${allow[0]}&from=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
  ```
- toast 文案改为「需要 *{角色}* 身份，已为你打开身份切换页」。
- 未登录仍跳 `/auth`，把 `from` 写入 `state`，登录后回跳。

**改动 `src/pages/RoleSwitchPage.tsx`**
- 解析 `?highlight=<role>&from=<path>`：
  - 命中卡片加脉冲边框 + `scrollIntoView({ block: "center" })`。
  - 顶部出现提示条：「你刚才尝试访问 *{from}*，需要切换到 *{role}* 身份」。
- 切换成功（已授权）：优先 `navigate(from)`，没有 `from` 才跳 `ROLE_META[r].home`。
- 切换失败（未授权）：跳 `applyPath` 并附 `?return=<原 /roles URL>`，便于提交后回到 `/roles`，状态不丢。
- RoleSwitcher 不动，`/roles` 仅承担页面级跳转语义。

---

## 2. 拆分 宠托师 / 护理师 / 司机 申请页

**问题**：当前三者都指向 `/driver/apply`，文案、卖点、所需材料完全偏向司机。

**新建独立路由与页面**

| 角色 | 路由 | 文件 | 卖点关键词 | 必填材料 | 角色独有字段 |
|---|---|---|---|---|---|
| 宠托师 | `/sitter/apply` | `src/pages/SitterApplyPage.tsx` | 灵活兼职 · 上门陪伴 · 按次结算 | 身份证正反面、手持照 | 服务区域、可上门时段、宠物经验多选 |
| 护理师 | `/groomer/apply` | `src/pages/GroomerApplyPage.tsx` | 专业认证 · 等级徽章 · 工作室派单 | 身份证正反面、手持照、美容师/兽医资质证 | 工作年限、擅长品类（洗护/SPA/医疗护理多选）、自评等级 |
| 司机 | `/driver/apply` | 现有 `DriverApplyPage.tsx`（瘦身） | 宠物专车 · 里程结算 · 自由排班 | 身份证正反面、手持照、驾驶证、行驶证 | 驾龄、车型 |

**共享层 `src/pages/apply/_shared.tsx`**
- 抽出 `ApplicationStatusBanner`、`DocUploader`（含上传进度、blob 预览、签名 URL 回填）、`ProfileFormFields`（姓名/手机/性别）、`useLatestApplication(role)` hook、`submitApplication(role, payload)` 写 `driver_applications` 表（沿用 `role_requested` 字段区分）。
- 三个页面各自只组装：步骤条 / Hero 卖点 / 材料清单 / Zod schema / 完成跳转。

**Driver 页瘦身**
- 去掉 `applyRole` 选择步骤与 `ROLE_META` 多角色分支，固定为司机流程。
- 卖点、要求文案保留现有「司机」版本。

**完成提交后的跳转**
- 三个页面统一读 `?return=`，存在则 `navigate(return)`，否则回 `/profile`。

**入口配置**
- 在 `src/pages/RoleSwitchPage.tsx` 内的 `ROLE_META` 把 `applyPath` 改为：
  - sitter → `/sitter/apply`
  - groomer → `/groomer/apply`
  - driver → `/driver/apply`
  - merchant → `/merchant/apply`（已有）
- `src/App.tsx` 注册两条新路由（`lazyTracked`）。

---

## 3. 切换身份后联动 BottomNav 与主功能区，保留 tab/筛选

**当前**：`BottomNav` 已基于 `activeRole` 自动切 `NAV_TABS`，但 `/roles` 切换后总是 `navigate(home)`，丢上下文；`WorkerDashboardPage` 只读 `?tab` 一次，不会在 `activeRole` 变化时纠正。

**改动 `src/pages/RoleSwitchPage.tsx`**
- 跳转优先级：`?from`（来自 RoleGuard）> 当前 pathname 兼容则停留 > `ROLE_META.home`。
- 「兼容」用一份 `ROLE_ALLOWED_PREFIXES` 表判断（如 user 兼容 `/`、`/community`、`/shop`、`/profile`、`/orders`；merchant 兼容 `/merchant*`、`/orders`、`/profile`；worker 三类兼容 `/worker`、`/orders`、`/profile`）。
- 跳转时使用 `navigate(targetPathWithSearch)`，**保留原 URL 的 `search` 参数**（如 `?date=2026-05-09&category=spa`）。

**改动 `src/pages/WorkerDashboardPage.tsx`**
- 新增 `useEffect` 监听 `activeRole`：当 URL 中的 `tab` 在新角色下不存在时，用 `setSearchParams(prev => { prev.set("tab", defaultTabFor(activeRole)); return prev; })` 改写 tab，**其它 query（日期、筛选等）保留**。
- 维护一份 `ROLE_VALID_TABS`：sitter→`overview/schedule/training`，groomer→`overview/services/training`，driver→`overview/route/training`。

**RoleSwitcher 不动**
- 保留现有「`availableRoles <= 1` 不显示」「只展示已授权角色」「切换后 `navigate(home)`」逻辑，避免影响下拉体验。
- `/roles` 是「全角色总览 + 智能跳转」，下拉是「快捷切换」，两者职责分离。

---

## 受影响文件

**新建**
- `src/pages/SitterApplyPage.tsx`
- `src/pages/GroomerApplyPage.tsx`
- `src/pages/apply/_shared.tsx`

**修改**
- `src/components/RoleGuard.tsx` — 越权跳 `/roles?highlight&from`
- `src/pages/RoleSwitchPage.tsx` — 高亮 + return 透传 + 兼容路由判断 + 保留 search
- `src/pages/DriverApplyPage.tsx` — 移除多角色分支，复用 `_shared`
- `src/pages/WorkerDashboardPage.tsx` — `activeRole` 变化时校正 tab，保留其它 query
- `src/App.tsx` — 注册 `/sitter/apply`、`/groomer/apply`

**不动**
- `src/components/RoleSwitcher.tsx`、`src/components/BottomNav.tsx`、`src/config/navTabs.ts`、`src/hooks/useUserRoles.ts`、`driver_applications` 表结构。

---

## 验收

1. 未授权访问 `/worker` → 跳 `/roles?highlight=sitter&from=/worker`，sitter 卡片高亮+滚动到视图，顶部提示原因。
2. 在 `/roles` 点未授权「护理师」→ 跳 `/groomer/apply?return=/roles?highlight=groomer&from=/worker`，提交后回到 `/roles`。
3. `/sitter/apply`、`/groomer/apply`、`/driver/apply` 三个页面 Hero / 材料清单 / 字段差异化，互不共用流程。
4. 在 `/community?tab=hot` 用 RoleSwitcher（仍是旧逻辑）切换角色 → 角色立刻生效、底部导航刷新；走 `/roles` 切换时若目标角色兼容当前路径则停留并保留 `?tab=hot`。
5. 在 `/worker?tab=schedule&date=2026-05-09` 切到 driver → URL 变 `/worker?tab=route&date=2026-05-09`（tab 校正、日期保留）。
