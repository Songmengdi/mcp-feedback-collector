# 开发指南

本文档介绍如何在开发环境中运行MCP Feedback Collector项目。

## 开发环境设置

### 前置要求

- Node.js >= 18.0.0
- npm 或 yarn

### 安装依赖

```bash
# 安装前后端依赖
npm run install-deps
```

## 开发模式

项目提供了专门的开发模式，使用固定端口以便前后端协同开发。

### 方案1：分别启动（推荐）

**步骤1：启动后端开发服务器**
```bash
npm run dev:backend
```

这将在固定端口 `10050` 启动后端服务器，包含：
- Web界面: http://localhost:10050
- API端点: http://localhost:10050/api
- Socket.IO支持
- 调试日志输出

**步骤2：启动前端开发服务器**
```bash
npm run dev:frontend
```

这将在端口 `5173` 启动前端开发服务器，并自动代理API请求到后端。

### 方案2：同时启动

```bash
npm run dev:full
```

这将同时启动前后端开发服务器。

## 端口配置

- **前端开发服务器**: http://localhost:5173
- **后端开发服务器**: http://localhost:10050
- **前端代理配置**: 自动将 `/api` 和 `/socket.io` 请求代理到后端

## 开发特性

### 后端开发服务器特性

- ✅ 固定端口 10050，避免端口冲突
- ✅ 仅Web模式，专注API开发
- ✅ 自动启用调试日志
- ✅ 文件日志记录
- ✅ 优雅关闭处理

### 前端开发服务器特性

- ✅ 热重载 (HMR)
- ✅ 自动代理API请求
- ✅ Socket.IO实时通信支持
- ✅ 现代化构建工具 (Vite)

## 调试

### 后端调试

后端开发服务器自动启用调试模式：
- 控制台输出详细日志
- 日志文件保存在项目根目录
- 所有API请求响应记录

### 前端调试

使用浏览器开发者工具：
- Network面板查看API请求
- Console面板查看前端日志
- Vue DevTools支持

## 构建部署

### 开发构建

```bash
npm run build
```

### 生产部署

```bash
npm run start:persistent
```

## 常见问题

### Q: 端口被占用怎么办？

A: 开发模式使用固定端口10050，如果被占用请先关闭占用该端口的进程：

```bash
# 查找占用端口的进程
lsof -i :10050

# 杀死进程
kill -9 <PID>
```

### Q: 前端无法连接后端API？

A: 请确保：
1. 后端开发服务器已启动 (`npm run dev:backend`)
2. 前端代理配置正确 (target: http://localhost:10050)
3. 防火墙未阻止端口访问

### Q: 如何切换回动态端口？

A: 使用标准启动命令：

```bash
npm run start:persistent
```

这将使用动态端口分配，适合生产环境。

## 项目结构

```
mcp-feedback-collector/
├── src/                 # 后端源码
│   ├── cli.ts          # CLI入口（包含dev命令）
│   ├── server/         # 服务器逻辑
│   └── ...
├── frontend/           # 前端源码
│   ├── src/           # Vue.js应用
│   ├── vite.config.ts # Vite配置（包含代理设置）
│   └── ...
└── package.json       # 项目配置（包含开发脚本）
```

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 使用开发模式进行开发测试
4. 提交Pull Request

更多信息请参考项目README和其他文档。 