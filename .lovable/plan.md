# 统一注册入口 & 多角色系统

将现有「用户/服务商」二选一改造为四角色统一注册流程，并基于角色自动切换导航与主题色，新增轻量审核中台。

## 一、注册流程改造（AuthPage）

将 `AuthPage.tsx` 改成三步式向导：

```text
Step1 基础验证        Step2 角色选择            Step3 资料补全
─────────────────    ─────────────────────    ──────────────────────
品牌Logo+欢迎文案     4张大卡片+图标            按角色路由：
邮箱/密码注册         ─ 普通用户(铲屎官)         ├ user → /pets 宠物档案
(预留手机号入口)      ─ 宠托师(兼职)             ├ sitter → /driver/apply
                     ─ 护理师(专业资质)         ├ groomer → /driver/apply?type=pro
                     ─ 商家(实体店)             └ merchant → /merchant/apply
```

- 欢迎文案使用用户提供的 Homey 品牌话术。
- 注册成功后强制进入 Step2，写入选定角色到 `user_roles`（新增枚举值 `sitter` / `groomer`，已有 `merchant` 复用）。
- 护理师与宠托师走同一申请页，通过 query 区分是否需要"专业技能标签"区块。

## 二、角色系统与权限视图

### 1. 数据库
- 扩展 `app_role` 枚举：增加 `sitter`、`groomer`（已有 `admin`、`merchant`、`user`）。
- 新增 hook `useUserRoles()`：聚合 `user_roles` 表查询当前用户全部角色，缓存于 React Query。
- 已存在的 `driver_applications` / `merchant_applications` 表沿用，新增 `role_requested` 字段记录是 sitter 还是 groomer。

### 2. 主题色 & 底栏切换
- 在 `BottomNav.tsx` 内根据 `useUserRoles()` 主角色渲染不同 Tab：
  - **user**：首页 / 商城 / 社区 / 客服 / 我的（现状）
  - **sitter / groomer**：工作台 / 订单 / 接单地图 / 培训 / 我的
  - **merchant**：经营看板 / 管理 / 订单 / 客服 / 我的
- 在 `index.css` 增加三套 CSS 变量主题：
  - `data-role="user"` → 暖橙（现状 primary）
  - `data-role="worker"` → 森林绿
  - `data-role="merchant"` → 商务蓝
- 在 `App.tsx` 顶层 `<div data-role={activeRole}>` 包裹，方便整站换肤。

### 3. 新增页面（最小可用）
- `/worker` 工作台：今日待办 + 待接订单地图占位 + 今日预计收入卡片。
- `/merchant` 已存在 → 增加营业额/转化率看板卡片。
- `/admin/review` 审核中台：列出 `driver_applications` 和 `merchant_applications` 中 `status='pending'` 的记录，一键调用现有 `approve_*` / `reject_*` RPC。仅 `admin` 角色可见。

## 三、ProfilePage 宫格化

将"我的"页面顶部改为 3×N 宫格（已有钱包/订单等），未入驻用户固定一格"入驻赚钱"→ 跳回 `/auth?step=role`。

## 四、关键流程预留

- `BookingPage` → 服务人员"开始服务"按钮发送 `notifications` insert（沿用现有触发器）。
- 地理围栏：在 `TripTrackingPage` 的"确认到达"按钮上加 200m 距离校验（用 Amap 计算）。
- 核心操作按钮统一 `backdrop-blur` + `z-50`（沿用 `SafeAreaBottomLayout`）。

## 技术细节

| 模块 | 文件 |
|------|------|
| 三步注册向导 | 改写 `src/pages/AuthPage.tsx` |
| 角色 hook | 新建 `src/hooks/useUserRoles.ts` |
| 主题切换 | `src/index.css` + `src/App.tsx` 包装 |
| 动态底栏 | 改写 `src/components/BottomNav.tsx`，抽出 `src/config/navTabs.ts` |
| 工作台 | 新建 `src/pages/WorkerDashboardPage.tsx` + 路由 |
| 审核中台 | 新建 `src/pages/AdminReviewPage.tsx` + 路由（admin 守卫） |
| 数据库 | migration 扩展 `app_role` 枚举 + 申请表加 `role_requested` |
| 个人中心宫格 | 调整 `src/pages/ProfilePage.tsx` 顶部块 |

完成后用户可在一处注册时选择身份，登录后看到完全不同的导航/配色/工作台，平台方通过 `/admin/review` 一键完成所有人工审核。
