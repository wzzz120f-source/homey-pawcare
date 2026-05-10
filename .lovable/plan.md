## 目标

修复三个核心问题：实时定位演示数据化、AI 客服鉴权与缺失实现、地图 Key 前端硬编码。

---

## 1. 真实 GPS 定位追踪（替换 SVG 模拟）

**司机端自动上报**
- 在司机端 `DriverHallPage` / `DriverOrderPage`（或现有进行中订单页）增加后台定位上报逻辑：
  - 使用 `navigator.geolocation.watchPosition`，频率 10–15 秒一次（移动距离 > 30m 才写库，节流防抖）。
  - 通过新建 Edge Function `report-location` 写入 `trip_tracking`（已存在），字段：`driver_lat/lng/speed/heading/distance_km/eta_minutes/updated_at`。
  - 服务端做权限校验：`driver_id = auth.uid()` 且订单状态 ∈ in_progress。
- 阶段切换（departed/picking_up/picked_up/delivered）保留按钮触发，但额外根据"司机距离接送点 < 100m"自动建议进入下一阶段。

**用户端真实地图**
- `TripTrackingPage.tsx`：删除手写 SVG 与 `simRef` 模拟动画；用 `<AMapReal>` 渲染：
  - 标记：起点 / 终点 / 司机当前位置（活体动画 marker）。
  - 路线：调用高德 `AMap.Driving` 规划，订阅 Realtime `trip_tracking` UPDATE 实时移动 marker。
  - 离线/无定位时：显示「最近上报时间 + 信号弱提示」，不再显示假动画。

**距离/ETA**
- 用高德 Driving 计算实际剩余里程与 ETA，写回 `trip_tracking`，移除前端伪进度条。

---

## 2. AI 客服安全化 & 实现完善

**鉴权修复**
- `CustomerServicePage.tsx` 与 `AIChatWidget.tsx`：移除自构造 `fetch` + `VITE_SUPABASE_PUBLISHABLE_KEY` 的写法，统一改为：
  ```ts
  const { data, error } = await supabase.functions.invoke('chat-ai', { body: { messages } });
  ```
  SDK 会自动注入当前登录用户的 JWT，不再暴露 publishable key 用法。

**Edge Function `chat-ai` 完善**
- 现有 `index.ts` 已有 SYSTEM_PROMPT 与 Lovable AI Gateway 调用骨架，补齐：
  - 在代码里使用 `getClaims()` 校验 JWT，只允许已登录用户调用。
  - 限流：基于 `user_id` 写入 `ai_chat_quota`（新表，每日 50 条），超限返回 429。
  - 入参 zod 校验：`messages: {role, content}[]`，长度 ≤ 30，单条 ≤ 2000 字符。
  - 流式返回（SSE）保持 Markdown，前端继续支持打字效果。
  - 错误分类：402 余额不足 / 429 限流 / 500 通用，前端给对应文案。

---

## 3. 高德地图 Key 安全化

**前端不再持有真 Key**
- 删除 `AMapReal.tsx`、`PetHotelPage.tsx` 中硬编码的 `AMAP_KEY` 与 `AMAP_SECURITY_KEY`。
- Edge Function 已有 `AMAP_API_KEY` / `AMAP_SECURITY_KEY` Secret，新增 Edge Function `amap-jscode`：
  - 校验登录用户。
  - 返回**短期一次性 token**（自定义签名，TTL 5 分钟，绑定 user_id + 时间戳），而不是直接返回真 Key。
  - 配套高德"代理服务"模式：用 Edge Function `amap-proxy` 作为 JS API 安全代理，前端通过 `serviceHost` 指向该代理；代理在服务端注入真 Key + securityJsCode 后转发给高德 REST。
- `AMapReal.tsx`：
  - 启动时调用 `amap-jscode` 拿临时配置；用 `AMapLoader` 的 `serviceHost` 指向 Edge Function 域名 + `/_AMapService`。
  - 真实 Key 仅存在于 Supabase Secrets 与代理函数内存中，前端不可见。

**REST 调用（geocode/路线/搜索）**
- 所有 REST 调用（如 `PetHotelPage` 周边搜索、接送费用估算）改走 `amap-proxy` Edge Function，前端只传业务参数。

---

## 技术细节（开发参考）

**新建表**
```sql
create table public.ai_chat_quota (
  user_id uuid not null,
  quota_date date not null default current_date,
  count int not null default 0,
  primary key (user_id, quota_date)
);
alter table public.ai_chat_quota enable row level security;
create policy "self read" on public.ai_chat_quota for select using (auth.uid() = user_id);
```

**新建 Edge Functions**
- `report-location`：driver 写入 trip_tracking，含 RLS 校验 + 距离阈值。
- `amap-jscode`：返回前端可用的 jscode 配置（不含真 Key）。
- `amap-proxy`：通用 REST 代理，按白名单转发 `/v3/geocode/*`、`/v3/direction/*`、`/v3/place/*`。

**前端改造文件**
- `src/pages/TripTrackingPage.tsx`：移除 SVG/模拟动画，接入 AMapReal + 实时订阅。
- `src/pages/DriverHallPage.tsx`（或司机进行中订单页）：增加 `useDriverLocationReporter(orderId)` Hook。
- `src/components/AMapReal.tsx` & `src/pages/PetHotelPage.tsx`：删除硬编码 Key，改走 `amap-jscode` + `amap-proxy`。
- `src/pages/CustomerServicePage.tsx`、`src/components/AIChatWidget.tsx`：改用 `supabase.functions.invoke('chat-ai')`。

**回滚策略**
- 三块改造相互独立，可分 PR 验证：PR-A 地图安全、PR-B AI 客服、PR-C 实时定位。

---

## 不在本次范围

- 高德企业账号申请、域名白名单配置（需用户在高德控制台操作，本计划只搭好代理框架）。
- 司机端原生 App 后台定位（浏览器仅前台 watchPosition；后台定位需 PWA 或后续原生壳）。