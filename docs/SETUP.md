# 开发环境搭建指南

本文档详细说明如何搭建本地开发环境。

## 前置要求

### 系统要求
- macOS / Linux / Windows (WSL2 推荐)
- 8GB+ RAM
- 10GB+ 磁盘空间

### 必需工具
- **Node.js**: v16.0.0 或更高版本
- **npm**: v8.0.0 或更高版本（或 Bun v1.0+）
- **Git**: 用于版本控制
- **VS Code** 或其他 IDE（可选但推荐）

## 安装步骤

### 1. 安装 Node.js 和 npm

#### macOS (使用 Homebrew)
```bash
brew install node@18
node --version  # v18.x.x
npm --version   # 9.x.x
```

#### Linux (Ubuntu/Debian)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### Windows
从 [nodejs.org](https://nodejs.org/) 下载 LTS 版本并安装

### 2. 克隆项目

```bash
git clone https://github.com/wzzz120f-source/homey-pawcare.git
cd homey-pawcare
```

### 3. 配置 Supabase

#### 创建 Supabase 项目

1. 访问 [supabase.com](https://supabase.com)
2. 注册/登录账户
3. 创建新项目
4. 获取项目 API 密钥

#### 配置环境变量

```bash
# 复制示例文件
cp .env.example .env.local

# 编辑 .env.local 并填入你的 Supabase 配置
# 打开文件并替换以下值：
# VITE_SUPABASE_PROJECT_ID=your_project_id
# VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
# VITE_SUPABASE_URL=your_supabase_url
```

### 4. 初始化数据库

```bash
# 安装 Supabase CLI（可选）
npm install -g supabase

# 运行迁移（如果有）
supabase db pull
```

### 5. 安装依赖

```bash
# 使用 npm
npm install

# 或使用 Bun（更快）
bun install
```

### 6. 启动开发服务器

```bash
npm run dev
```

输出示例：
```
VITE v5.4.19  ready in 234 ms

➜  Local:   http://localhost:8080/
➜  press h to show help
```

在浏览器打开 http://localhost:8080

## IDE 配置

### VS Code 推荐扩展

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "vue.volar",
    "ms-vscode.vscode-typescript-next",
    "firsttris.vscode-jest-runner",
    "GitHub.copilot"
  ]
}
```

### VS Code 设置

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

## 常见问题

### 问题: npm install 失败

**解决方案**:
```bash
# 清除缓存
npm cache clean --force

# 删除 node_modules 和 lock 文件
rm -rf node_modules package-lock.json

# 重新安装
npm install
```

### 问题: 端口 8080 已被占用

**解决方案**:
```bash
# 使用其他端口
npm run dev -- --port 3000

# 或者杀死占用端口的进程
# macOS/Linux
lsof -i :8080 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Windows
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### 问题: Supabase 连接失败

**检查清单**:
- [ ] 确认 .env.local 文件存在
- [ ] 确认 Supabase API 密钥正确
- [ ] 确认网络连接正常
- [ ] 检查 Supabase 项目是否启用了 API

## 开发工作流

### 日常开发

```bash
# 1. 创建特性分支
git checkout -b feature/my-feature

# 2. 启动开发服务器
npm run dev

# 3. 编写代码
# 4. 提交更改
git add .
git commit -m "feat: 添加新功能"

# 5. 推送到 GitHub
git push origin feature/my-feature

# 6. 创建 Pull Request
```

### 代码检查和测试

```bash
# 运行 ESLint
npm run lint

# 修复 lint 问题
npm run lint -- --fix

# 运行单元测试
npm run test

# 监视模式
npm run test:watch

# E2E 测试
npx playwright test
```

## 调试

### 浏览器调试

1. 打开 Chrome DevTools (F12)
2. 转到 Sources 标签
3. 在源码中设置断点
4. 刷新页面

### VS Code 调试

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Chrome",
      "url": "http://localhost:8080",
      "webRoot": "${workspaceFolder}/src",
      "sourceMaps": true
    }
  ]
}
```

## 性能优化

### 缓存管理

```bash
# 清除所有缓存
rm -rf node_modules .next dist
npm install

# 清除 npm 缓存
npm cache clean --force
```

### 依赖更新

```bash
# 检查过期的依赖
npm outdated

# 更新依赖
npm update

# 更新到最新版本
npm upgrade
```

## 获取帮助

- 📚 [项目文档](../README.md)
- 🐛 [提交 Issue](https://github.com/wzzz120f-source/homey-pawcare/issues)
- 💬 [讨论区](https://github.com/wzzz120f-source/homey-pawcare/discussions)
- 📧 邮件: wzzz120f@gmail.com
