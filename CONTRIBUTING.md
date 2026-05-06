# 🤝 贡献指南

感谢您有兴趣为 **萌宠到家** 项目做出贡献！本文档将指导您如何参与项目开发。

## 📋 目录

- [行为准则](#行为准则)
- [贡献类型](#贡献类型)
- [开始前的准备](#开始前的准备)
- [开发工作流](#开发工作流)
- [提交规范](#提交规范)
- [代码审查](#代码审查)
- [报告问题](#报告问题)
- [功能建议](#功能建议)

## 行为准则

本项目采用 [贡献者公约](./CODE_OF_CONDUCT.md)。参与项目意味着您同意遵守其条款。

## 贡献类型

### 🐛 Bug 修复
- 修复已知的问题
- 提高代码质量
- 改进文档

### ✨ 新功能
- 实现计划中的功能
- 优化现有功能
- 性能改进

### 📚 文档
- 改进现有文档
- 翻译文档
- 添加示例和教程

### 🔬 测试
- 编写单元测试
- 编写集成测试
- 编写 E2E 测试

## 开始前的准备

### 1. Fork 仓库

点击 GitHub 页面右上角的 "Fork" 按钮。

### 2. 克隆你的 Fork

```bash
git clone https://github.com/YOUR_USERNAME/homey-pawcare.git
cd homey-pawcare
```

### 3. 添加上游仓库

```bash
git remote add upstream https://github.com/wzzz120f-source/homey-pawcare.git
```

### 4. 安装依赖

```bash
npm install
```

### 5. 配置环境变量

```bash
cp .env.example .env.local
# 编辑 .env.local，填入你的配置
```

## 开发工作流

### 步骤 1: 创建分支

```bash
# 从最新的 main 分支创建
git fetch upstream
git checkout -b feature/your-feature-name upstream/main
```

### 步骤 2: 进行更改

编辑文件并确保遵循代码规范。

```bash
# 检查代码
npm run lint

# 运行测试
npm run test
```

### 步骤 3: 提交更改

遵循 [提交规范](#提交规范)。

```bash
git add .
git commit -m "feat: 添加新功能"
```

### 步骤 4: 推送到你的 Fork

```bash
git push origin feature/your-feature-name
```

### 步骤 5: 创建 Pull Request

1. 访问你的 Fork 页面
2. 点击 "Compare & pull request"
3. 填写 PR 描述（使用下面的模板）
4. 点击 "Create pull request"

#### PR 描述模板

```markdown
## 描述

清晰简洁地描述你的改动。

## 相关 Issue

关闭 #123（如果适用）

## 改动类型

- [ ] 新功能
- [ ] 修复 Bug
- [ ] 破坏性改动
- [ ] 文档更新

## 测试清单

- [ ] 本地测试通过
- [ ] 添加了必要的测试
- [ ] ESLint 检查通过
- [ ] TypeScript 编译通过

## 截图（如适用）

添加相关的截图或 GIF。
```

## 提交规范

我们使用 Conventional Commits 格式。这使得提交历史更易读，也便于自动生成变更日志。

### 格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type（类型）

- **feat**: 新功能
- **fix**: 修复 Bug
- **docs**: 文档
- **style**: 代码格式（不影响代码行为）
- **refactor**: 代码重构
- **perf**: 性能优化
- **test**: 添加或修改测试
- **chore**: 其他改动（依赖更新等）
- **ci**: CI/CD 配置

### Scope（范围）

- **auth**: 认证相关
- **booking**: 预订相关
- **pet**: 宠物档案
- **provider**: 服务商
- **payment**: 支付
- **ui**: UI 组件
- **api**: API 相关
- **db**: 数据库

### Subject（主题）

- 使用祈使句（"add" 而不是 "added"）
- 首字母不大写
- 末尾不加句号
- 限制在 50 个字符以内

### Body（正文）

- 每行最多 72 个字符
- 解释 **是什么** 和 **为什么**，而不是 **如何做**
- 用空行分隔段落

### Footer（页脚）

- 引用相关 Issue：`Closes #123`
- 注明破坏性改动：`BREAKING CHANGE: ...`

### 示例

```
feat(booking): 添加实时聊天功能

- 集成 Supabase 实时通道
- 创建聊天组件
- 添加消息存储
- 支持多用户会话

Closes #456
```

## 代码审查

### 代码规范

我们遵循以下规范：

1. **TypeScript**: 所有代码必须使用 TypeScript
2. **ESLint**: 代码必须通过 ESLint 检查
3. **Prettier**: 代码必须符合 Prettier 格式
4. **测试**: 新功能必须包含测试

### 运行检查

```bash
# 代码检查
npm run lint

# 修复可自动修复的问题
npm run lint -- --fix

# 运行测试
npm run test

# 构建检查
npm run build
```

### 代码审查清单

- [ ] 代码遵循项目规范
- [ ] 添加了必要的类型定义
- [ ] 更新了相关文档
- [ ] 添加或更新了测试
- [ ] 没有引入新的警告或错误
- [ ] 提交信息清晰准确

## 报告问题

### 提交 Issue

1. 检查 [现有 Issue](https://github.com/wzzz120f-source/homey-pawcare/issues)
2. 如果没有相关 Issue，创建新的
3. 使用以下模板：

#### Bug 报告

```markdown
## 描述 Bug

清晰地描述问题。

## 复现步骤

1. 打开...
2. 点击...
3. 看到问题

## 预期行为

应该发生什么。

## 实际行为

实际发生了什么。

## 环境

- OS: [e.g. macOS, Windows, Linux]
- Node 版本: [e.g. 16.0.0]
- npm 版本: [e.g. 8.0.0]
- 浏览器: [e.g. Chrome, Safari]

## 附加信息

添加任何其他信息，比如错误截图、日志等。
```

#### 功能建议

```markdown
## 描述

清晰描述你的想法。

## 用例

说明这个功能的用例。

## 替代方案

是否有其他方法可以实现这个功能？

## 附加信息

任何其他相关信息。
```

## 功能建议

我们欢迎功能建议！请使用 GitHub Discussions 讨论想法：

[创建讨论](https://github.com/wzzz120f-source/homey-pawcare/discussions)

---

感谢你的贡献！🎉
