# 计划：担保资金透明化 + 部分退款 + 实时通知 + 一致性测试

## 目标拆解

1. **订单详情页**展示担保资金状态与 `escrow_ledger` 时间轴
2. **部分退款 `released_partial`**：按比例回滚担保金 + 闪购库存 + 账本可追踪
3. **取消/退款**触发实时通知（含原因 + 预计到账时间）
4. **闪购端到端 + 数据库一致性**测试套件

---

## 1. 订单详情页 · 担保资金可视化

### 数据
- 复用现有 `escrow_ledger`：`order_id, action(hold|release|refund|partial_refund), amount, note, created_at`
- 新增视图（可选）`v_order_escrow_summary`：聚合 hold 总额 / refund 总额 / release 总额 / 余额

### UI（`src/components/EscrowStatusCard.tsx` 扩展）
- 顶部 4 态徽章：`held / released / released_partial / refunded / failed`，配色和图标
- 金额行：原担保 ¥X · 已退 ¥Y · 已结算 ¥Z · 余 ¥W
- 折叠「资金流水」时间轴：每笔 ledger 一行（时间 + 动作中文 + 金额 + note）
- `OrderDetailPage.tsx` 已挂载本组件，无需新增挂点

---

## 2. 部分退款 `released_partial`

### 数据库（Migration A）

新增 RPC `partial_refund(_order_id uuid, _amount numeric, _reason text)`：
- `FOR UPDATE` 订单行，校验 `escrow_status='held'` 且 `_amount < total_amount`
- 计算比例 `ratio = _amount / total_amount`
- 写 `escrow_ledger(action='partial_refund', amount=_amount, note=_reason)`
- 更新 `orders.escrow_status='released_partial'`、`refund_amount`、`refund_status='partial'`
- **闪购按比例回库**：若 `flash_sale_id` 存在，调 `restore_flash_stock_partial(_order_id, ratio)`
  - 该函数将 `qty * ratio` 向下取整回补到 `flash_sales.sold_count` 与 `products.stock`（最少回 1 件防止 0 件归还）
- 触发用户/服务者通知
- 返回 `{success, remaining_held, refunded_total}`

支付渠道层（钱包/微信/支付宝）退款逻辑沿用 `process_refund`/`refund-payment`，回调成功后调 `partial_refund` 而非 `rollback_escrow` 当 `_amount < total`。

### 前端
- `AdminRefundsPage` / `OrderDetailPage` 新增「部分退款」按钮（admin 或服务者发起场景），弹窗输入金额 + 原因
- 售后入口（用户侧）：暂不开放部分退款 UI，仅 admin 审批通过后入账（后续再扩）

---

## 3. 实时通知（取消 / 退款 / 部分退款 / 回填）

### 数据库
- 在 `rollback_escrow` / `partial_refund` 内统一插入 `notifications`：
  - `title`：`订单已取消` / `已收到退款` / `已收到部分退款`
  - `content`：含原因 + 「预计 ¥X 在 1-3 个工作日到账（钱包退款实时到账）」
  - `type='refund'`，`related_id=order_id`
- 钱包通道立即到账：`content` 显示「已退至钱包，余额 ¥new_balance」
- 第三方通道：根据 `payment_method` 显示「微信支付原路退回，预计 1-3 个工作日」

### 前端
- 已有 `NotificationBell` + Supabase Realtime 订阅 `notifications` 表，无需新代码
- 仅需确保 `notifications` 已在 `supabase_realtime` publication 中（核查后如缺则 Migration 补）

---

## 4. 闪购一致性测试

### 4.1 数据库层（pgTAP 风格 SQL 测试，存 `supabase/tests/flash_consistency.sql`）
作为 Migration 附带的一次性自检脚本（手动跑），覆盖：
- **T1 并发抢购**：库存 3 件，模拟 5 次 `create_flash_order(qty=1)`，断言只成功 3，`sold_count=3`，`products.stock` 同步 -3
- **T2 售罄拒绝**：再调 1 次返回 `sold_out`
- **T3 取消回库**：取消 1 单 → `sold_count=2`，`stock` +1，ledger 有 `refund` 行
- **T4 部分退款**：2 件订单部分退 50% → `released_partial`，闪购回 1 件，ledger 有 `partial_refund`
- **T5 退款失败回滚**：模拟 `rollback_escrow` 失败 → 订单状态不变（用 savepoint）

### 4.2 E2E 测试（Playwright，`e2e/flash-sale-flow.spec.ts`）
- 登录 → 进入闪购 → 点击「立即抢」→ 进入支付页 → 钱包支付 → 结果页 → 订单详情看到 `held` + ledger 1 行
- 用户取消订单 → 详情页 `refunded` + ledger 2 行 + 通知出现
- 售罄 UI 验证：mock RPC 返回 `sold_out` 时按钮禁用为「已抢光」

### 4.3 单元测试（Vitest）
- `FlashSaleSection` 售罄态渲染、抢购成功跳转
- `EscrowStatusCard` 各状态分支快照

---

## 交付顺序

1. **Migration A**：`partial_refund` RPC + `restore_flash_stock_partial` + 通知文案统一 + realtime publication 补齐
2. **前端**：`EscrowStatusCard` 扩展（流水时间轴 + 4 态徽章）
3. **Admin 部分退款入口**：`AdminRefundsPage` 增加金额输入
4. **退款链路接入**：`refund-payment` edge function 区分全额/部分
5. **测试**：SQL 一致性脚本 + Playwright E2E + Vitest 单元

---

## 技术细节

- `restore_flash_stock_partial` 取整规则：`floor(qty * ratio)`；若结果为 0 而 `_amount > 0`，强制回 1 件以保证账实一致
- `released_partial` 在 `EscrowStatusCard` 与现有 `released` 共享 UI 但金额行显示「已退 ¥X · 已结算 ¥Y」
- 通知 `预计到账时间` 通过 `payment_method` 映射：`wallet→实时`、`wechat/alipay→1-3 工作日`、`bank→3-7 工作日`
- E2E 测试需 seed：1 条进行中闪购 + 测试用户余额 ≥ 闪购价

## 风险

- 部分退款后再次部分退款：需累加 `refund_amount` 校验 `refund_amount + _amount <= total_amount`，超出返回 `over_refund`
- 闪购回库取整可能导致同一订单退 2 次 50% 时回 2 件而原本只买 2 件，需用 `order_items.quantity - 已退回件数` 做上限保护
- Realtime publication 若已包含 `notifications` 则 `ALTER PUBLICATION ADD TABLE` 会报错；用 `DO $$ ... pg_publication_tables ... $$` 守卫
