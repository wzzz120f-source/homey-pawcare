# 七项验收 / 修复 / 完善方案

## A. 验收类（1-5）— 编写自动化 E2E + 人工冒烟脚本

### 1. 手机号 OTP 登录（dev 模式）
- 验证 `send-sms-code` → 日志返回 `dev_code` → `verify-sms-code` → session 写入
- 增加 `AuthPage` 的「Dev 模式回填验证码」按钮（仅 super admin 或 `import.meta.env.DEV`）
- E2E：`e2e/otp-login.spec.ts`：填手机 → 触发发码 → 调用 edge fn 取 code → 输入 → 跳 `/`

### 2. 担保支付 held → released 全流程
- 真订单链路：下单(`create-payment`) → 支付成功(webhook/`query-payment`) → `escrow_status='held'` → 服务者接单/打卡/完成 → 用户确认(`user_confirm_complete`) → `released` + `escrow_ledger` 写入
- 缺口排查：确认 `create-payment` 在 `payment_status='paid'` 时是否写入 `escrow_status='held'`；若无则补 trigger
- E2E：用 dev 钱包(`wallet_pay`) 完成支付链路，断言 `escrow_ledger` 两条记录(hold/release)

### 3. 服务者 GPS 打卡 + 强制照片
- 现状：`ServiceCheckinChecklist` + `complete_service_order` 已校验 `_required` 完成度
- 加强：
  - `service_checkins` 增加 `latitude/longitude/photo_url NOT NULL`（trigger 校验）
  - 前端拍照走 `MediaPicker`（必填），定位走 `navigator.geolocation`，写入前校验距离用户地址 < 500m（容忍模式给提示）
  - `complete_service_order` 内补充：所有 checkin 必须含 photo_url

### 4. 商家发布商品 / 库存 / 闪购
- 验收：进入 `MerchantCenterPage` → 新建 product（含 SKU + stock）→ 创建 flash_sale → 首页 `FlashSaleSection` 出现 → 下单扣库存(原子 RPC)
- 缺口修复：
  - 若无 `decrement_stock` 原子函数，补 migration（`UPDATE ... WHERE stock >= qty RETURNING`）
  - 闪购库存进度条接 realtime
- E2E：商家路径 + 用户购买路径双脚本

### 5. 超管 /dev 控制台 + 维护模式
- 已有 `DevConsolePage` / `DevFlagsPage` / `MaintenanceGate`
- 验收：超管登录 → `/dev/flags` 切 `maintenance_mode=true` → 普通账号访问任意路由显示「系统维护中」→ 超管 + `/__dev` + `/auth` 仍可进
- 补：维护模式 banner 顶部显示「维护中（仅超管可见）」给超管自己

## B. Bug 修复（6）

### 6.1 下单失败
- 复现路径：`/booking` → 选服务 → 提交 → 失败
- 排查清单：
  - `orders` insert 是否被 RLS 拦截（user_id 必填）
  - `create-payment` edge fn 日志
  - 金额/服务字段校验
- 修复后加 `try/catch` 上报 `ErrorReport` 并 toast 真实原因

### 6.2 账号突然跳转其他角色
- 怀疑：`useUserRoles` 的 `override` localStorage 在 super admin 模式下可切换全部角色；某处误调 `setActiveRole`，或 `data-role` 触发路由重定向
- 排查：搜索所有 `setActiveRole(` 调用 / `localStorage.setItem('active_role_override')`
- 修复：
  - `RoleSwitcher` 增加切换确认 toast
  - 登出 / 登录时强制清空 override
  - 路由守卫不基于 override 跳转，只基于真实 `roles`

## C. 酒店板块闭环（7）

### 7.1 用户视角问题清单（待探索 `PetHotelPage` / `HotelDetailPage`）
- 检查项：
  - 搜索（高德 POI）→ 列表 → 详情 → 选房型 → 选日期 → 下单 → 支付 → 订单详情 → 入住打卡 → 退房 → 评价
  - 缺：入住/退房凭证、宠物健康证上传、紧急联系人、视频探视入口
- 完善：
  - `HotelDetailPage` 增加「房间实拍 + 探视视频直链」「在店宠物数量(可用余量)」
  - 下单时强制选「宠物档案」并展示健康证

### 7.2 酒店方视角闭环
- 现状缺：酒店方没有独立后台
- 补建（最小可用）：
  - 新增 `role = hotel_owner`（复用 `merchant_owners` + `merchant_type='hotel'`）
  - 新增 `/merchant/hotel` Tab（在 `MerchantCenterPage` 内）：
    - 房型管理（已有 `hotel_rooms`?需确认 schema）
    - 订单列表：今日入住 / 今日退房 / 在店
    - 接单按钮（`pending_accept` → `accepted`）
    - 入住打卡 / 每日探视照片上传 → 推送给用户
    - 退房结算 → 触发 `user_confirm_complete` 入口
  - 用户端订单详情显示酒店每日探视照片流（realtime）

### 7.3 数据 / 触发器补充
- `orders.order_type = 'hotel'` 路由
- 通知触发器扩展：酒店订单 `pending_accept` 通知 hotel_owner

## 交付物
1. 一份验收报告 `docs/ACCEPTANCE.md`（步骤 + 截图位）
2. 新增 / 修改 E2E：`otp-login`、`escrow-flow`、`checkin-required-photo`、`merchant-flash-sale`、`maintenance-mode`、`hotel-full-flow`
3. 修复 commit：下单失败、角色跳转
4. 酒店方后台 MVP + 相应 migration（房型校验 trigger / 通知 trigger）
5. 文档：`docs/HOTEL_FLOW.md`（双视角时序图）

## 技术要点
- 触发器统一 `SECURITY DEFINER` + `search_path=public`
- 所有金额/库存变更走 RPC，避免客户端竞态
- 强制上传：DB 层 trigger > 前端校验（前端可绕过）
- 角色权限：`hotel_owner` 用 `app_role` 枚举扩展需 migration

## 范围确认
任务量较大，建议拆分实施顺序：**6 → 1 → 5 → 3 → 2 → 4 → 7**
（先修 bug、再补登录与维护开关、再做服务/支付/商品，最后酒店闭环）

是否按此顺序分批执行？或优先完成其中某几项？
