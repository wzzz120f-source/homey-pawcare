## 总体方案

按主题分 6 个 PR 串行交付，每个 PR 独立可回滚。重构作为最后一个独立 PR。

---

### PR1 - 后端鉴权与高危操作（问题 5、6、7）

**问题 5：RLS 全面审计**
- 编写一次性审计脚本，列出所有表的 RLS 策略，逐一核对管理员相关表（`admin_audit_logs`、`commission_settings`、`payment_refunds`、`merchant_applications`、`driver_applications`、`payouts/withdrawals`）必须用 `has_role(auth.uid(),'admin')` 守护写操作。
- 缺失的表补上 admin-only INSERT/UPDATE/DELETE 策略迁移。
- 所有管理员"批量"动作改走 Edge Function（`admin-batch-payout`、`admin-approve-refund` 等），函数内：① `getClaims()` 校验 JWT；② 服务端二次 `has_role` 校验；③ 强制写 `admin_audit_logs`。

**问题 6：管理员二次确认（密码再校验）**
- 新建 `<AdminConfirmDialog>` 组件：要求输入当前账号密码，前端用 `supabase.auth.signInWithPassword({ email, password })` 验证（不替换会话）。
- 验证通过后才允许调用敏感 Edge Function；后端再用 `recent_admin_auth` 表（5 分钟有效）做二次保险。
- 接入点：`AdminWithdrawalsPage` 批量打款、`AdminRefundsPage` 审核退款、`AdminCommissionPage` 改佣金率、`AdminApplicationsPage` 拒绝/通过。

**问题 7：图片上传服务端校验**
- 收紧 storage bucket RLS：`avatars / certs / posts` 等 bucket 仅允许 `auth.uid()::text = (storage.foldername(name))[1]` 的用户写。
- 新建 `validate-upload` Edge Function：客户端先调用获取签名上传 URL，函数检查 mime/大小（图片 ≤5MB、视频 ≤50MB）并返回临时 token，前端直传完成后回调验证。
- 替换所有 `DocUploader` / `MediaPicker` 走新流程。

---

### PR2 - 业务逻辑漏洞（问题 20、21、22）

**问题 20：积分防刷**
- 新建 `award-love-points` Edge Function：服务端校验"每日 100 封顶 + 单类型 1 分钟限频"，写入 `daily_point_caps`、`love_point_transactions`。
- 前端发帖、评论、点赞奖励统一调用此函数，删除前端直接 RPC 调用。

**问题 21：取消订单触发退款**
- `OrderDetailPage` 取消按钮改为调用新 Edge Function `cancel-order`：① 校验订单归属与可取消状态；② 若 `payment_status='succeeded'`，自动调用现有 `refund-payment`（虚拟订单全额退、实物订单走人工审核队列）；③ 写 `admin_audit_logs`（系统操作员）。

**问题 22：申请重复提交防护**
- 在 `sitter_applications`、`groomer_applications`、`driver_applications` 加 unique partial index：`UNIQUE (user_id) WHERE status IN ('pending','approved')`。
- 三个 Apply 页统一抽出 `useLatestApplication` hook，loading/error 时按钮也禁用，并在 submit 入口再做 server-side 二次查询。

---

### PR3 - UX 与底部布局（问题 8、9、10、11、12）

**8. 底部遮挡**
- 在 `SafeAreaBottomLayout` 暴露动态高度（CTA 高 + nav 高 + safe-area-inset-bottom），通过 `--bottom-offset` CSS 变量分发；所有 `pb-nav` 改为 `pb-[var(--bottom-offset)]`。
- 添加 e2e 用例：iPhone 14 Pro / Pixel 7 viewport 下最后一个表单元素可见。

**9. 草稿统一**
- 新建 `useDraft(key)` hook：默认 localStorage + 30 天 TTL，可选 `scope: 'session' | 'persistent'`。
- `BookingPage` 与 `HotelDetailPage` 共用，自动恢复 + 一键清除。

**10. 错误提示友好化**
- 新建 `src/lib/supabaseError.ts`：将 Postgres / Auth / Storage 错误码映射到中文（zh）和英文（en，i18n key）。
- 全局封装 `toastError(err)`，替换 `toast.error(error.message)`。

