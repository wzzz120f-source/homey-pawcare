## 支付系统完整化方案（已根据你的决策定稿）

### 决策摘要
- **Stripe**：开发用 Lovable 内建测试环境，上线再切换到用户自己的 Live Key（同一份代码、按 env 切换）
- **微信 / 支付宝**：先 Mock 通道，资质到位后只换 Edge Function 内部实现，前端无感
- **钱包余额**：默认置顶为首选支付方式，余额够则直接划扣
- **退款**：虚拟订单（上门服务/酒店/接送）服务商确认后自动原路退；实物订单走人工审核

---

### 一、数据库迁移（PR1）

新增表（均带 RLS）：

1. **payments** —— 支付单
   - `order_id, user_id, channel(stripe|wechat|alipay|wallet|mock), amount, currency, status(pending|succeeded|failed|refunded|closed), channel_txn_id, raw_payload jsonb, paid_at, expire_at, idempotency_key`
   - 唯一约束：`(order_id, channel)` 防重复下单
2. **payment_refunds** —— 退款单
   - `payment_id, amount, reason, refund_type(auto|manual), status(pending|approved|rejected|succeeded|failed), operator_id, channel_refund_id`
3. **wallet_accounts** —— 钱包账户（按 user + 角色分桶）
   - `user_id, role(owner|provider), balance, frozen, total_recharge, total_withdraw`
4. **wallet_transactions** —— 钱包流水
   - `account_id, type(recharge|consume|refund|earning|withdraw|freeze|unfreeze), amount, balance_after, related_payment_id, related_order_id, memo`

调整 **orders**：
- 新增 `payment_id, payment_expire_at, refund_status, is_physical(boolean)`

触发器：
- `payments.status → succeeded` 时：写宠主 `wallet_transactions(consume)` + 服务商 `wallet_transactions(earning, frozen)`
- 服务确认完成时：服务商 frozen → balance
- 退款 `succeeded` 时：宠主 `wallet_transactions(refund)`
- pg_cron 每分钟扫 `pending` 且过期 → `closed`

RLS：用户只看自己；服务商看自己订单；admin 全可见；webhook 用 service_role 绕过

---

### 二、Edge Functions（PR2 + PR3）

| 函数 | verify_jwt | 作用 |
|---|---|---|
| `create-payment` | true | 校验订单/金额/幂等，按渠道预下单，返回前端所需参数 |
| `query-payment` | true | 主动查询渠道，回写状态（webhook 兜底） |
| `payment-webhook-stripe` | false | 校验 Stripe 签名，回写 |
| `payment-webhook-wechat` | false | V3 平台证书签名校验 + AES-GCM 解密 |
| `payment-webhook-alipay` | false | RSA2 签名校验 |
| `refund-payment` | true | 自动/人工触发退款，按 channel 调对应 API |

环境变量（按渠道存在则启用，缺失则 Mock）：
- `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`（开发期 Lovable 内建注入；上线由用户在 Cloud Secrets 替换为 Live Key）
- `WECHAT_MCH_ID / WECHAT_APP_ID / WECHAT_API_V3_KEY / WECHAT_MCH_PRIVATE_KEY / WECHAT_MCH_SERIAL_NO`（缺失 → 走 Mock）
- `ALIPAY_APP_ID / ALIPAY_APP_PRIVATE_KEY / ALIPAY_PUBLIC_KEY`（缺失 → 走 Mock）

**Mock 模式**：`create-payment` 直接返回一个"模拟收银台"URL；前端展示"模拟支付（开发模式）"页，点"模拟支付成功/失败"按钮触发 `query-payment` 回写。上线只要在 Cloud Secrets 填入真实密钥即自动切真。

---

### 三、前端改造（PR2 + PR4）

1. **PaymentPage 重构**
   - 渠道顺序：钱包余额（够则置顶并预选）→ 微信 → 支付宝 → Stripe
   - 倒计时（基于 `payment_expire_at`，默认 15 分钟）
   - 防重复点击 + loading 锁 + 客户端幂等 key
   - 钱包余额不足时灰显并提示去充值

2. **新增 PaymentResultPage** `/payment/result/:orderId`
   - Realtime 订阅 `payments` 行 + 兜底每 3s 调 `query-payment`
   - 三态：成功 / 失败重试 / 处理中
   - "我已完成支付"手动查询按钮

3. **WalletPage**：接真实 `wallet_accounts` + `wallet_transactions`，宠主侧
4. **ProviderEarningsPage**：服务商侧，分"待结算 / 可提现 / 已提现"三桶
5. **WithdrawPage**：申请态先做（写 `wallet_transactions(withdraw, frozen)`），实际打款二期接微信/支付宝企业付款
6. **OrderDetailPage**：增加退款入口
   - 虚拟订单：服务商确认完成前可"申请退款"，服务商在 WorkerDashboard 一键同意 → 自动退
   - 实物订单：进入"客服审核"，admin 在 `/admin/refunds` 处理

7. **新增 admin 页**：`/admin/refunds` 退款审核列表

---

### 四、安全与稳健性

- **签名校验**：三家 webhook 必须严格校验签名后再写库
- **金额校验**：webhook 回写时对比 `payments.amount` 与渠道金额，不一致拒绝并告警
- **幂等**：`create-payment` 用 `idempotency_key` 唯一约束；webhook 用 `channel_txn_id` 唯一约束
- **超时关单**：pg_cron + 前端倒计时双保险
- **审计日志**：退款全程写 `admin_audit_logs`

---

### 五、实施顺序（3 个 PR）

```text
PR1  数据层      payments / refunds / wallet_* / 触发器 / RLS / pg_cron
PR2  Stripe + Mock + 钱包  create-payment + query-payment + stripe webhook
                          + 前端 PaymentPage 重构 + PaymentResultPage
                          + 钱包优先支付 + 钱包/收益页接真实数据
PR3  微信 + 支付宝 + 退款  两个 webhook（先 Mock，密钥到位即真）
                          + refund-payment + 退款审核后台
```

每个 PR 单独可上线、不阻塞前一个的体验。

---

### 六、需要你确认的最后一项

是否同意按 PR1 → PR2 → PR3 的顺序实施？  
确认后我会先执行 PR1（数据库迁移），通过审批再继续。
