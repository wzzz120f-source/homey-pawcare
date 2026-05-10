# 实施计划（已根据用户答复定稿）

## PR-1 救助投喂明细列表（滚动加载）

- 新增 RPC `get_rescue_feed_list(_story_id uuid, _limit int default 20, _before timestamptz default null)`
  - 返回：`id, user_id, username, avatar_url, amount, message, paid_at`
  - `WHERE status='paid' AND (_before IS NULL OR paid_at < _before) ORDER BY paid_at DESC LIMIT _limit`
- `RescueFeedDialog.tsx`
  - 加 Tabs：「投喂榜 / 投喂明细」
  - 明细区使用 `ScrollArea` + IntersectionObserver 哨兵加载下一页
  - 状态：`items[]`、`cursor`（上一页最后一条 `paid_at`）、`hasMore`、`loading`
  - 行：头像 + 用户名 + 时间 + 留言 + 金额

## PR-2 救助者身份核查（强制）+ 提现 KYC（人工审核）

### 2A 救助故事身份强制审核
- `rescue_stories` 增加：
  - `verify_status text default 'pending'`（`pending|verified|rejected`）
  - `verify_note text`、`real_name text`、`id_card_last4 text`、`proof_urls text[]`
  - `verified_by uuid`、`verified_at timestamptz`
- 兼容旧数据：迁移时把现有 active 故事置为 `verified`
- **强制规则**：仅 `verify_status='verified'` 的故事允许收款 —— `feed_rescue_with_balance` 增加校验 `verify_status='verified'`，否则返回 `story_not_verified`
- `GuardianChannel`：仅展示已 verified 故事；自己提交的未通过故事显示「审核中/被驳回」状态
- 发布救助流程：必填实名 + 证件号末 4 位 + 上传至少 1 张证据图（医院单/伤情照），创建后状态 `pending`
- Admin 审核：
  - 新增 RPC `admin_review_rescue_story(_id, _approve bool, _note text)`（admin 才能调）
  - 在 `AdminApplicationsPage` 加「救助审核」标签

### 2B 提现 KYC（人工审核 + 强制）
- 新表 `rescue_kyc`
  - `user_id pk, status text('pending'|'approved'|'rejected'|'none'), real_name, id_card_no_hash, id_card_front_url, id_card_back_url, hold_id_url, bank_account_name, bank_account_no, bank_name, submitted_at, reviewed_at, reviewed_by, review_note`
  - RLS：本人可读写自己的；admin 可读写全部
- 新页 `src/pages/RescueKycPage.tsx`（路由 `/rescue-kyc`）：实名 + 双面证件 + 手持证件 + 银行卡表单
- RPC `submit_rescue_kyc(...)`：写入或更新为 `pending`
- RPC `admin_review_rescue_kyc(_uid, _approve, _note)`：admin 通过/驳回
- 提现校验：在 `request_withdrawal`（或 WithdrawPage 提交前）增加：
  - 若用户钱包流水中存在 `feed_in`，强制要求 `rescue_kyc.status='approved'`
  - 否则返回 `kyc_required`
- 风控扩展（`admin_approve_withdrawal`）：
  - `feed_funds_no_kyc`
  - `payout_name_mismatch`（提现账户姓名 vs KYC 实名）

### 2C `/wallet` 展示
- `WalletPage` 新增「救助资质卡」：
  - Badge：未提交 / 审核中 / 已通过 / 已驳回 + 驳回原因
  - CTA：去认证 / 重新提交 → `/rescue-kyc`
- 提现历史列表新增「审核状态/原因」一列（pending/flagged/rejected/paid + risk_flags 中文化）

## PR-3 社区动态商品挂载卡 → 详情 → 下单/支付

- 现有数据：之前 PR-B 设计的 `post_product_links(post_id, product_id)`
  - 若未建表：新建 + RLS（任何人可读，作者可写自己的 post 关联）
- 在发帖 `MediaPicker` 流程或 `PostDetailPage` 编辑面板中加「关联商城商品」选择器（搜索/最近浏览）
- Feed 卡 / `PostDetailPage` 渲染商品挂载条（缩略图 + 名称 + 价格 + 「去购买」）
- 点击 → `navigate('/product/:id')`
- 在 `ProductDetailPage` 回归：
  - 未登录 → `/auth`
  - SKU + 数量 + 收货地址 → 创建订单 → `/payment/:orderId`
  - `/payment/:orderId` 调 `create-payment`（wallet/wechat/alipay/stripe/mock）
  - 成功 → `/payment/result/:orderId` → `OrderHistoryPage`
- 点击商品卡时埋点 `trackBrowsing(productId)`，便于推荐

## 技术细节速览

```text
迁移
├─ rescue_stories  + 7 个审核字段；旧 active → verified
├─ rescue_kyc      新表 + RLS
├─ post_product_links（若不存在）+ RLS
└─ RPC
   ├─ get_rescue_feed_list
   ├─ submit_rescue_kyc
   ├─ admin_review_rescue_kyc
   ├─ admin_review_rescue_story
   ├─ feed_rescue_with_balance      —— 加 verified 校验
   └─ request_withdrawal            —— 加 KYC 校验

前端新增
├─ src/pages/RescueKycPage.tsx                    (路由 /rescue-kyc)
├─ src/components/wallet/RescueKycStatusCard.tsx
├─ src/components/community/PostProductCard.tsx  （动态商品挂载卡）
└─ src/components/community/ProductPicker.tsx    （发帖时选商品）

前端修改
├─ RescueFeedDialog        Tabs（榜单 / 明细 + 滚动加载）
├─ GuardianChannel         仅展示 verified；增加发布时实名/证据上传
├─ WalletPage              KYC 卡 + 提现状态列
├─ WithdrawPage            拦截无 KYC 提现 → 跳 /rescue-kyc
├─ AdminApplicationsPage   增加「救助审核」「KYC 审核」两个标签
├─ PostDetailPage / Feed   渲染 PostProductCard，点击跳 /product/:id
└─ ProductDetailPage       登录态 + SKU/库存/地址校验回归
```

## 执行顺序

PR-1（小，验证投喂明细 UI） → PR-2A（救助审核，影响收款） → PR-2B/2C（KYC + 钱包展示） → PR-3（商品挂载 + 下单链路）。

每个 PR 落库后立即在预览验证，再进入下一个。
