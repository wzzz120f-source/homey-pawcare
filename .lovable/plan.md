## 一、UI 微调（立即可做）

### 1. 搜索模块宽度对齐
- 现状：`CommunitySearchBar` 使用 `px-4`，而下方爱心广场内容（瀑布流 `px-3`、分类 chips `px-4`）以及守护频道、寻宠雷达内部用了不同的左右内边距，导致视觉上"搜索框比下方内容窄/宽"。
- 调整：把搜索框外层包装统一到与下方内容相同的容器（`max-w-lg mx-auto px-4`），并让三个 Tab 的内部首屏区域统一使用 `px-4`，使搜索框两端与正文卡片左右对齐。

### 2. 去掉"模块状态加载中"
- 现状：`<ChunkStatusWidget />`（DEV 环境）会在头部出现"模块状态 · 加载中 / 加载失败"小卡片，正式预览中也偶尔可见。
- 调整：从 `CommunityPage.tsx` 第 399 行删除 `{import.meta.env.DEV && <ChunkStatusWidget />}` 渲染（保留组件文件以备调试），同时把 chunk-loading 失败时的提示改为静默重试 + Toast，不再有常驻状态条。

---

## 二、爱心社区（深度融合）—— 内容带货 & 社交化

> 这部分较大，建议分 3 个 PR 推进。下面给出**总体设计 + 改动清单**，等你确认后我再分批实现。

### PR-A · 社交流（关注 / 私信 / 好友）

**新增数据表**
- `user_follows(follower_id, following_id, created_at)` —— 关注关系，RLS：本人可读写自己的关注，他人可读"我是否被关注"。
- `friend_requests(id, from_user, to_user, status[pending/accepted/rejected], created_at)` —— 好友申请。
- 复用现有 `chat_conversations` + `chat_messages` 做"私信"，仅扩展一种 `conversation_type = 'dm'`。

**前端改动**
- 用户卡片（`UserBadgeChip` + 帖子作者头像）增加"关注 / 已关注"按钮。
- 新增 `/u/:userId` 个人主页：头像、简介、关注/粉丝数、TA 的瀑布流帖子、"私信" / "申请好友" 按钮。
- `ProfilePage` 增加"关注 / 粉丝 / 好友"三个 Tab。
- 瀑布流默认排序保持"推荐"，新增"关注"Tab —— 只看已关注用户的帖子（瀑布流复用现有 `get_feed_posts` RPC，加 `only_following` 参数）。
- 私信入口：用户主页 + 帖子作者菜单，进入复用 `ChatPage`。

### PR-B · 商品挂载（内容带货）

**新增数据表**
- `post_products(post_id, product_id, position, created_at)` —— 一个帖子可挂载 1~3 个商品。
- RLS：作者可增删；公开可读。

**发帖弹窗改动**
- 在分类选择下方新增"挂载商品"按钮 → 弹出商品选择器（搜索商城商品 → 选中后展示缩略卡）。
- 已挂载商品支持拖拽排序、删除。

**展示改动**
- 帖子详情 `PostDetailPage` 在正文下方展示"同款商品"卡片：缩略图 / 名称 / 价格 / "去购买" 按钮 → 跳转 `/product/:id`。
- 瀑布流卡片右下角加一个"🛒"小角标，提示"含好物"。
- 商品详情页可选反向展示"晒单动态"（取该商品被挂载的帖子，限 6 条）。

### PR-C · 救助频道（投喂直达账户）

**核心：投喂金额自动落到救助者钱包**

**数据/逻辑改动**
- `cloud_feeding` 现仅记录积分，扩展字段：`amount NUMERIC`、`recipient_user_id UUID`（rescue_story 作者）、`status`。
- 新增 Edge Function `feed-rescue`：
  1. 校验金额 ≥ 1 元；
  2. 调用现有支付（微信 / 支付宝 / 余额）创建支付单 `payments`；
  3. 支付成功 webhook 回调里：
     - 在 `earning_transactions` 给救助者写入一条 `gross/net = amount`，`role = 'rescuer'`；
     - 给救助者 `wallet_balance` 自动 + 金额（走现有 `update-balance` 流程）；
     - 给投喂者写 `love_points` 增量；
     - 写 `notifications`：救助者收到"@xxx 投喂了 ¥N，已到账"。
- 救助详情页展示"已到账金额 / 投喂榜"，并显示"100% 直达救助者，平台不抽成"。
- 平台层面增加"提现校验"：救助者提现时该笔款项必须有完整的 rescue_story 记录，避免洗钱。

---

## 三、技术细节（开发参考）

```text
src/pages/CommunityPage.tsx          —— 删 ChunkStatusWidget、统一容器宽度、加"关注"Tab
src/components/community/
  CommunitySearchBar.tsx             —— 容器调到 max-w-lg mx-auto，与正文对齐
  GuardianChannel.tsx                —— 投喂入口接 feed-rescue
  PostFeed.tsx (新)                  —— 抽出瀑布流 + 关注/推荐 Tab 切换
  UserMiniCard.tsx (新)              —— 头像 + 关注按钮
  ProductPickerDialog.tsx (新)       —— 发帖时挂载商品
src/pages/UserProfilePage.tsx (新)
supabase/functions/
  feed-rescue/index.ts (新)
  follow-user/index.ts (新, 反作弊)
supabase/migrations/...              —— user_follows / friend_requests / post_products + cloud_feeding 扩列
```

---

## 四、实施顺序建议

1. **Step 1（本轮立即做）**：UI 微调（搜索宽度对齐 + 去掉模块状态卡）。
2. **Step 2**：PR-A 社交流（关注 / 主页 / 私信复用）。
3. **Step 3**：PR-B 商品挂载。
4. **Step 4**：PR-C 救助投喂直达。

请确认：
- Step 1 是否先单独实施一次（最快）？
- PR-A/B/C 的优先级是否按上述顺序？或者你希望先做 PR-C（救助直达）？
- 商品挂载是否需要做"分佣"（创作者带货返佣）？还是仅做导流不分佣？