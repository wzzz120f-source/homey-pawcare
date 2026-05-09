# 项目逻辑问题排查与完善计划

## 一、当前发现的核心逻辑问题

### 1. WorkerDashboardPage 全是硬编码占位
- "今日预计收入 ¥0.00"、待接单/进行中/已完成均写死为 0
- "今日待办"、"附近订单" 没有任何数据接入
- `groomerLevel` 写死为 `intermediate`，没有从 `user_roles` 读取
- 没有响应 `?tab=schedule|training|services|route` 等参数（导航栏点不同 Tab 跳转后页面无差异）

### 2. 角色导航与页面不一致
- `navTabs.ts` 为 sitter / groomer / driver 各自配置了 `/worker?tab=xxx`
- 但 `WorkerDashboardPage` 没用 `useSearchParams` 切视图，所有 Tab 落到同一个静态页面
- driver 角色没有自动跳转到 `TripTrackingPage` 当前任务的入口

### 3. 司机端任务流不闭环
- 司机角色没有"我的当前行程列表"页，只能从订单详情进入 `/track/:id`
- TripTracking 的里程结算只在前端估算，未写回 `orders.driver_settlement` 之类字段
- "车载环境拍照上传" 在 navTabs 中没有入口

### 4. 商家看板权限/边界
- `MerchantDashboard` 接收 `merchantId` props，但 `MerchantCenterPage` 是否在 merchant 角色用户没有店铺时给出"去申请"的引导需要核对
- 退款率计算依赖 `order_items` 与 `orders.status`，未确认是否过滤当前 merchant 的订单

### 5. 护理师端 AI 建议只在 dashboard
- HealthAssessmentForm 的评估结果没有保存到任何表，无法在订单详情或陪伴报告里复用
- 等级徽章 `groomerLevel` 没有持久化来源

### 6. 路由保护缺失
- `/admin/review`、`/merchant/admin`、`/worker` 没有在路由层校验角色，未登录或越权用户进入会看到空白或报错
- 仅在组件内部用 `useUserRoles` 判断，体验不够友好（应有重定向 + Toast）

### 7. 独立运行能力欠缺
- README/SETUP 没有"一键启动"脚本说明
- `.env.example` 缺少 AMap key 等必填项的注释
- 没有种子数据脚本（新部署看不到任何商品/技师演示数据）
- 没有健康检查页（部署后无法快速判断后端是否就绪）

---

## 二、本次计划完成的改造（分 4 步）

### Step 1：让 WorkerDashboard 真正驱动数据
- 用 `useSearchParams` 读 `tab` 参数，渲染 4 个子视图：
  - `overview`（默认）：今日收入 + 待办
  - `schedule`：排班日历（sitter）
  - `services` / `route` / `training`：对应内容卡片
- 接入数据：
  - 收入：`orders.total_amount` where `worker_id = uid && completed && date = today`
  - 待办：`orders` where `worker_id = uid && status in (confirmed,in_progress)`
- groomerLevel 从 `user_roles` 表新增 `metadata.level` 字段读取（若无则 intermediate）

### Step 2：补全角色路由保护与跳转
- 新建 `src/components/RoleGuard.tsx`：传入 `allow: AppRole[]`，未授权时 toast + 重定向
- 包裹 `/admin/review`（admin）、`/merchant/admin`（admin）、`/worker`（sitter/groomer/driver）
- driver 进入 `/worker` 时若有进行中行程，给出"继续行程"快捷卡

### Step 3：司机里程结算落库
- 在 `orders` 表加 `driver_distance_km`、`driver_fare` 字段（migration）
- TripTracking 在 stage→`delivered` 时写回该订单
- MerchantDashboard / 个人收入卡读取此字段

### Step 4：可独立运行能力
- `.env.example` 完善注释（VITE_SUPABASE_URL / KEY / AMAP_JS_KEY）
- 新增 `docs/RUN_LOCAL.md`：本地启动 + Cloud 部署 + 必要 secrets 列表
- 新增 `supabase/seed.sql`：插入演示用 categories / products / technicians / banner，方便首次部署即可看到内容
- 在 `/` 顶部加上"演示数据"标识（仅当数据来自 seed 时）

---

## 三、技术细节（供参考）

```text
路由保护结构
<Route path="/worker" element={
  <RoleGuard allow={['sitter','groomer','driver']}>
    <WorkerDashboardPage />
  </RoleGuard>
} />
```

```text
WorkerDashboardPage tab 切换
const [sp] = useSearchParams();
const tab = sp.get('tab') ?? 'overview';
{tab === 'overview' && <OverviewSection />}
{tab === 'schedule' && <ScheduleSection />}
...
```

```sql
-- Step 3 migration（示意）
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS driver_distance_km numeric,
  ADD COLUMN IF NOT EXISTS driver_fare numeric;
```

---

## 四、不在本次范围
- UI 主题/色彩调整（已在前几轮完成）
- 金额 tabular-nums 校验（已在前几轮完成）
- 陪伴报告 RLS（已在前几轮完成）

实施时如某一步发现额外阻塞（如缺字段、缺 RLS），会在该步内顺手补上并在回复中说明。
