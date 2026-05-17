# 酒店双视角闭环方案

## 目标
- 用户侧：完成下单 → 入住 → 接收每日探视照片 → 退房确认 → 结算
- 酒店方：通过 `hotel_owner` 身份登录酒店后台，管理房间/订单/打卡/探视照片
- 探视照片只对该订单的用户与酒店方可见，杜绝越权

## 一、数据层（一次性 migration）

### 1. 角色与归属
- 新增 `app_role` 枚举值 `hotel_owner`
- 新表 `hotel_owners(user_id, hotel_id, role[owner|staff], created_at)`，唯一约束 `(user_id, hotel_id)`
- `is_hotel_owner(_user_id, _hotel_id)` SECURITY DEFINER 函数

### 2. 订单扩展
- 复用 `orders` 表，约定 `order_type='hotel'`
- 新增字段：`hotel_id uuid`、`room_id uuid`、`check_in date`、`check_out date`、`nights int`、`guest_pet_count int`
- 新增 `hotel_check_logs(order_id, hotel_id, action[checkin|daily|checkout], notes, created_by, created_at)` —— 仅用作时间线，不存图

### 3. 探视照片（隐私核心）
- 新表 `hotel_visit_photos`
  - `id, order_id, hotel_id, uploader_id, photo_url, caption, visibility[order_only|hotel_internal], taken_at, created_at`
  - 触发器禁止把 `visibility='hotel_internal'` 推送给用户
- RLS：
  - SELECT：`order.user_id = auth.uid()` 且 `visibility='order_only'`；或 `is_hotel_owner(auth.uid(), hotel_id)`；或 super admin
  - INSERT：`is_hotel_owner(auth.uid(), hotel_id)` 且订单 hotel_id 匹配
  - UPDATE/DELETE：仅上传者 24h 内 或 super admin
- 触发器 `trg_visit_photo_notify`：插入 `visibility='order_only'` 时给用户发 notification（type=`hotel_visit`）
- 存储桶 `hotel-visits`（私有），policy：路径 `${hotel_id}/${order_id}/...`；读权限同上

### 4. 状态机（酒店订单）
`created → paid → checked_in → in_stay → awaiting_confirm → completed`
- `hotel_checkin(_order_id)` SECURITY DEFINER：仅酒店方，order 进入 `checked_in/in_stay`，escrow 自动 `held`（复用既有触发器）
- `hotel_checkout(_order_id)` SECURITY DEFINER：仅酒店方，order 进入 `awaiting_confirm`，发通知"请确认退房"
- 用户 `user_confirm_complete(_order_id)`（已存在）释放 escrow
- 兜底 cron：`awaiting_confirm > 48h` 自动确认（复用既有任务）

### 5. RLS 补丁
- `orders` SELECT 增加策略：`is_hotel_owner(auth.uid(), hotel_id)` 可见自家酒店订单
- `orders` UPDATE 增加策略：酒店方仅能改 `order_status`（限定到上述状态）+ `notes`

## 二、用户侧（user-facing）

### 改动文件
- `src/pages/HotelDetailPage.tsx`：房型选择 → 入住/退房日期 → 必选爱宠 → 跳转 PaymentPage
- `src/pages/OrderDetailPage.tsx`：`order_type='hotel'` 时
  - 显示房型、入住/退房日期、酒店地址电话
  - "探视相册"区块：实时订阅 `hotel_visit_photos`，按天分组
  - 底部按钮：`awaiting_confirm` 时显示"确认退房并结算"
- 新增 `src/components/hotel/VisitPhotoGallery.tsx`：网格 + 大图查看 + 时间水印
- 顶部说明文案："照片仅你和酒店方可见，平台不会公开"

## 三、酒店方后台（hotel owner）

### 路由
- `/merchant/hotel`（已有 merchant 区，可平移结构）
  - `/merchant/hotel/dashboard`：今日入住/退房/在住数
  - `/merchant/hotel/rooms`：房型 CRUD（仅自家酒店）
  - `/merchant/hotel/orders`：订单列表 + tab（待入住/在住/待退房确认/已完成）
  - `/merchant/hotel/orders/:id`：入住打卡、上传每日探视、退房结算

### 新增组件
- `src/pages/merchant/HotelDashboard.tsx`
- `src/pages/merchant/HotelRoomManager.tsx`
- `src/pages/merchant/HotelOrderList.tsx`
- `src/pages/merchant/HotelOrderDetail.tsx`
  - "入住打卡"按钮 → `hotel_checkin`
  - "上传探视照片" MediaPicker（多图，必填可见性=order_only 默认）
  - "退房结算"按钮 → `hotel_checkout`

### 权限入口
- `RoleSwitcher` 增加 `hotel_owner` 视图选项
- `MerchantLayout` 顶部 tab 增加"酒店"入口（仅 `hotel_owner` 可见）

## 四、隐私加固
- 所有探视照片走私有桶，前端通过 `createSignedUrl(60)` 临时访问
- `hotel_visit_photos` 不进 realtime 公共频道，使用 `postgres_changes` 按 `order_id` 过滤
- 文件路径强制 `${hotel_id}/${order_id}/${uuid}.jpg`，Storage policy 校验前缀
- 上传时客户端打时间戳水印（不含位置）
- 删除：用户可对自己订单的探视照片标记"申诉" → super admin 处理；酒店方 24h 内可撤回

## 五、不在本轮范围
- 视频探视（占位入口，禁用）
- 健康证明 OCR
- 多语言酒店端（先 zh，沿用 i18n key）

## 六、交付顺序
1. migration（角色 + 字段 + 表 + RLS + 函数 + 存储桶）— 单次
2. 用户侧 HotelDetailPage 下单 + OrderDetailPage 酒店视图 + 探视相册
3. 酒店方后台 4 页 + RoleSwitcher 入口
4. QA 双视角走通：下单 → 酒店入住 → 上传探视（用户实时收到） → 酒店退房 → 用户确认 → escrow 释放

## 风险
- `hotel_owner` 角色加入后，`useUserRoles` override 列表要同步，避免上一轮"角色乱跳"复发
- 现有 `pet_hotels` 无 owner 字段；首批数据需 super admin 在 `/dev` 控制台手动绑定 `hotel_owners`（本轮顺手加一个绑定 UI）
