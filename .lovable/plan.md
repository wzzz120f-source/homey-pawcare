
# 商业模块精细化补全方案

围绕用户提出的 8 个业务点，按"数据→后端→UI"三层补齐，复用已有的 `orders / trip_tracking / commission_settings / provider_balances / Amap` 基础设施。

---

## 1. 宠物接送（司机模块）

### 司机端「接单大厅」`/worker?tab=hall`
- 拉取 `orders` where `driver_id IS NULL AND service_type IN ('pickup','delivery') AND order_status='pending'`。
- 卡片字段：起止地址、距离（Amap 路径规划，缓存到本地）、预计行程时长、`driver_fare` 净收益（扣除 `commission_settings.driver` 后的 net）。
- 「一键抢单」RPC `driver_grab_order(_order_id)`：原子 update + 触发器校验仅一名司机。

### 宠主端「实时位置地图」(`TripTrackingPage`)
- 已存在 `trip_tracking.driver_lat/lng + Realtime`，但目前仅展示文字。新增 `<DriverLiveMap />`（Amap JS Map），订阅 Realtime 推送的经纬度更新司机 marker 平滑插值；展示路线、ETA、刷新时间。
- 司机端在路上每 15s 调用 `update_trip_tracking` 上报浏览器 `geolocation`。

## 2. 上门喂养 / 洗护：硬性打卡相机

### 数据
- 新表 `service_checkins(id, order_id, user_id, action_key, photo_url, lat, lng, exif_at, created_at)`。
- `action_key` 枚举：`feed_food / clean_litter / brush / bath_before / bath_after / play / leave`。
- 配置 `SERVICE_CHECKLISTS: Record<service_type, action_key[]>`。

### 强制流程
- 服务者面板 `<ServiceCheckinChecklist />`：按清单逐项拍照（`<MediaPicker capture="environment">`），上传后画 EXIF 时间 + GPS 文字水印（canvas 合成）后再写入 `service-checkins` 桶。
- RPC `complete_service_order(_order_id)` 校验清单全部满足，否则返回 `error: 'checkin_incomplete'`，前端结单按钮禁用并提示缺项。
- 宠主 `OrderDetailPage` 新增「实时动态」时间线，订阅 `service_checkins` Realtime。

## 3. 宠物酒店

### 修复结账/取消按钮丢失
- 现因房型选中后某条件渲染遮挡 BottomCta；改为 `<BottomCta>` 始终渲染，按 `selectedRoom && selectedPet` 切换 disabled 状态。

### 房型 + 入住宠物档案
- 新表 `hotel_rooms(id, hotel_id, type, name, capacity, base_price, amenities[], image_url, stock)` 替代当前硬编码 `ROOM_TYPES`。
- UI：房型卡片网格 → 选择 → 弹出宠物多选（`pets` 表，限 capacity 内）→ 入离日期 → 自动算价 `nights * base_price * pets.length` → 进入 PaymentPage。

## 4. 独立商城收货地址

### 新表 `shipping_addresses`
```
id, user_id, recipient, phone, province, city, district, detail,
postal_code, is_default, created_at, updated_at
```
- RLS：仅本人 CRUD。触发器保证同用户仅一条 `is_default=true`。

### UI
- `/profile/addresses`：地址簿增删改默认。
- 商品 SKU 类型 `shippable=true` 时，`PaymentPage` 顶部出现「选择收货地址」抽屉；下单将 `shipping_address_snapshot jsonb` 写入 `orders`（避免后续地址变更影响历史单）。

## 5. 钱包系统：双入口

### A. 宠主钱包 `/wallet`
- 新表 `user_wallets(user_id, balance, frozen)` + `wallet_transactions(user_id, type, amount, related_order_id, ...)`。
- 充值（接入已存在的微信/支付宝 PaymentPage），余额支付订单，退款回退。
- 页签：余额 / 充值记录 / 消费记录。

