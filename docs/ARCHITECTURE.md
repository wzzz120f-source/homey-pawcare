# 项目架构设计文档

## 目录

1. [系统概述](#系统概述)
2. [架构层次](#架构层次)
3. [核心模块](#核心模块)
4. [数据流](#数据流)
5. [技术选择](#技术选择)
6. [扩展性设计](#扩展性设计)

## 系统概述

**萌宠到家** 是一个多端点、多角色的宠物服务预订平台。系统采用前后端分离架构，支持 Web 和移动端。

```
┌─────────────────────────────────────────────────────────┐
│                    用户层 (User Layer)                   │
├─────────────────────────────────────────────────────────┤
│  宠物主人端    │  服务商端  │  服务者端  │  管理后台    │
└────────────────┬──────────────┬──────────────┬───────────┘
                 │              │              │
           ┌─────▼──────────────▼──────────────▼─────┐
           │    前端应用层 (React SPA)                │
           │  - 路由管理                              │
           │  - 状态管理                              │
           │  - 页面和组件                            │
           └─────┬──────────────────────────────────┘
                 │
           ┌─────▼──────────────────────────────────┐
           │    业务逻辑层 (Services Layer)         │
           │  - 认证服务                            │
           │  - 预订服务                            │
           │  - 支付服务                            │
           │  - 位置服务                            │
           └─────┬──────────────────────────────────┘
                 │
           ┌─────▼──────────────────────────────────┐
           │    API 层 (API Integration Layer)      │
           │  - RESTful API 调用                     │
           │  - 实时通信 (Websocket)                 │
           │  - 数据序列化/反序列化                   │
           └─────┬──────────────────────────────────┘
                 │
           ┌─────▼──────────────────────────────────┐
           │    后端服务 (Supabase)                 │
           │  - PostgreSQL 数据库                   │
           │  - 用户认证                            │
           │  - 实时功能                            │
           │  - 存储服务                            │
           └─────────────────────────────────────┘
```

## 架构层次

### 1. 表现层 (Presentation Layer)

**责任**: 用户界面和交互

```
src/
├── pages/              # 路由页面
│   ├── home.tsx
│   ├── search.tsx
│   ├── booking.tsx
│   └── ...
│
├── components/         # 可复用组件
│   ├── common/        # 通用组件（Button, Modal 等）
│   ├── layout/        # 布局组件（Header, Footer 等）
│   ├── auth/          # 认证相关组件
│   ├── booking/       # 预订流程组件
│   └── dashboard/     # 仪表板组件
│
└── styles/            # 全局样式
    ├── globals.css
    └── variables.css
```

**关键原则**:
- 组件应该是纯净的，无副作用
- 使用 props 传递数据
- 将业务逻辑提取到 hooks 或 services

### 2. 业务逻辑层 (Business Logic Layer)

**责任**: 核心业务规则和数据处理

```
src/
├── services/           # 业务服务
│   ├── authService.ts          # 认证
│   ├── bookingService.ts       # 预订
│   ├── providerService.ts      # 服务商
│   ├── paymentService.ts       # 支付
│   └── reviewService.ts        # 评价
│
├── hooks/              # React Hooks
│   ├── useAuth.ts             # 认证相关
│   ├── useBookings.ts         # 预订相关
│   ├── usePets.ts             # 宠物相关
│   └── useProviders.ts        # 服务商相关
│
└── utils/              # 工具函数
    ├── validators.ts          # 数据验证
    ├── formatters.ts          # 数据格式化
    ├── errorHandler.ts        # 错误处理
    └── logger.ts              # 日志记录
```

**关键原则**:
- 单一职责原则
- 服务应该是独立的、可测试的
- 避免在服务中进行 UI 操作

### 3. API 集成层 (API Integration Layer)

**责任**: 与后端 API 通信

```
src/
├── api/
│   ├── supabase.ts            # Supabase 客户端初始化
│   └── endpoints/             # API 端点
│       ├── auth.ts
│       ├── bookings.ts
│       ├── providers.ts
│       └── ...
│
└── types/              # TypeScript 类型
    ├── user.ts
    ├── booking.ts
    ├── provider.ts
    └── ...
```

**关键原则**:
- 统一的 API 请求/响应格式
- 中央错误处理
- 自动重试机制

### 4. 数据持久化层 (Data Persistence Layer)

**责任**: 数据存储和检索

- Supabase PostgreSQL 数据库
- Supabase 对象存储（图片、文件）
- 本地浏览器存储（缓存）

## 核心模块

### 1. 认证模块 (Auth Module)

```typescript
interface AuthModule {
  // 认证状态
  currentUser: User | null;
  isAuthenticated: boolean;
  userRole: 'owner' | 'provider' | 'admin';

  // 认证操作
  register(data: RegisterData): Promise<User>;
  login(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  updateProfile(data: Partial<User>): Promise<User>;

  // 权限检查
  hasPermission(permission: string): boolean;
  isOwner(): boolean;
  isProvider(): boolean;
}
```

### 2. 预订模块 (Booking Module)

```typescript
interface BookingModule {
  // 查询
  searchProviders(filters: SearchFilter): Promise<Provider[]>;
  getAvailability(providerId: string): Promise<TimeSlot[]>;
  getBooking(id: string): Promise<Booking>;

  // 操作
  createBooking(data: BookingData): Promise<Booking>;
  updateBooking(id: string, data: Partial<Booking>): Promise<Booking>;
  cancelBooking(id: string): Promise<void>;

  // 订单列表
  getMyBookings(filter?: 'upcoming' | 'completed' | 'cancelled'): Promise<Booking[]>;
}
```

### 3. 支付模块 (Payment Module)

```typescript
interface PaymentModule {
  // 支付
  processPayment(bookingId: string): Promise<Payment>;
  getPaymentMethods(): Promise<PaymentMethod[]>;
  savePaymentMethod(method: PaymentMethod): Promise<void>;

  // 退款
  requestRefund(paymentId: string): Promise<Refund>;
  getRefundStatus(refundId: string): Promise<RefundStatus>;
}
```

## 数据流

### 用户预订流程

```
用户点击预订
     ↓
前端组件处理点击事件
     ↓
Hook (useBooking) 调用服务
     ↓
业务服务 (bookingService) 处理逻辑
     ↓
API 层调用 Supabase
     ↓
后端创建预订记录
     ↓
API 返回结果
     ↓
Hook 更新状态
     ↓
组件重新渲染，显示成功消息
```

### 实时更新流程

```
Supabase 实时监听
     ↓
数据库变化
     ↓
WebSocket 推送更新
     ↓
React Query 更新缓存
     ↓
组件重新渲染
```

## 技术选择

### 前端框架

| 技术 | 选择 | 原因 |
|-----|------|------|
| 框架 | React 18 | 大生态，完整的开发工具链 |
| 构建 | Vite | 快速开发体验，优化的生产构建 |
| 语言 | TypeScript | 类型安全，更好的开发体验 |
| 样式 | Tailwind CSS | 快速、一致的样式开发 |
| 路由 | React Router v6 | 强大的路由功能，嵌套路由 |
| 状态 | React Query | 优秀的异步数据管理 |
| 表单 | React Hook Form + Zod | 高性能表单，运行时验证 |

### 后端服务

| 服务 | 选择 | 用途 |
|-----|------|------|
| 数据库 | PostgreSQL | 关系型数据，复杂查询 |
| 认证 | Supabase Auth | 用户认证，会话管理 |
| 实时 | Supabase Realtime | 实时订单更新 |
| 存储 | Supabase Storage | 图片、文件存储 |

## 扩展性设计

### 垂直扩展（功能扩展）

1. **新增用户角色**
   ```typescript
   // src/types/user.ts
   type UserRole = 'owner' | 'provider' | 'admin' | 'moderator' | 'analyst';
   
   // src/config/routes.ts
   const roleRoutes = {
     analyst: ['/analytics', '/reports']
   };
   ```

2. **新增服务类型**
   ```typescript
   // src/types/service.ts
   enum ServiceType {
     WALKING = 'walking',
     SITTING = 'sitting',
     GROOMING = 'grooming',
     TRAINING = 'training',
     // 新增服务
     BOARDING = 'boarding',
     VETERINARY = 'veterinary'
   }
   ```

### 水平扩展（性能扩展）

1. **缓存策略**
   ```typescript
   // 使用 React Query 的缓存
   useQuery(['providers', filters], fetchProviders, {
     staleTime: 5 * 60 * 1000,  // 5 分钟
     cacheTime: 10 * 60 * 1000  // 10 分钟
   });
   ```

2. **代码分割**
   ```typescript
   // 路由级代码分割
   const Dashboard = React.lazy(() => import('./pages/dashboard'));
   const Analytics = React.lazy(() => import('./pages/analytics'));
   ```

3. **性能监控**
   ```typescript
   // src/utils/performance.ts
   export function trackMetric(name: string, value: number) {
     if (window.performance && window.performance.measure) {
       performance.mark(`${name}-end`);
       performance.measure(name, `${name}-start`, `${name}-end`);
     }
   }
   ```

## 最佳实践

1. **组件设计**
   - 保持组件小而专一
   - 使用组合而不是继承
   - 避免深层嵌套

2. **状态管理**
   - 服务器状态用 React Query
   - 客户端状态用 React Context
   - 避免过度抽象

3. **错误处理**
   - 统一的错误格式
   - 用户友好的错误消息
   - 错误日志记录

4. **测试**
   - 单元测试覆盖业务逻辑
   - 集成测试覆盖关键流程
   - E2E 测试覆盖用户场景

5. **文档**
   - 复杂函数需要 JSDoc 注释
   - 保持 README 最新
   - 记录 API 变更
