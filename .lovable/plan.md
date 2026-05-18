## 问题定位

刚才你以「铲屎官」下了一单美容（`service_type='grooming'`），但护理师工作台/抢单大厅都看不到。原因有三处串不上：

```text
BookingPage  →  PaymentPage  →  orders 表          →  DriverHallPage (师傅大厅)
selectedService           service_type='grooming'      期望 service_type IN ('groom')
                          order_status='created'       期望 order_status='pending_accept'
                          provider_id 未传             期望 provider_id IS NULL ✓
```

1. **service_type 枚举不一致**：下单写入 `bath/grooming/health/walking/home/pickup`（来自 `SERVICE_TYPES`/`activeTab`），大厅只识别 `groom/walk/feed/pickup/delivery`。所有美容/上门单全部被过滤掉。
2. **支付成功后无人转为「待接单」**：`PaymentPage` 写入 `order_status='created'`，支付完成后通过 `mark_payment_succeeded` 走 `paid/confirmed`，**没有任何分支把服务类订单切到 `pending_accept`**，所以即使 service_type 对了大厅也查不到。
3. **`PaymentPage` 丢弃了上游字段**：`SimpleBookingPage` 已正确把 `provider_id` 放入 `orderData`，但 `PaymentPage.insert` 完全不读 `provider_id / driver_id / hotel_id`，指定了师傅也等于没指定。

数据库里最近 7 条订单的 `provider_id/driver_id/hotel_id` 全部为 NULL，且 `grooming` 订单状态停在 `confirmed` —— 与上面分析吻合。

## 修复方案

### 1. 统一 service_type（前端归一）
在 `src/config/services.ts` 增加 `SERVICE_TYPE_CANONICAL`：

```ts
// UI 标签 → 后端归一
export const SERVICE_TYPE_CANONICAL = {
  bath: 'groom', grooming: 'groom', health: 'groom',
  walking: 'walk', walk: 'walk',
  home: 'feed', feed: 'feed',
  pickup: 'pickup', delivery: 'delivery',
  hotel: 'hotel', shop: 'shop',
} as const;
```

- `BookingPage` 提交时把 `selectedService / activeTab / selectedTier` 经过该映射再放入 `orderData.service_type`，原始标签另存 `service_label`（已存在）用于展示。
- `SimpleBookingPage` 的 `svcType` 同样过一次映射。
- `DriverHallPage` / `WorkerDashboardPage` 的 `ROLE_SERVICES` / `SVC_LABEL` 与归一枚举对齐（已基本一致，复核一遍）。

### 2. 支付成功后自动转入「待接单」（数据库触发器）
新增 migration：

```sql
CREATE OR REPLACE FUNCTION public.orders_after_pay_to_hall()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.payment_status = 'paid'
     AND OLD.payment_status IS DISTINCT FROM 'paid'
     AND NEW.order_type = 'service'
     AND NEW.provider_id IS NULL
     AND NEW.driver_id IS NULL
     AND NEW.hotel_id IS NULL
     AND NEW.order_status IN ('created','confirmed','paid') THEN
    NEW.order_status := 'pending_accept';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_orders_after_pay_to_hall
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_after_pay_to_hall();
```

并对历史已支付 NULL provider 的服务单做一次性 backfill（仅服务类）。

### 3. PaymentPage 透传指派字段
`insert` 时补：

```ts
provider_id: orderData.provider_id ?? null,
driver_id:   orderData.driver_id   ?? null,
hotel_id:    orderData.hotel_id    ?? null,
```

并在 `orderData` 类型里补这 3 个可选字段。这样：
- 用户在 `SimpleBookingPage` 选定具体师傅 → 订单直接指派，进入该师傅的工作台；
- 未指定 → 进入对应角色的抢单大厅。

### 4. 实时通知接单方
为 `orders` 表新增 `AFTER UPDATE` 触发器：当 `order_status` 变为 `pending_accept` 且未指派时，向具备对应 `app_role` 的用户广播一条 `notifications` 记录（基于 `service_type → role` 映射：groom→groomer、walk/feed→sitter、pickup/delivery→driver、hotel→hotel_owner）。挂在已有 `notifications` 表 + Realtime（`NotificationBell` 已订阅）。

### 5. 端到端连通测试（E2E + SQL）
新增 `e2e/cross-role-routing.spec.ts` 与 `supabase/tests/order_routing.sql`，覆盖矩阵：

```text
下单角色  服务/类型           期望面板
user     groom(bath/美容)    groomer 抢单大厅 + 接单后工作台
user     walk / feed         sitter 抢单大厅
user     pickup / delivery   driver 抢单大厅 (已有，回归)
user     hotel               hotel_owner /merchant/hotel 看到入住单
user     shop 商品            merchant 后台 MerchantOrders
```

每个场景断言：
- `orders` 行 `service_type` 已归一；
- 付款后 `order_status='pending_accept'` 且对应大厅查询命中；
- 接单后 `provider_id` 写入、原下单用户的订单详情页状态同步；
- `notifications` 表为对应角色生成消息。

## 改动文件

- 新增：`supabase/migrations/*_order_routing.sql`、`e2e/cross-role-routing.spec.ts`、`supabase/tests/order_routing.sql`
- 修改：`src/config/services.ts`、`src/pages/BookingPage.tsx`、`src/pages/SimpleBookingPage.tsx`、`src/pages/PaymentPage.tsx`、`src/pages/DriverHallPage.tsx`（如需对齐枚举/标签）、`src/integrations/supabase/types.ts`（迁移后自动）

## 风险与回滚

- 触发器使用 `BEFORE UPDATE`，不会阻塞支付主流程；失败回滚仅影响状态字段，金额相关已有 escrow 逻辑不变。
- service_type 归一只在写入端做映射，读取端读到的是归一值；旧数据通过 backfill 一次性更新到归一枚举（同事务）。