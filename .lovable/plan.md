## 目标
新建一个独立的「身份切换」页面，集中展示所有角色（铲屎官 / 宠托师 / 护理师 / 司机 / 商家 / 审核员），用户可在此一键切换身份并跳转到对应工作台。

## 实现步骤

### 1. 新建页面 `src/pages/RoleSwitchPage.tsx`
- 路由：`/roles`
- 顶部：标题「身份切换」+ 当前身份徽章 + 返回按钮
- 主体：5–6 张大卡片（按 availableRoles 渲染），每张包含：
  - 角色图标（Lucide）+ 中文名 + 主题色样条（暖橙 / 明黄 / 医用绿 / 天空蓝 / 深靛青）
  - 一句话职责说明（如"接收预约、查看宠物档案"）
  - 当前身份显示「使用中」标记；其它显示「切换至此身份 →」按钮
  - 用户未拥有的角色（除 user 外）显示为灰态，附带"申请成为宠托师 / 司机 / 商家"链接（跳到现有的 `/driver/apply`、`/merchant/apply` 等申请页）
- 切换逻辑复用 `useUserRoles().setActiveRole(r)` + 跳转到 `ROLE_META[r].home`
- 底部说明：当前以"演示模式"展示全部角色 / 仅显示已授权角色

### 2. 接入路由
- `src/App.tsx` 增加 `<Route path="/roles" element={<RoleSwitchPage />} />`，使用 `React.lazy` 与现有页面一致

### 3. 入口
- `BottomNav` 不动（避免占用一格 tab）
- 在 `ProfilePage` 顶部"我的"区域，把现有内联 `<RoleSwitcher />` 改为「身份切换」入口卡片，点击进 `/roles`
- 在 `Index.tsx` 顶部 `<RoleSwitcher />` 旁保留下拉，并新增一个小图标按钮 → `/roles`（方便不知道下拉的用户）
- `WorkerDashboardPage` 保留现有下拉（工作台快速切换）

### 4. 解决"看不到切换器"的根因
- 当前 `RoleSwitcher` 在 `availableRoles.length <= 1` 时返回 null，新页面 `/roles` 不受此限制——始终可访问，单角色用户也能看到全部角色入口（带申请引导）

## 涉及文件
- 新建：`src/pages/RoleSwitchPage.tsx`
- 修改：`src/App.tsx`、`src/pages/ProfilePage.tsx`、`src/pages/Index.tsx`

## 不在本次范围
- 不改数据库，不改 RLS
- 不改 BottomNav 配置
- 不改 RoleSwitcher 组件本身的下拉逻辑（仍可在 Worker / Profile / Index 使用）
