
# 闭环打通方案：消费者 ↔ 服务者 ↔ 商家 ↔ 平台

## 一、当前断点（已核查代码 + 数据库）

| 环节 | 现状 | 断点 |
|---|---|---|
| 下单 | `SimpleBookingPage` 写入 `provider_id` 字段 | **`orders` 表根本没有这一列**，所以「指定服务者」实际丢失 |
| 派单 | 只有 `driver_grab_order` RPC + `DriverHallPage` | 宠托师/护理师**没有接单大厅**，也没有 grab RPC |
| 工作台 | `WorkerDashboardPage` 全部按 `driver_id` 过滤 | 不区分 sitter/groomer/driver，所有角色共用一个字段 |
| 通知 | 新订单产生后没人推 | 服务者端永远看不到「有新单」 |
| 状态流 | 用户端只看到 created → paid，没有 accepted/on_the_way/serving/completed | 用户不知道服务者到没到 |
| 担保支付 | `release_escrow` 已建 | 但没和「服务完成 + 用户确认」串到同一时间线 UI 上 |
| 评价 | `groomer_ratings`/`order_reviews` 表都有 | 完成后没有强制弹出/入口提示 |
| 商家订单 | `MerchantOrders` 存在 | 与服务订单完全两套，互不引用 |

结论：四个角色（消费者 / 服务者 / 商家 / 平台）现在像四个孤岛，**核心字段缺失 + 没有统一的状态机 + 没有事件通知**。

---

## 二、统一订单状态机（核心）

把所有服务类订单（遛狗/喂宠/洗护/接送/酒店）拉到同一条线上：

```text
created ──pay──▶ paid ──auto──▶ pending_accept
                                      │
                              worker_grab_order
                                      ▼
                                  accepted ──checkin──▶ on_the_way
                                                              │
                                                       arrive_checkin
                                                              ▼
                                                          serving
                                                              │
                                                  complete_service_order
                                                              ▼
                                                   awaiting_confirm  ←(48h 自动确认)
                                                              │
                                                     release_escrow
                                                              ▼
                                                        completed ──▶ review
```

`escrow_status`: none → held（paid 时自动）→ released（确认后）→ refunded（取消时）

商品订单走另一条更短的线：`paid → shipped → delivered → completed`，但共用同一张 `orders` 表 + `order_type` 区分。

---

## 三、要做的事（按依赖顺序）

### Step 1｜补齐 schema（一次迁移搞定）

```sql
ALTER TABLE orders
  ADD COLUMN provider_id uuid,           -- 真正的服务者（替代用 driver_id 兼容多角色）
  ADD COLUMN provider_role app_role,     -- sitter / groomer / driver
  ADD COLUMN accepted_at timestamptz,
  ADD COLUMN started_at  timestamptz,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN confirmed_at timestamptz;
CREATE INDEX ON orders(provider_id) WHERE provider_id IS NOT NULL;
CREATE INDEX ON orders(order_status, service_type) WHERE provider_id IS NULL;
```

把 `order_status` 允许值扩展为：`created | paid | pending_accept | accepted | on_the_way | serving | awaiting_confirm | completed | cancelled`。

### Step 2｜RPC 三件套（数据库里加锁，防并发抢单）

- `worker_grab_order(_order_id)` —— 通用版接单，按当前用户角色校验，原子更新 `provider_id + accepted_at + order_status='accepted'`
- `worker_update_progress(_order_id, _to_status)` —— accepted→on_the_way→serving，要求是 provider 本人
- `user_confirm_complete(_order_id)` —— 用户确认完成，触发 `release_escrow` + 写 `confirmed_at`
- 增加 pg_cron / Edge Function 每小时跑：`awaiting_confirm` 超 48h 自动确认结算

### Step 3｜事件通知（让四端互相看见）