### B. 服务商收益 `/worker/earnings`
- 复用 `provider_balances` + `earning_transactions` + `withdrawal_requests`（已存在）。
- 模块：当前可用余额、冻结中、累计提现、本月佣金收入、按订单的明细列表、「去提现」入口（已有 `/worker/withdraw`）。

## 6. IM 即时通讯（丰富版）

### 数据
- 沿用 `chat_conversations` 增列 `peer_id, order_id, last_message_at, unread_user, unread_peer`。
- 扩展 `chat_messages.message_type`: `text|image|location|voice|system`，新增 `media_url, duration_sec, lat, lng`。
- 触发器：插消息 → 更新会话 last_message_at + 自增对方 unread。
- Realtime publication 加入两表。

### 功能
- 会话列表 `/messages` + 详情 `/messages/:id`。
- 文本（敏感词过滤：调用 edge function `moderate-text`，本地维护 `sensitive_words` 列表 + AI 兜底）。
- 图片（复用 community-media 桶）、语音录制（MediaRecorder 上传 webm，新增 `chat-media` 桶）。
- 高德定位选点（POI 选择器）→ 卡片消息。
- 拨号：基于平台中转的"虚拟号"——edge function `voice-dial-init` 返回临时号码（MVP 直接返回对方虚拟号；真实电信侧后续接入）。
- 已读回执 + 未读数。
- 入口：`OrderDetailPage`、`TripTrackingPage`、`WorkerDashboard` 订单卡片均插入「联系对方」按钮。

## 7. 评价系统细化

- 司机评价 `trip_ratings`（已含 safety / pet_care / punctuality / communication）：补充 quick tags `["驾驶平稳","急刹少","空调适宜","上下车温柔"]`，并把 safety_rating 文案改为「驾驶稳不稳」。
- 新增 `groomer_ratings(order_id, user_id, technique, gentleness, pet_stress_level(1-5 反向), env_clean, tags[], content)`，列在洗护订单完成后；`pet_stress_level` 1=很放松 5=很紧张，UI 用表情滑块。
- 入口：`OrderDetailPage` 完成态根据 `service_type` 跳转对应评价页。

---

## 技术细节 / 实施顺序

```text
Phase 1  数据迁移
  ├─ shipping_addresses + 默认地址触发器
  ├─ hotel_rooms + 种子数据
  ├─ service_checkins + 完成校验 RPC
  ├─ user_wallets / wallet_transactions
  ├─ chat_* 扩列 + 触发器 + Realtime
  └─ groomer_ratings + RLS

Phase 2  司机/服务模块
  ├─ DriverLiveMap (Amap)
  ├─ HallTab + driver_grab_order RPC
  └─ ServiceCheckinChecklist + 水印工具 lib/photoStamp.ts

Phase 3  酒店修复 + 商城地址
  ├─ HotelDetailPage 重构 BottomCta 渲染
  └─ AddressBookPage + PaymentPage 接入

Phase 4  钱包
  ├─ /wallet 宠主页
  └─ /worker/earnings 收益页

Phase 5  IM
  ├─ MessagesListPage + ChatRoomPage
  ├─ VoiceRecorder + LocationPicker
  ├─ moderate-text edge function
  └─ 各订单页"联系对方"入口

Phase 6  评价细化
  ├─ TripRatingPage 文案 + tags
  └─ GroomerRatingPage 新建
```

### 关键约定
- 所有新表均 `ALTER TABLE ... ENABLE RLS`；写策略遵循「本人/订单参与方/admin」三类。
- 照片水印走前端 canvas，保证 EXIF 时间 ≥ now()-10min（防旧图）；服务端在 RPC 内再二次校验 `exif_at`。
- IM 所有富媒体走对应 public 桶，但敏感语音/位置不存原始定位以外字段。
- 单元测试：`driver_grab_order` 并发抢单、`complete_service_order` checklist 校验、地址默认唯一性、IM 未读数累加。

### 暂不做
- 真实电信级"虚拟号回拨"——MVP 仅展示号码与拨号 deeplink，真实接入后续。
- 钱包提现到银行——继续走已有 `withdrawal_requests` 流程。
