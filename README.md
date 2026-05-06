# 🐾 萌宠到家 (Homey PawCare)

一个专业的宠物上门服务预订平台，连接宠物主人与可靠的宠物服务提供者。

## 📋 目录

- [项目概述](#项目概述)
- [核心功能](#核心功能)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [部署](#部署)
- [贡献指南](#贡献指南)
- [常见问题](#常见问题)

## 项目概述

**萌宠到家** 是一个一站式宠物服务平台，支持以下角色：

| 角色 | 功能 |
|------|------|
| **宠物主人** | 搜索、预订、支付、评价宠物服务 |
| **服务商** | 管理资料、时间表、订单、收入统计 |
| **服务者** | 接单、记录进度、更新位置、完成服务 |
| **平台管理员** | 用户管理、订单监管、数据分析 |

### 关键特性

✅ 实时预订系统  
✅ 多角色权限管理  
✅ 集成支付功能  
✅ 地理位置服务  
✅ 评价反馈系统  
✅ 数据分析和报表  

## 核心功能

### 👥 用户端功能
- [x] 用户注册/登录/认证
- [x] 宠物档案管理（基础）
- [x] 服务搜索和筛选
- [x] 预订和支付
- [x] 订单跟踪
- [ ] 实时聊天（开发中）
- [ ] 位置跟踪（开发中）
- [ ] 评价和反馈（开发中）

### 🏢 商家端功能
- [ ] 商户管理后台（计划中）
- [ ] 服务项目管理（计划中）
- [ ] 收入统计分析（计划中）
- [ ] 客户关系管理（计划中）
- [ ] 订单管理（计划中）

### 👔 服务者端功能
- [ ] 移动端应用（计划中）
- [ ] 工作进度记录（计划中）
- [ ] GPS 签到/签退（计划中）
- [ ] 与用户沟通（计划中）
- [ ] 日程和收益管理（计划中）

## 技术栈

### 前端
- **框架**: React 18.3.1
- **构建**: Vite 5.4.19
- **语言**: TypeScript 5.8.3
- **样式**: Tailwind CSS 3.4.17 + shadcn/ui
- **表单**: React Hook Form + Zod
- **路由**: React Router v6
- **数据获取**: TanStack React Query v5
- **国际化**: i18next
- **UI 组件库**: Radix UI
- **地图**: AMap (高德地图)

### 后端
- **数据库**: Supabase (PostgreSQL)
- **认证**: Supabase Auth
- **实时**: Supabase Realtime

### 开发工具
- **代码检查**: ESLint
- **测试**: Vitest + Playwright
- **包管理**: npm
- **版本控制**: Git

## 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0 (或 Bun)
- Git

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/wzzz120f-source/homey-pawcare.git
cd homey-pawcare

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 Supabase 配置

# 4. 启动开发服务器
npm run dev

# 5. 在浏览器打开
# http://localhost:8080
```

### 可用命令

```bash
# 开发
npm run dev                 # 启动开发服务器，热更新

# 构建
npm run build              # 生成生产版本
npm run build:dev          # 生成开发版本（带源代码映射）

# 测试
npm run test               # 运行单元测试（一次）
npm run test:watch         # 运行单元测试（监视模式）

# 代码质量
npm run lint               # 运行 ESLint

# 预览
npm run preview            # 预览生产版本
```

## 项目结构

```
homey-pawcare/
├── docs/                           # 📚 项目文档
│   ├── API.md                     # API 文档
│   ├── ARCHITECTURE.md            # 架构设计
│   ├── DATABASE.md                # 数据库设计
│   ├── SETUP.md                   # 开发环境搭建详细指南
│   └── DEPLOYMENT.md              # 部署指南
│
├── src/                            # 🔧 源代码
│   ├── api/                       # API 交互层
│   │   ├── supabase.ts           # Supabase 客户端配置
│   │   └── endpoints/            # API 端点
│   │       ├── auth.ts
│   │       ├── bookings.ts
│   │       ├── providers.ts
│   │       └── reviews.ts
│   │
│   ├── types/                     # TypeScript 类型定义
│   │   ├── user.ts               # 用户相关类型
│   │   ├── booking.ts            # 预订相关类型
│   │   ├── provider.ts           # 服务商相关类型
│   │   ├── pet.ts                # 宠物相关类型
│   │   └── common.ts             # 通用类型
│   │
│   ├── hooks/                     # React Hooks
│   │   ├── useAuth.ts            # 认证 Hook
│   │   ├── useBookings.ts        # 订单 Hook
│   │   ├── usePets.ts            # 宠物 Hook
│   │   └── useProviders.ts       # 服务商 Hook
│   │
│   ├── components/                # React 组件
│   │   ├── auth/                 # 认证相关组件
│   │   ├── booking/              # 预订流程组件
│   │   ├── common/               # 通用组件
│   │   ├── layout/               # 布局组件
│   │   └── dashboard/            # 仪表板组件
│   │
│   ├── pages/                     # 页面/路由
│   │   ├── home.tsx
│   │   ├── search.tsx
│   │   ├── booking.tsx
│   │   ├── profile.tsx
│   │   ├── dashboard.tsx
│   │   └── 404.tsx
│   │
│   ├── services/                  # 业务逻辑层
│   │   ├── authService.ts
│   │   ├── bookingService.ts
│   │   ├── providerService.ts
│   │   └── paymentService.ts
│   │
│   ├── utils/                     # 工具函数
│   │   ├── constants.ts           # 常量定义
│   │   ├── formatters.ts          # 数据格式化
│   │   ├── validators.ts          # 数据验证
│   │   ├── logger.ts              # 日志工具
│   │   └── errorHandler.ts        # 错误处理
│   │
│   ├── config/                    # 配置文件
│   │   ├── env.ts                 # 环境变量
│   │   ├── routes.ts              # 路由配置
│   │   └── theme.ts               # 主题配置
│   │
│   ├── styles/                    # 全局样式
│   │   ├── globals.css
│   │   └── variables.css
│   │
│   ├── App.tsx                    # 根组件
│   └── main.tsx                   # 入口文件
│
├── tests/                          # 🧪 测试文件
│   ├── unit/                      # 单元测试
│   ├── integration/               # 集成测试
│   └── e2e/                       # 端到端测试
│
├── supabase/                       # 🗄️ 数据库迁移
│   ├── migrations/
│   └── functions/
│
├── public/                         # 📦 静态资源
│   └── images/
│
├── .github/
│   └── workflows/                 # GitHub Actions CI/CD
│       ├── test.yml
│       ├── build.yml
│       └── deploy.yml
│
├── .env.example                   # 环境变量示例
├── .eslintrc.config.js            # ESLint 配置
├── tsconfig.json                  # TypeScript 配置
├── vite.config.ts                 # Vite 构建配置
├── tailwind.config.ts             # Tailwind 配置
├── package.json                   # 项目配置和依赖
├── CONTRIBUTING.md                # 贡献指南
├── CODE_OF_CONDUCT.md             # 行为准则
└── LICENSE                        # 许可证
```

## 开发指南

### 代码规范

我们使用 ESLint 和 TypeScript 来确保代码质量。

```bash
# 运行代码检查
npm run lint

# 修复可自动修复的问题
npm run lint -- --fix
```

### 提交规范

使用 Conventional Commits 格式：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档
- `style`: 代码格式
- `refactor`: 代码重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 其他改动

**示例**:
```
feat(booking): 添加实时聊天功能

- 集成 Supabase 实时通道
- 创建聊天组件
- 添加消息存储

Closes #123
```

### 分支管理

```
main                    # 生产分支，受保护
├── develop            # 开发分支
└── feature/*          # 功能分支 (feature/user-auth)
    release/*         # 发布分支 (release/v1.0.0)
    hotfix/*          # 热修复分支 (hotfix/payment-bug)
```

### 测试

```bash
# 运行所有单元测试
npm run test

# 监视模式（开发时使用）
npm run test:watch

# E2E 测试
npx playwright test

# E2E 测试（特定浏览器）
npx playwright test --project=chromium
```

## 部署

详见 [部署指南](./docs/DEPLOYMENT.md)

### 快速部署到 Vercel

```bash
# 1. 推送代码到 GitHub
git push origin main

# 2. 在 Vercel 控制面板连接仓库
# https://vercel.com/new

# 3. 配置环境变量
# VITE_SUPABASE_PROJECT_ID
# VITE_SUPABASE_PUBLISHABLE_KEY
# VITE_SUPABASE_URL

# 4. 部署
# Vercel 会自动部署
```

## 贡献指南

欢迎贡献！请参考 [CONTRIBUTING.md](./CONTRIBUTING.md)

### 贡献步骤

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发者社区

- 📝 [讨论区](https://github.com/wzzz120f-source/homey-pawcare/discussions)
- 🐛 [问题跟踪](https://github.com/wzzz120f-source/homey-pawcare/issues)
- 💬 [讨论和建议](https://github.com/wzzz120f-source/homey-pawcare/discussions)

## 常见问题

### Q: 如何配置 Supabase？
A: 详见 [SETUP.md](./docs/SETUP.md)

### Q: 如何实现支付集成？
A: 详见 [支付集成指南](./docs/PAYMENT.md)（待编写）

### Q: 如何部署到自己的服务器？
A: 详见 [部署指南](./docs/DEPLOYMENT.md)

### Q: 支持多语言吗？
A: 是的，使用 i18next。详见 [国际化指南](./docs/I18N.md)（待编写）

## 许可证

本项目采用 MIT 许可证。详见 [LICENSE](./LICENSE) 文件。

## 致谢

感谢所有贡献者和使用者的支持！

---

**最后更新**: 2026-05-06  
**版本**: 0.1.0  
**维护者**: [wzzz120f-source](https://github.com/wzzz120f-source)