数据库 trigger：
- 订单进入 `pending_accept` → 给附近匹配角色的服务者 `notifications` 批量插入「附近有新单」
- 订单 `accepted` → 给下单用户推「{服务者} 已接单」
- 订单 `serving` → 推「服务进行中」+ 触发拉打卡照片
- 订单 `awaiting_confirm` → 推「请确认完成 / 48h 自动结算」
- `release_escrow` 成功 → 给服务者推「{金额} 已入账」

已开启的 Realtime 表只要加上 `notifications` 就能即时弹给四端。

### Step 4｜服务者大厅（统一入口）

把 `DriverHallPage` 升级成 `WorkerHallPage`：
- 顶部 tab 切换：我的角色（sitter / groomer / driver）
- 列表按角色过滤 `pending_accept` + `service_type` 匹配
- 抢单按钮 → `worker_grab_order`
- 接单后跳转 `/order/:id`，里面是「打卡 → 上传照片 → 完成」时间线

### Step 5｜消费者端时间线 + 担保支付卡

`OrderDetailPage` 加 `ServiceTimeline` 组件，按 `order_status` 高亮：
- 已支付 ✅ → 等待接单 ⏳ → {服务者头像 + 评分} 已接单 → 在途 → 服务中 → 待确认
- 「待确认」状态：大按钮「确认完成并结算」=`user_confirm_complete`，旁边小字「48h 后自动确认」
- 服务者打卡的 GPS + 照片直接显示在时间线上（已有 `ServiceCheckinChecklist`，只需查询接入）
- `EscrowStatusCard` 改为只在 `service` 类订单显示，商品订单隐藏

### Step 6｜评价闭环

- `completed` 状态下，用户端订单详情顶部 sticky 提示「30 秒评价赢 10 积分」
- 评价成功 → `award_love_points` + 更新服务者 `get_provider_stats` 缓存
- 7 天未评价 → 默认 5 星好评，避免数据空洞

### Step 7｜商家联动

- 商家订单详情里如果含服务类 SKU（例如美容套餐），自动派单到对应 groomer 池
- `merchant_appeals` 关联 `order_id` 后，平台审核台可直接看到担保金扣减/释放历史

### Step 8｜数据修正（一次性脚本）

- 把旧表里 `driver_id IS NOT NULL` 的非接送类订单回填到 `provider_id + provider_role`
- 把 `paid` 但 `provider_id IS NULL` 的服务订单批量置为 `pending_accept`

---

## 四、最小可上线切片（建议第一刀只做 Step 1–5）

1. 迁移 + RPC + 触发器（Step 1–3）
2. 服务者大厅（Step 4，复用 DriverHall 改名）
3. 消费者订单时间线 + 确认按钮（Step 5）

之后再补评价闭环和商家联动。

---

## 五、技术细节

```sql
-- 抢单原子操作示例
CREATE OR REPLACE FUNCTION worker_grab_order(_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _uid uuid := auth.uid(); _role app_role; _svc text;
BEGIN
  SELECT service_type INTO _svc FROM orders WHERE id=_order_id FOR UPDATE;
  _role := CASE _svc
    WHEN 'groom' THEN 'groomer'::app_role
    WHEN 'pickup' THEN 'driver'::app_role
    ELSE 'sitter'::app_role END;
  IF NOT has_role(_uid, _role) THEN
    RETURN jsonb_build_object('ok',false,'error','role_mismatch'); END IF;
  UPDATE orders SET
    provider_id=_uid, provider_role=_role,
    accepted_at=now(), order_status='accepted'
  WHERE id=_order_id AND provider_id IS NULL AND order_status='pending_accept';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok',false,'error','already_taken'); END IF;
  INSERT INTO notifications(user_id,type,title,content,related_id)
    SELECT user_id,'order','服务者已接单','请等待服务者上门',_order_id::text
    FROM orders WHERE id=_order_id;
  RETURN jsonb_build_object('ok',true);
END $$;
```

确认方案后我会按 Step 1 → 5 顺序提交迁移 + 前端，每步都跑一遍 4 角色回归。

