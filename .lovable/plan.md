## 一、司机只读宠物档案页加固

**1. PetProfilesPage.tsx — 只读模式增强**
- 顶部新增 sticky 横幅：返回按钮（`navigate(-1)` + 兜底 `/worker`）+ 标题「乘客宠物档案（只读）」+ 订单号 + 乘客昵称 chip。
- 友好回退分三种：
  - 无 `orderId` → 空态卡：`🔒 此页面仅司机在订单中查看`，CTA「返回工作台」。
  - 订单不存在或 `driver_id ≠ user.id` → 空态卡：`无权查看该乘客资料`，CTA「查看我的订单」→ `/worker?tab=orders`。
  - 订单状态不在白名单 → 空态卡：`订单已结束/未开始，资料已收回`。
- 全局隐藏新增/编辑/删除/auto_share 开关；详情字段仅展示对司机有用的：名字/品种/体重/疫苗有效期/过敏/行为备注。

**2. RLS 扩展（migration）**
扩展 `pets` 的 `Drivers view pets of active orders` 策略，订单状态白名单加到：`accepted, confirmed, driver_assigned, pickup_pending, in_progress`（最终以现有 `order_status` 实际取值为准，迁移前用 `read_query` 核对 distinct 值）。

**3. 自动化测试 (`PetProfilesPage.readonly.test.tsx`)**
- 司机访问本订单 → 渲染只读字段、无编辑按钮。
- 司机访问他人订单（`driver_id` 不匹配）→ 渲染无权限空态。
- 缺 `orderId` → 渲染缺参空态。
- 订单状态为 `completed` → 渲染已结束空态（mock supabase 返回）。
- mock `@/integrations/supabase/client`，断言只读 UI 不出现 `data-testid="pet-edit-btn"` 等。

---

## 二、开发者（admin）后台全生命周期管理

判定方式：**复用现有 `admin` 角色**，登录后若 `isAdmin` 自动把默认 active role 设为 `admin`，并在 `/admin` 入口聚合下列模块。RoleSwitcher 行为不变。

### A. 路由与骨架
新增页面，统一 `RoleGuard allow={["admin"]}`：
- `/admin` — 总览仪表盘（卡片导航 + KPI）
- `/admin/applications` — 注册审核（合并 driver/groomer/sitter/merchant_applications，沿用现有表 + 新接 reject reason 输入框）
- `/admin/commission` — 抽成配置
- `/admin/revenue` — 收益看板
- `/admin/withdrawals` — 提现审批
- 服务端工作：所有列表/审批走 RLS + RPC，避免暴露写权限。

### B. 数据库迁移（migration）

```text
commission_settings(id, role app_role UNIQUE, mode 'percent'|'fixed',
                    value numeric, updated_by, updated_at)

provider_balances(user_id PK, role app_role, available numeric default 0,
                  frozen numeric default 0, withdrawn_total numeric default 0,
                  updated_at)

earning_transactions(id, user_id, role, order_id, gross numeric,
                     commission numeric, net numeric, settled_at, created_at)
  -- 订单完成时由 trigger 写入：按 commission_settings 计算 commission/net,
     net 进 provider_balances.available

withdrawal_requests(id, user_id, role, amount, fee numeric default 0,
                    actual_amount numeric, bank_info jsonb,
                    status 'pending'|'approved'|'paid'|'rejected'|'flagged',
                    risk_flags text[], reject_reason text,
                    requested_at, reviewed_by, reviewed_at, paid_at,
                    voucher_no text)
```

**RPC（SECURITY DEFINER, has_role(admin)）**
- `admin_approve_application(table, id, note)` / `admin_reject_application(table, id, reason)`
- `admin_set_commission(role, mode, value)`
- `admin_approve_withdrawal(id)` — 校验 available ≥ amount → 扣 available + withdrawn_total += amount → status=`paid` + 生成 `voucher_no` + 通知。
- `admin_reject_withdrawal(id, reason)` — 解冻 frozen → available。
- `provider_request_withdrawal(amount, bank_info)` — 校验 available ≥ amount → 移到 frozen → 插入 pending。

**RLS**
- `commission_settings`：select 全员；写仅 admin。
- `provider_balances`：select 自己 OR admin。
- `earning_transactions`：select 自己 OR admin。
- `withdrawal_requests`：select 自己 OR admin；insert 自己（amount>0 + status='pending'）；update 仅 admin。

**风控**
- 在 `admin_approve_withdrawal` 内置规则：24h 内 ≥3 次提现、单日金额 > 阈值、订单含 user_id == driver_id（自买自卖）→ 写入 `risk_flags`，状态置 `flagged` 而非 `paid`，需第二次确认 RPC `admin_force_pay(id)`。

### C. 前端模块

**1. ApplicationsAuditPage**
- Tabs：商家 / 司机 / 宠托师 / 护理师；列表项展示资质图、身份信息、联系方式。
- Approve → 调对应 RPC（merchant 已有 `approve_merchant_application`，新增 driver/groomer/sitter 类似函数 → 通过后写入 `user_roles`）。
- Reject → Dialog 输入理由 → RPC + notifications。
- 注册状态语义：`*_applications.status = approved` 才是有效角色，`pending` 时 RoleGuard 已经会把用户挡在 /roles。

**2. CommissionConfigPage**
- 表格：每个角色一行，切换 % / Fixed，输入框 + 保存（RPC `admin_set_commission`）。
- 顶部说明：「修改即时对新订单生效，已结订单不追溯」。

**3. RevenueDashboardPage**
- KPI 卡：平台总收益、本月佣金、待结算（frozen 总和）、本周环比。
- 角色贡献分组柱状图（用 recharts，已存在）。
- 数据源：`earning_transactions` 聚合，supabase view 或前端 group。

**4. WithdrawalsAdminPage**
- 三 Tab：待审批 / 已标红 / 历史。
- 行内：用户、角色、金额、可用余额、风控标签、申请时间。
- 操作：单条 Approve/Reject、批量勾选 → 「导出银行报表(CSV)」(前端 generate)、「确认转账」批量 RPC。
- 详情 Drawer：展示该用户最近 10 条 earning_transactions + 历史提现。

**5. Provider 端 WithdrawalPage（`/worker/withdraw`）**
- 顶部：可用 / 冻结 / 已提现总额。
- 申请表单：金额 + 银行信息 + 透明计算 `实际到账 = 金额 - 手续费`。
- 进度条组件：`pending → approved → paid`（按 status 渲染步骤条）。
- 入口加在 WorkerDashboardPage 「我的收益」Tab。

### D. 测试
- `withdrawal-rls.test.ts`（vitest + supabase mock）：providerA 不可读 providerB 的 withdrawal。
- `commission-calc.test.ts`：percent / fixed 两种 mode 计算正确。
- `admin-approve-withdrawal.test.ts`：余额不足返回错误；自买自卖订单触发 risk_flag。

---

## 三、执行顺序（迁移先行，前端紧随）

1. `read_query` 核对 `orders.order_status` distinct 值 → 调整 RLS 白名单 + commission/withdrawal migration（一次性）。
2. PetProfilesPage 只读加固 + 测试。
3. Admin 路由骨架 + ApplicationsAuditPage（最小闭环）。
4. CommissionConfigPage + RevenueDashboardPage。
5. Withdrawals（admin + provider 两端） + 风控 + 测试。

技术细节：所有金额 `numeric(12,2)`；所有写操作走 RPC，避免在前端用 service role；新增 RPC 全部 `SECURITY DEFINER` + `set search_path = public` + 入口校验 `has_role(auth.uid(),'admin')`。