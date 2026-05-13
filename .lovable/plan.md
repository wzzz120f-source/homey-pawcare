## 优化方向总览

四块优化：登录注册、游客模式、3 步下单、安全感（实名徽章+担保支付+GPS 留痕）。

---

## 一、登录 / 注册：双通道 + 一秒进入

### 1.1 改造 `AuthPage.tsx` 为 Tabs 双通道
- 顶部 Tab：「**手机号**（推荐）」/「邮箱」
- 手机号通道：手机号输入 + 「获取验证码」按钮（60 秒倒计时）+ 6 位验证码输入
- 邮箱通道：保留现有逻辑
- 注册场景手机号也可走验证码直登，自动建账户

### 1.2 验证码下发（开发/演示模式）
- 新增 edge function `send-sms-code`：
  - 开发模式：写入新表 `sms_codes(phone, code, expires_at)`，验证码固定 `1234` 或随机 6 位（toast 给开发者看）
  - 60 秒发送频率限制 + 每天每号 10 次
  - 预留接入真实短信网关接口（Twilio / 阿里云）的位置，后续仅替换发送实现
- 新增 edge function `verify-sms-code`：
  - 验证码正确 → 用 service_role 调 `auth.admin.createUser`（首次）或 `signInWithPassword`（已注册）
  - 手机号→email 映射策略：`{phone}@phone.local` 作为 Supabase Auth 的 email，固定派生密码（哈希存储，不暴露），实现"凭手机号一键登录"
  - 返回 access/refresh token，前端 `supabase.auth.setSession()` 写入本地

### 1.3 持久登录
- Supabase 客户端默认 `persistSession: true`（已是默认），明确补足 `autoRefreshToken: true` 与 `storage: localStorage`
- 在 `useAuth` 中确认 onAuthStateChange 重新挂起后能恢复会话（已 OK，文案中写明"7 天免登录"）

### 1.4 首次登录自动绑定身份
- 登录成功若 `user_roles` 为空，自动写入 `user` 角色（去掉强制选身份步骤，仅在用户主动申请时才走师傅/商家流程）

---

## 二、游客模式

### 2.1 路由调整（`App.tsx`）
- 把以下路由从 `RoleGuard` 包裹中拿出，改为公开访问：
  - `/`、`/shop`、`/community`、`/product/:id`、`/post/:id`、`/hotel/:id`、`/pet-hotel`、`/booking/:type`（仅展示，提交时拦截）
- 仍受保护的路由：`/profile`、`/orders`、`/wallet`、`/cart`、`/messages` 等私有页面

### 2.2 登录拦截 Hook
- 新增 `useRequireAuth()`：返回 `(action: () => void) => void`，未登录时弹出 `LoginRequiredDialog`（轻量 dialog，主按钮"手机号一键登录"，副按钮"去注册/邮箱"），登录后回到原动作
- 在以下行为接入：下单 / 收藏 / 评论 / 点赞 / 关注 / 加购物车 / 发帖
- 顶部右上角对游客显示「登录 / 注册」入口，登录后变成头像

---

## 三、3 步极简下单（仅遛狗 / 喂宠 / 洗护）

### 3.1 重构 `BookingPage.tsx` 为 Stepper
固定 3 步，顶部进度条 1 / 2 / 3：

```text
Step 1  选服务 + 服务者
  ├─ 已根据 :type 预选服务
  └─ 列表展示附近匹配的师傅（已审核徽章+评分），可"系统派单"

Step 2  选时间 + 地址
  ├─ 时间：今日/明日快捷 + 时间段
  └─ 地址：常用家庭地址默认勾选；新增地址折叠在下

Step 3  确认 + 支付
  ├─ 订单预览卡（服务、时间、地址、宠物、金额），每行右侧"修改"快速回到对应 Step
  └─ 立即支付 / 担保支付说明
```

### 3.2 实现要点
- 用单页 stepper（不切路由），`useReducer` 维护草稿；离开页面写 `localStorage`，回来自动恢复
- 自动填充：用户名、手机号（来自 profiles）、默认地址（shipping_addresses 的 is_default）、默认宠物（pets 的第一只）
- 接送 / 酒店保持现状不动

---

## 四、安全感模块

### 4.1 服务者主页徽章 + 评分（前端）
- 新增 `ProviderProfileCard` 组件，展示位置：
  - `TechnicianCard`、`TechnicianDetailDialog`、`DriverHallPage` 师傅信息区
