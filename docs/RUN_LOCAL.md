# 本地与独立部署指南

本项目可以在 Lovable 云端一键运行，也可以拉到本地或自有 Supabase 项目独立部署。

## 一、本地开发

```bash
bun install        # 或 npm i / pnpm i
cp .env.example .env
# 按 .env 注释填入 Supabase / 高德 key
bun run dev
```

启动后访问 http://localhost:5173。

## 二、必要的环境变量

| 变量 | 用途 | 必填 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | 后端 API 地址 | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_ANON_KEY` | 前端匿名访问 | ✅ |
| `VITE_SUPABASE_PROJECT_ID` | 类型生成 / 工具调用 | ✅ |
| `VITE_AMAP_API_KEY` | 地图、路线、地址 | ✅ |
| `VITE_APP_NAME` 等 | 品牌/超时配置 | 选填 |

服务端（Edge Functions）secrets 在 Supabase Dashboard → Functions → Secrets 配置：

- `LOVABLE_API_KEY`：Lovable AI 网关，用于陪伴日记 / 客服 / AI 建议
- `AMAP_API_KEY` & `AMAP_SECURITY_KEY`：服务端调用高德
- `SUPABASE_SERVICE_ROLE_KEY` 等：由 Supabase 自动注入

## 三、数据库初始化

1. 新建 Supabase 项目，复制 URL & anon key
2. 在 SQL Editor 中按顺序运行 `supabase/migrations/` 下所有迁移
3. （可选）运行 `supabase/seed.sql` 写入演示数据

## 四、演示数据

`supabase/seed.sql` 会向以下表写入最少可演示的数据：
- `product_categories` 商品分类
- `products` 演示商品
- `banners` 首页横幅
- `pet_hotels` 演示宠物酒店

执行后即可在前端首页 / 商城 / 酒店看到内容。

## 五、自托管发布

```bash
bun run build
# 将 dist/ 目录上传到任意静态托管（Vercel / Netlify / 阿里云 OSS）
# 因使用 BrowserRouter，请配置 SPA 回退到 index.html
```

## 六、健康检查

- 打开 `/`，若顶部头图与服务卡片可以加载 → 前端正常
- 打开 `/customer-service`，向 AI 问一句话 → Edge Function 与 LOVABLE_API_KEY 正常
- 打开 `/admin/review`（admin 角色）→ 路由保护与 RLS 正常
