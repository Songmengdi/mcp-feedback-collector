# 开发环境更新说明

## 🎉 新增功能：固定端口开发模式

为了解决前后端开发协作中的端口冲突问题，我们新增了专门的开发模式。

### ✨ 主要改进

1. **固定端口配置**
   - 后端开发服务器：固定端口 `10050`
   - 前端开发服务器：固定端口 `5173`
   - 前端自动代理API请求到后端

2. **新增CLI命令**
   ```bash
   # 启动后端开发服务器（固定端口10050）
   npm run dev:backend
   
   # 或者直接使用CLI命令
   npx tsx src/cli.ts dev
   ```

3. **优化的脚本命令**
   ```bash
   # 分别启动（推荐）
   npm run dev:backend    # 启动后端
   npm run dev:frontend   # 启动前端
   
   # 同时启动
   npm run dev:full
   
   # 快速启动向导
   npm run quick-start
   
   # 测试开发环境
   npm run test:dev-setup
   ```

### 🔧 技术实现

#### 1. CLI扩展 (`src/cli.ts`)
- 新增 `startDevServer()` 函数
- 添加 `dev` 命令到CLI
- 固定端口10050配置
- 自动启用调试模式

#### 2. 前端代理配置 (`frontend/vite.config.ts`)
- 将代理目标从 `localhost:5000` 改为 `localhost:10050`
- 支持Socket.IO和API请求代理

#### 3. 包脚本优化 (`package.json`)
- `dev:backend`: 启动后端开发服务器
- `dev:full`: 同时启动前后端
- `test:dev-setup`: 验证开发环境
- `quick-start`: 交互式启动向导

### 📋 使用指南

#### 快速开始
```bash
# 方案1：使用快速启动向导（推荐新手）
npm run quick-start

# 方案2：分别启动（推荐开发者）
# 终端1：启动后端
npm run dev:backend

# 终端2：启动前端
npm run dev:frontend
```

#### 验证环境
```bash
# 测试开发环境配置
npm run test:dev-setup
```

### 🌐 访问地址

- **前端开发界面**: http://localhost:5173
- **后端管理界面**: http://localhost:10050
- **API接口**: http://localhost:10050/api

### 🆚 新旧对比

| 特性 | 旧方案 | 新方案 |
|------|--------|--------|
| 后端端口 | 动态分配 | 固定10050 |
| 前端代理 | 需要手动配置 | 自动配置 |
| 启动方式 | 复杂 | 简化 |
| 调试模式 | 手动启用 | 自动启用 |
| 端口冲突 | 经常发生 | 完全避免 |

### 🔄 向后兼容

- 原有的 `npm run start` 命令继续可用
- 生产环境部署方式不变
- 所有现有功能保持不变

### 📚 相关文档

- [开发指南](./DEVELOPMENT.md) - 详细的开发环境设置说明
- [快速启动脚本](./scripts/quick-start-dev.sh) - 交互式启动向导
- [测试脚本](./scripts/test-dev-setup.js) - 开发环境验证工具

### 🐛 故障排除

如遇到问题，请参考：

1. **端口被占用**
   ```bash
   # 查找占用进程
   lsof -i :10050
   # 杀死进程
   kill -9 <PID>
   ```

2. **前端无法连接后端**
   - 确保后端服务器已启动
   - 检查防火墙设置
   - 查看浏览器网络面板

3. **依赖问题**
   ```bash
   # 重新安装依赖
   npm run install-deps
   ```

---

这个更新让开发体验更加流畅，欢迎使用新的开发模式！ 