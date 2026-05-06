# 贡献指南

感谢你有兴趣为 **萌宠到家** 贡献代码！本文档将指导你如何高效地参与项目。

## 目录

- [行为准则](#行为准则)
- [如何贡献](#如何贡献)
- [开发流程](#开发流程)
- [代码风格](#代码风格)
- [提交 PR](#提交-pr)
- [常见问题](#常见问题)

## 行为准则

L请阅读 [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)

我们致力于提供一个热情和欢迎的环境。所有参与者都应该遵守我们的行为准则。

## 如何贡献

### 报告 Bug

在提交 bug 报告前，请先搜索现有的 [issue](https://github.com/wzzz120f-source/homey-pawcare/issues) 以避免重复。

**提交 bug 报告时，请包含**：
- 清晰的标题和描述
- 尽可能详细的复现步骤
- 实际行为和预期行为
- 截图或视频（如适用）
- 你的环境���息（OS、浏览器版本等）

### 提出功能建议

功能建议欢迎在 [Discussions](https://github.com/wzzz120f-source/homey-pawcare/discussions) 中讨论。

**提出建议时，请包含**：
- 清晰的用例描述
- 该功能会解决的问题
- 可能的实现方案（如果有的话）

### 改进文档

文档改进无需创建 issue，直接提交 PR 即可。

## 开发流程

### 1. Fork 并克隆仓库

```bash
# Fork 项目
# 访问 https://github.com/wzzz120f-source/homey-pawcare/fork

# 克隆你的 fork
git clone https://github.com/YOUR_USERNAME/homey-pawcare.git
cd homey-pawcare

# 添加上游仓库
git remote add upstream https://github.com/wzzz120f-source/homey-pawcare.git
```

### 2. 创建特性分支

```bash
# 同步最新代码
git fetch upstream
git rebase upstream/main

# 创建特性分支
git checkout -b feature/my-feature
```

**分支命名规范**：
- `feature/` - 新功能
- `bugfix/` - 修复 bug
- `docs/` - 文档更新
- `refactor/` - 代码重构
- `test/` - 测试相关

### 3. 进行更改

```bash
# 安装依赖（如果还没有的话）
npm install

# 启动开发服务器
npm run dev

# 编写代码
# ...

# 运行测试
npm run test

# 运行代码检查
npm run lint
```

### 4. 提交更改

遵循 Conventional Commits 格式：

```bash
git add .
git commit -m "<type>(<scope>): <subject>

<body>

<footer>"
```

**类型** (types)：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档
- `style`: 代码格式（不影响功能）
- `refactor`: 重构（不改变功能）
- `perf`: 性能优化
- `test`: 添加或更新测试
- `chore`: 依赖更新、工具配置等
- `ci`: CI/CD 配置

**范围** (scope) - 选填：
- `auth` - 认证相关
- `booking` - 预订相关
- `ui` - UI 组件
- `api` - API 层
- 等等

**主题** (subject)：
- 使用祈使句（"add" 而不是 "added"）
- 不要大写首字母
- 末尾不要句号

**正文** (body) - 选填：
- 描述为什么做这个改变
- 描述改变的影响

**底部** (footer) - 选填：
- 关闭相关 issue：`Closes #123`
- Breaking changes: `BREAKING CHANGE: description`

**示例**：
```
feat(booking): 添加实时聊天功能

实现用户和服务商之间的实时聊天功能。
- 集成 Supabase 实时通道
- 创建聊天 UI 组件
- 添加消息存储和检索

Closes #456
```

## 代码风格

### TypeScript

```typescript
// ✅ 好的例子
interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

function getUserById(id: string): Promise<User> {
  return supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .single();
}

// ❌ 避免
function getUserById(id: any) {
  // ...
}

let user: User = { ...someData }; // 不必要的显式类型
```

### React 组件

```typescript
// ✅ 好的例子
interface BookingCardProps {
  booking: Booking;
  onCancel?: (id: string) => void;
  isLoading?: boolean;
}

export function BookingCard({
  booking,
  onCancel,
  isLoading = false
}: BookingCardProps) {
  return (
    <div className="p-4 border rounded-lg">
      {/* ... */}
    </div>
  );
}

// ❌ 避免
function BookingCard(props: any) {
  // ...
}

export default BookingCard; // 优先使用命名导出
```

### 文件组织

```
✅ 推荐的结构：

features/
├── booking/
│   ├── components/
│   │   ├── BookingForm.tsx
│   │   ├── BookingList.tsx
│   │   └── index.ts
│   ├── hooks/
│   │   ├── useBooking.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── bookingService.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── booking.ts
│   │   └── index.ts
│   └── index.ts

❌ 避免的结构：

components/
├── BookingForm.tsx
├── BookingList.tsx
├── BookingCard.tsx
├── BookingModal.tsx
# ... 难以维护
```

### 命名规范

| 类型 | 示例 | 说明 |
|------|------|------|
| 文件名 | `useAuth.ts` | camelCase，反映内容 |
| 组件 | `BookingForm` | PascalCase |
| 函数 | `getUserById` | camelCase |
| 常量 | `MAX_RETRY_COUNT` | UPPER_CASE |
| 接口 | `IUser` 或 `User` | PascalCase，可选 I 前缀 |
| 类型 | `UserRole` | PascalCase |
| 私有方法 | `_privateMethod` | _ 前缀 |

### 注释

```typescript
// ✅ 好的例子

/**
 * 获取用户的所有预订
 * @param userId - 用户 ID
 * @param status - 可选的预订状态过滤
 * @returns 预订列表
 */
export async function getUserBookings(
  userId: string,
  status?: BookingStatus
): Promise<Booking[]> {
  // ...
}

// ❌ 避免

// 获取预订
function getBookings(id: string) { // 不清楚的参数名
  // ...
}
```

## 提交 PR

### PR 清单

- [ ] 分支名遵循命名规范
- [ ] 代码遵循项目风格
- [ ] 添加了测试
- [ ] 更新了相关文档
- [ ] 没有引入新的警告
- [ ] PR 标题清晰并遵循 Conventional Commits
- [ ] PR 描述详细
- [ ] 没有无关的提交

### PR 模板

```markdown
## 描述

简要描述这个 PR 的目的。

## 相关 Issue

Closes #123

## 更改类型

- [ ] 新功能
- [ ] Bug 修复
- [ ] 文档更新
- [ ] 性能优化
- [ ] 代码重构

## 更改内容

- 详细列出所有更改
- 解释为什么做这些更改

## 测试

描述你如何测试这些更改。

## 截图（如适用）

添加截图或 GIF。
```

### PR 审查标准

PR 将由维护者审查。审查可能需要：

1. **代码质量**
   - 遵循项目风格
   - 没有明显的逻辑错误
   - 适当的错误处理

2. **测试**
   - 新功能有测试
   - 测试通过
   - 适当的测试覆盖

3. **文档**
   - 有必要的文档
   - 文档清晰准确

4. **性能**
   - 没有性能回归
   - 考虑了可扩展性

## 常见问题

### Q: 我如何知道应该在哪个分支上工作？

A: 总是从 `main` 分支创建特性分支。

### Q: 我的 PR 被拒绝了，怎么办？

A: 阅读反馈，进行必要的更改，然后重新提交。

### Q: 我如何同步我的 fork 和上游仓库？

```bash
git fetch upstream
git rebase upstream/main
git push origin main -f
```

### Q: 如何撤销提交？

```bash
# 撤销最后一个提交，保留更改
git reset --soft HEAD~1

# 撤销最后一个提交，丢弃更改
git reset --hard HEAD~1
```

### Q: 如何签名我的提交？

```bash
git commit -S -m "feat: message"
```

## 获取帮助

- 📚 [项目文档](./README.md)
- 🐛 [Issue 追踪](https://github.com/wzzz120f-source/homey-pawcare/issues)
- 💬 [讨论区](https://github.com/wzzz120f-source/homey-pawcare/discussions)
- 📧 邮件: wzzz120f@gmail.com

---

**感谢你的贡献！** 🎉
