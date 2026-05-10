## 目标

精简首页与「我的」中和身份切换重复的入驻入口；统一社区/商城页面边距；隐藏社区顶部模块加载状态；修复寻宠雷达「扩散走失启事」弹窗显示；让司机在接到的订单详情中能查看乘客宠物档案。

## 改动清单

### 1. 首页 — 删除底部「想成为平台一员」板块
**文件**：`src/pages/Index.tsx`
- 删除 `<footer aria-label="加入我们">` 整段（约第 330–351 行，含「宠托师招募 / 商家入驻」按钮和说明文案），入驻统一交给 `RoleSwitcher` + `/roles`。

### 2. 「我的」页 — 删除两处和身份切换重复的入驻入口
**文件**：`src/pages/ProfilePage.tsx`
- 删除「申请入驻萌宠到家」按钮（`!isMerchant` 分支，约 508–524 行）。
- 删除「🚗 成为宠托师」按钮（约 525–540 行）。
- 保留：`isMerchant` 时的「商家中心」入口、`isAdmin` 时的「商家入驻审核」入口、「宠物档案管理」「历史订单」「公益足迹」。

### 3. 社区 / 商城 — 边距统一 + 隐藏模块状态
**文件**：`src/pages/CommunityPage.tsx`、`src/pages/ShopPage.tsx`
- 统一为 `max-w-lg mx-auto` 容器、内容区水平 padding 一律 `px-4`，去除少量子区块的 `px-5`/`px-3` 偏差，使两页左右边距视觉对齐。
- 隐藏社区顶部 `<ChunkStatusWidget />`（约 401 行）：用 `import.meta.env.DEV` 包裹，仅开发环境可见，正式用户看不到模块加载/重试状态条。

### 4. 寻宠雷达 — 修复「扩散走失启事」弹窗显示
**文件**：`src/components/ShareCardDialog.tsx`
- `<DialogContent>` 加 `max-h-[90vh] overflow-hidden flex flex-col`；卡片预览 + 操作按钮区域包一层 `overflow-y-auto`，避免在窄屏（用户当前 681px 高度）下卡片被裁、二维码或按钮看不见。
- `coverImage` 加 `loading="lazy"` 和 `onError`（失败则隐藏节点），防止图片加载失败时撑高留白。

### 5. 司机端 — 在订单详情查看乘客宠物档案（方案 b）
**文件**：`src/pages/OrderDetailPage.tsx`、`src/pages/TripTrackingPage.tsx`、（如需）`src/pages/PetProfilesPage.tsx`
- 在订单详情页：当前用户为司机（`activeRole === "driver"` 或 `order.driver_id === user.id`）且订单已派单时，显示「🐾 查看乘客宠物档案」按钮。
- 点击跳转到 `/pets?orderId={id}&readonly=1`（或在订单详情页内联展开 Drawer，二选一，默认跳转新页面更易实现）。
- `PetProfilesPage` 增加只读模式：识别 `?orderId=&readonly=1`，按 `orders.user_id` 拉取该乘客绑定到该订单的宠物（`order_pets` 关联表，如无关联则展示该乘客全部宠物），隐藏新增/编辑/删除操作，仅展示头像/品种/疫苗/过敏/特殊护理说明。
- 后端：通过 RLS 允许司机在 `orders.driver_id = auth.uid() AND order_status IN ('confirmed','in_progress')` 时 `select` 对应乘客的 `pets`。如已存在策略则复用；若缺失，本计划批准后再单独添加迁移（先确认现有 `pets` 表的 RLS 当前策略）。

不在底部导航中加「档案」，保留司机端原 NAV_TABS 不变。

## 不改动

- `RoleSwitcher.tsx`、`/roles` 跳转逻辑保持现状。
- `MerchantApplyPage` / `DriverApplyPage` / `SitterApplyPage` / `GroomerApplyPage` 路由保留（`/roles` 仍可跳转）。
- 已有测试 (`RoleGuard.test.tsx`、`RoleSwitchPage.test.tsx`、`WorkerDashboardPage.test.tsx`) 不受影响。
