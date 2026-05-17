# 计划：担保资金回滚 + 闪购库存联动

## 现状摘要（已核查）

| 现状 | 影响 |
|---|---|
| `trg_orders_auto_hold_escrow` 在上轮已绑定为 `AFTER`，但函数体用 `NEW.escrow_status:=...` 只在 `BEFORE` 时生效 | **担保从未真正锁定** |
| 函数仅在 `payment_status='paid'` 时触发；`cancel-order` edge function 却判断 `='succeeded'` | 状态值不一致，自动退款路径走不通 |
| `escrow_status` 缺少 `refunded` / `released_partial` 等终态 | 取消/退款后状态语义不明 |
| `flash_sales.stock` / `sold_count` **不参与下单**：当前 `PaymentPage` 直接 `insert orders`，不会扣减闪购库存，也不防超卖 | 售罄无法控制，可重复抢购 |
| `escrow_ledger` 表为空 | 历史付款无账本 |

## 目标

1. 用户取消、支付失败、退款成功时，**自动回滚** `escrow_status` → `refunded`，写 `escrow_ledger.action='refund'`，并回填可领提资金。
2. 闪购下单走**单一 RPC**：原子校验时间窗 + `FOR UPDATE` 扣 `stock` / 加 `sold_count` / 写 `orders`；任一失败整体回滚；取消/退款时自动回补库存。

## 详细方案

### 1. 修正 escrow trigger（BEFORE + 统一字段）

```sql
DROP TRIGGER trg_orders_auto_hold_escrow ON orders;
CREATE TRIGGER trg_orders_auto_hold_escrow
BEFORE INSERT OR UPDATE OF payment_status ON orders
FOR EACH ROW EXECUTE FUNCTION trg_orders_auto_hold_escrow();
```
（函数无需改，已用 `NEW.x:=`）

### 2. 新增 `escrow_status` 终态 + 回滚 RPC

```sql
ALTER TYPE ... -- escrow_status 是文本列，无需 enum
-- 允许值：none | held | released | refunded | failed
```

新增 `rollback_escrow(_order_id, _reason)` SECURITY DEFINER：
- 若 `escrow_status='held'` → 改 `refunded`，写 ledger `action='refund' amount=total_amount`
- 若 `escrow_status='none'` → 直接置 `failed`，写 ledger `action='cancel_unheld'`
- 通知用户

### 3. 接入取消 / 退款链路

| 触发点 | 接入方式 |
|---|---|
| `process_refund` (approve 成功) | 在更新 `orders.refund_status='refunded'` 后调用 `rollback_escrow` |
| edge `cancel-order` | 把判断 `='succeeded'` 修正为 `IN ('paid','succeeded')`；插完 refund 后调 `rollback_escrow` |
| edge `refund-payment`（渠道异步回调） | 渠道成功回调里调 `rollback_escrow` |

### 4. 闪购下单 RPC

新增 `create_flash_order(_flash_id uuid, _qty int, _shipping_address jsonb, _payment_method text)`：

```text
BEGIN
  SELECT * FROM flash_sales WHERE id=_flash_id FOR UPDATE;
  IF NOT is_active OR now() NOT BETWEEN starts_at AND ends_at
     THEN RETURN error 'flash_inactive';
  IF stock - sold_count < _qty THEN RETURN error 'sold_out';
  UPDATE flash_sales SET sold_count = sold_count + _qty;
  -- 同步扣商品 stock（FOR UPDATE）
  UPDATE products SET stock = stock - _qty, sales_count = sales_count + _qty
    WHERE id = product_id AND stock >= _qty
    RETURNING ... ;  -- 若 0 行 → 异常回滚
  INSERT INTO orders (..., order_type='product',
    total_amount = flash_price*_qty, 
    pet_snapshot = jsonb_build_object('flash_id', _flash_id))
    RETURNING id;
  RETURN order_id;
END;
```
- 用单条事务确保「闪购库存 + 商品库存 + 订单」三者原子。
- 售罄后下次查询 `flash_sales` 视图返回 `is_sold_out=true`，前端禁用按钮。

### 5. 闪购取消 / 退款回库

新增 `restore_flash_stock(_order_id uuid)`：
- 读 `pet_snapshot->>'flash_id'`，对应 `flash_sales` `sold_count -= qty`、`products.stock += qty`。
- 在 `rollback_escrow` 内部调用；也在 `process_refund` 退款成功分支调用。

### 6. 前端最小改动

- `FlashSaleSection.tsx` / `ProductDetailPage`：闪购按钮改为调 `supabase.rpc('create_flash_order',{...})`，把返回 `order_id` 推到 `PaymentPage`。
- `PaymentPage`：识别 `?flash=1` 跳过常规下单，直接对已有 `order_id` 发起支付。
- 售罄 UI：`stock - sold_count <= 0` 时按钮置灰显示「已抢光」。

### 7. 历史数据回填（一次性 SQL）

```sql
UPDATE orders SET escrow_status='held'
 WHERE payment_status='paid' AND escrow_status='none'
   AND order_type<>'product' AND order_status NOT IN ('cancelled','completed');
INSERT INTO escrow_ledger(...) SELECT ... FROM orders WHERE ...;
```

## 交付顺序

1. Migration A：修正 trigger 触发时机；新增 `rollback_escrow` + `restore_flash_stock` + `create_flash_order` RPC；历史回填。
2. Edge function 修正：`cancel-order` 字段名 + 调 `rollback_escrow`；`refund-payment` 渠道回调同改。
3. 前端：闪购按钮改走 RPC + 售罄禁用 + PaymentPage 兼容 `existing_order_id`。
4. 自检：单元 SQL 测试取消已付订单的资金回填路径；并发抢购 5 个并发只 1 个成功。

## 风险

- `pet_snapshot` 已被复用为宠物快照，再塞 `flash_id` 不冲突但建议新增 `orders.flash_sale_id` 字段更清晰（含在 Migration A 内）。
- 历史 6 条 `paid` 订单虽然都已 confirmed/cancelled，回填仍可能让财务报表多出 `held` → 立即 `released`，可接受。
- `create_flash_order` 不处理优惠券、积分；首版仅支持单一 SKU、单一数量。