- 内容：
  - 「已审核」徽章：依据 `driver_applications.status='approved'`
  - 「资质」徽章：从 `driver_applications.role_requested` + `pet_experience` 推导（"宠物护理证 / 驾龄 X 年"）
  - 评分 / 单数：聚合 `groomer_ratings` 与 `orders`（driver_id=该用户 & status=completed 计数）
- 新增 RPC `get_provider_stats(_uid uuid)`，一次返回 avg_rating / total_orders / approved_at

### 4.2 担保支付（Escrow）
**数据层（migration）**
- `orders` 增加：`escrow_status text default 'none'`（none / held / released / refunded）、`escrow_held_at`、`escrow_released_at`
- 新增表 `escrow_ledger(order_id, user_id, provider_id, amount, status, created_at, released_at)`，仅 admin/系统可写

**流程**
1. 用户支付成功 → 现有 `create-payment` / `wallet_pay` 之后调用新 RPC `escrow_hold(_order_id, _amount)` → orders.escrow_status='held'，金额暂不入服务者 `provider_balances`
2. 服务完成（complete_service_order 末尾）→ 状态转 `completed` 但 escrow 仍 held，等用户在订单详情点「确认完成」，或 7 天自动确认（cron 边缘函数 `escrow-auto-release`）
3. 用户确认 → RPC `escrow_release(_order_id)` → 写 `earning_transactions` + 增加 `provider_balances.available`，escrow_status='released'
4. 退款路径：`escrow_refund(_order_id)` 走原 `refund-payment` 流程

**UI**
- 订单详情页加担保支付状态条：「资金担保中 · 服务完成后将释放给服务者」/「资金已释放」
- 服务完成后出现「确认完成并释放资金」主按钮 + 倒计时提示

### 4.3 GPS 打卡 + 服务照片（强制）
- 现有 `service_checkins` + `ServiceCheckinPage` 已存在：
  - 改为：每个 action 必须包含 `lat/lng`（H5 geolocation；失败给重试和"无法获取定位"原因）
  - 必传字段：照片（喂宠/遛狗实拍），上传到 Storage `checkin-photos` bucket
  - `complete_service_order` 已校验缺失项；为 sitter 服务把 `_required` 默认设为 `['arrival_gps','during_photo','leave_gps']`
- 用户订单详情新增"服务时间线"卡片：按 checkins 顺序展示打卡时间、坐标、缩略图

### 4.4 评价真实可见
- 服务者主页（新增 `ProviderPublicPage` 路由 `/provider/:uid`）展示：
  - 头部：头像 + 已审核 / 资质徽章 + 评分均值 + 完成单数
  - 下方：最近 20 条 `groomer_ratings` 真实评价（含 tags、内容、用户头像/昵称）
- `TechnicianCard` 点击跳转该页

---

## 技术细节摘要

| 模块 | 新增/修改文件 | 数据库变更 |
|---|---|---|
| 手机登录 | `AuthPage.tsx` 重构、`PhoneAuthTab.tsx`、edge `send-sms-code` / `verify-sms-code` | 新表 `sms_codes` |
| 游客模式 | `App.tsx` 公开路由、`hooks/useRequireAuth.ts`、`LoginRequiredDialog.tsx` | 无 |
| 3 步下单 | `BookingPage.tsx` 重构、`booking/Step1Service.tsx` / `Step2TimeAddress.tsx` / `Step3Review.tsx` | 无 |
| 服务者徽章 | `ProviderBadges.tsx`、`ProviderPublicPage.tsx`、改 `TechnicianCard` | RPC `get_provider_stats` |
| 担保支付 | `useEscrow.ts`、订单详情新区块、edge `escrow-auto-release` | `orders` 加列 + 新表 `escrow_ledger` + RPC 三个 |
| GPS 留痕 | 改 `ServiceCheckinPage.tsx`、`ServiceTimeline.tsx` | `service_checkins` 加 NOT NULL（迁移温和：先加列，逐步生效） |

## 实施顺序（建议分两批）
1. **第一批（用户感知最强）**：手机号登录 + 游客模式 + 3 步下单
2. **第二批（信任建设）**：服务者徽章页 + 担保支付 + GPS 强制留痕

确认后我按第一批先开干。