**11. 图片占位**
- 新建 `<SafeImage>` 组件：未加载显示 `<Skeleton>`，失败显示统一爪印兜底图。
- 替换商品列表、社区动态、酒店、宠物头像。

**12. 再次预约清空日期**
- `OrderHistoryPage` 复用按钮跳转 BookingPage 时只回填 `pet_id / pet_type / address`，强制清空 `booking_date / booking_time`，并加提示"请重新选择服务时间"。

---

### PR4 - 性能（问题 13、14、15）

**13. 社区页 N+1**
- 新建 RPC `get_feed_posts(limit, offset, viewer_id)`：单 SQL 用 `LEFT JOIN` + `jsonb_agg` 一次返回 posts + profile + media + counts + 当前用户是否点赞。
- `CommunityPage` 改用此 RPC，从 250 次请求降到 1 次。

**14. Realtime 范围**
- `posts-realtime` 改为只订阅 INSERT 事件，且 `filter` 限制 `created_at>now()`；收到事件只 prepend 新数据，不全量刷新。
- 评论/点赞实时改为局部更新计数（订阅 `likes`/`comments`，按 `post_id` 累加）。

**15. ProfilePage 并发**
- 6 个 fetch 改为 `Promise.all` + `useQueries`（React Query）；首屏只阻塞 profile + counts，其它 tab 内容懒加载。
- `fetchFavorites` 两阶段查询合并为一次 `select(*, products(*))`。

---

### PR5 - 代码质量与重构（问题 16、17、18、19）独立 PR

**16. BookingPage 拆分**
```
src/pages/BookingPage.tsx                        (壳，<200 行)
  ├─ components/booking/PetPicker.tsx
  ├─ components/booking/ServicePicker.tsx
  ├─ components/booking/AddressPicker.tsx
  ├─ components/booking/TimeSlotPicker.tsx
  ├─ components/booking/AISuggestionCard.tsx
  ├─ components/booking/ConfirmDialog.tsx
  └─ hooks/useBookingForm.ts (状态、校验、草稿、提交)
```

**17. 消除 as any**
- 重新生成 `supabase/types.ts`，全局 `rg "as any"` 列出 ~100 处，按文件逐个用真实类型或 `unknown` + 类型守卫替换。
- ESLint 加 `@typescript-eslint/no-explicit-any: error`（warn 起步）。

**18. i18n 补全**
- 脚本扫描 JSX 中的中文字面量 → 输出待翻译清单 → 批量替换为 `t('...')`，同步补 zh.ts / en.ts。
- 优先级：Booking、Order、Payment、Profile、Auth、Admin。

**19. 环境变量统一**
- 所有 `import.meta.env.VITE_*` 收敛到 `src/config/env.ts`。
- AMap key 已通过 `amap-config` Edge Function 下发，删除残留硬编码（`PetHotelPage`、`AMapReal` 已处理过，再做一次扫描兜底）。
- `.env.example` 补全所有可选 VITE_ 变量及说明。

---

### 技术细节（供工程参考）

**密码二次确认实现**
```ts
const { error } = await supabase.auth.signInWithPassword({ email: user.email!, password });
if (error) throw new Error('密码错误');
// 成功后 5 分钟内允许敏感操作；写入 recent_admin_auth (admin_id, expires_at)
await supabase.functions.invoke('admin-confirm-auth');
```

**RLS 审计 SQL**
```sql
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename;
```

**Feed RPC 返回结构**
```sql
SELECT p.*, row_to_json(prof.*) AS author,
  (SELECT jsonb_agg(m.*) FROM post_media m WHERE m.post_id=p.id) AS media,
  (SELECT count(*) FROM likes WHERE post_id=p.id) AS like_count,
  EXISTS(SELECT 1 FROM likes WHERE post_id=p.id AND user_id=viewer_id) AS liked
FROM posts p LEFT JOIN profiles prof ON prof.id=p.user_id
ORDER BY p.created_at DESC LIMIT $1 OFFSET $2;
```

---

### 不在范围内
- 用户自有 AMap / Stripe 商户账号注册
- 服务器端 OCR 鉴别证件真伪（仅做 mime/大小/尺寸校验）
- BookingPage 之外其它超 500 行文件的拆分（后续专项）

### 交付顺序与预估
PR1 → PR2 → PR3 → PR4 → PR5。每个 PR 完成后单独验证：RLS linter、e2e、network 抓包。
