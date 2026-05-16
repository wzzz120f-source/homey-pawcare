# 全角色端到端测试 & 修复计划

## 🔴 头号 Bug（已定位，阻塞几乎所有角色）

线上抓包显示登录用户访问首页推荐时返回 **403**：

```
permission denied for function has_role
```

数据库权限核查结果：

| 函数 | EXECUTE 授权 |
|---|---|
| `public.has_role` | ❌ 仅 postgres / service_role |
| `public.is_merchant_owner` | ❌ 仅 postgres / service_role |
| `public.is_super_admin` | ✅ anon / authenticated |

项目里有 **64 处** RLS 策略调用 `has_role`（涉及 admin/merchant/sitter/driver 几乎所有后台表），多处调用 `is_merchant_owner`。任何带「FOR ALL + has_role」管理员策略的表，普通登录用户做一次 SELECT 都会触发函数求值 → 直接 42501。

→ 这会同时导致：首页推荐挂掉、商家中心打不开、订单列表偶发空、审核台 403、客服会话拉不到等一系列「明明登录了却没数据」的现象。

**修复**：迁移中 `GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role), public.is_merchant_owner(uuid, uuid) TO anon, authenticated;` 并在 SQL 末尾把所有 SECURITY DEFINER 工具函数权限统一对齐。

---

## 测试矩阵（5 角色 × 核心链路）

会按以下顺序在预览里跑一遍，每条记录截图 + 控制台/网络错误。

### 1. 游客 Guest
- 首页/商城/社区/酒店浏览价格 → 应可见
- 点「下单 / 收藏 / 评论 / 关注」→ 弹 LoginRequiredDialog（验证拦截覆盖）
- 刷新后停留在原页面（draft + 路由保留）

### 2. 铲屎官 User
- **手机验证码登录**：send-sms-code / verify-sms-code 链路（dev 模式日志取码）
- **邮箱登录**：保留兼容
- 会话持久化：关页面再开仍登录
- 3 步极简下单（遛狗 / 喂宠 / 洗护）：选服务→时选地址→预览→支付
- 接送、酒店保留原流程，确认入口正确
- 订单详情 EscrowStatusCard：付款后状态变 held，确认完成触发 release_escrow
- 服务者主页 `/provider/:uid`：徽章 + 历史评价 + 评分聚合
- 个人中心、订单、收藏、优惠券、积分、钱包

### 3. 宠托师 / 护理师 / 司机 Sitter/Groomer/Driver
- 角色切换到对应身份
- WorkerDashboard 接单列表
- 服务打卡：GPS + 多张照片强制上传（ServiceCheckinChecklist）
- complete_service_order RPC → 订单状态、escrow 进入可结算
- 收益页 ProviderEarningsPage：earning_transactions 显示
- 提现申请

### 4. 商家 Merchant
- 商家中心、订单、申诉
- 商品发布 / 库存 / 闪购

### 5. 审核员 / 超管 Admin
- /admin 面板：申请审核、退款、提现、佣金、收入、审计
- /dev 入口（超管登录）：功能开关、用户、健康检查、维护模式

---

## 已知/可疑问题清单（探测中发现，待验证修复）

1. **has_role / is_merchant_owner 无 EXECUTE 权限**（上文，必修）
2. 推荐规则表 `service_recommendation_rules` 的「Admins manage rules」是 `FOR ALL`，建议拆成 `FOR INSERT/UPDATE/DELETE`，避免普通用户 SELECT 时也触发 has_role 求值（即使权限修了，这也是更稳的写法）
3. `useUserRoles` 仍依赖 `user_roles` SELECT —— 需确认其 RLS 允许自查
4. 手机登录 OTP：上次 dev 模式直接日志输出验证码，需在 UI 给出明显提示，避免用户找不到
5. EscrowStatusCard 在非「服务类」订单（商品订单）上应隐藏，避免误导
6. 担保支付 release 触发后通知是否落到 notifications 表 + Realtime 推送
7. 服务打卡照片若上传失败需可重试（mediaUpload 已有，复核 UI 错误态）
8. 游客 LoginRequiredDialog 在「关注 / 评论 / 加购」全路径是否都接入 `useRequireAuth`
9. 3 步下单 draft localStorage 在退出登录后需清空，避免串号

---

## 修复执行顺序

1. **DB 迁移**：GRANT EXECUTE + 拆分 service_recommendation_rules 管理员策略
2. 跑 5 角色矩阵，逐条复现 / 截屏
3. 把矩阵里实测到的失败项按「前端拦截 / RLS / RPC / UI」分类，分批修
4. 回归一遍游客 + User + 一个服务者 + Admin 的关键路径
5. 报告：表格化列出每条用例「通过 / 修复后通过 / 仍待办」

## 技术要点

```sql
-- 迁移核心
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_merchant_owner(uuid, uuid) TO anon, authenticated;

-- 推荐策略加固
DROP POLICY "Admins manage rules" ON public.service_recommendation_rules;
CREATE POLICY rules_admin_iud ON public.service_recommendation_rules
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY rules_admin_upd ON public.service_recommendation_rules
  FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY rules_admin_del ON public.service_recommendation_rules
  FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
```

确认计划后我会立刻执行迁移，再用浏览器逐角色回归并把每个发现的问题修掉。
