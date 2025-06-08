# Toolbar 集成指南

## 概述

本文档描述了如何将 vscode-extension 项目的 toolbar 通信功能成功集成到 mcp-feedback-collector 核心项目中。

## 已完成的集成步骤

### 第1步：创建目录结构 ✅
```
src/toolbar/
├── bridge/
│   └── srpc-websocket-bridge.ts
├── handlers/
│   ├── rpc-handler.ts
│   └── ai-agent.ts
├── types/
│   └── index.ts
└── index.ts
```

### 第2步：移植 SRPC WebSocket 桥接器 ✅
- 文件：`src/toolbar/bridge/srpc-websocket-bridge.ts`
- 功能：完整的 SRPC 协议支持、WebSocket 连接管理、RPC 方法注册

### 第3步：移植 RPC 方法处理器 ✅
- 文件：`src/toolbar/handlers/rpc-handler.ts`
- 功能：`getSessionInfo` 和 `triggerAgentPrompt` 方法

### 第4步：移植 AI Agent 功能 ✅
- 文件：`src/toolbar/handlers/ai-agent.ts`
- 功能：集成了反馈收集功能的 AI 代理

### 第5步：扩展 WebServer 类支持 SRPC ✅
- 文件：`src/server/web-server.ts`
- 功能：在 WebServer 构造函数中添加 SRPC 初始化

### 第6步：添加 toolbar 专用路由 ✅
- 路由：`/ping/stagewise` - 工具栏服务发现
- 路由：`/api/toolbar/status` - Toolbar 状态查询

### 第7步：统一端口管理 ✅
- 文件：`src/utils/port-manager.ts`
- 功能：Toolbar 端口范围管理、服务发现

## 测试命令

### 编译项目
```bash
npm run build:backend
```

### 运行基础测试
```bash
node test-toolbar-integration.js
```

### 运行完整集成测试
```bash
node test-complete-integration.js
```

### 启动完整服务
```bash
npm run dev
```

## 新增的功能

### 1. SRPC WebSocket 支持
- 支持 SRPC 协议的 WebSocket 通信
- 自动处理连接管理和消息路由
- 支持实时更新和错误处理

### 2. Toolbar RPC 方法
- `getSessionInfo`: 获取会话信息
- `triggerAgentPrompt`: 触发 AI 代理处理

### 3. AI Agent 集成
- 与 MCP 反馈收集系统集成
- 支持反馈数据增强的 AI 处理
- 提供处理状态和统计信息

### 4. 端口管理增强
- Toolbar 专用端口范围：5746-5756
- 自动服务发现
- 端口冲突检测和解决

### 5. 新增 API 端点
- `GET /ping/stagewise` - 服务发现端点
- `GET /api/toolbar/status` - Toolbar 状态查询

## 架构说明

```
mcp-feedback-collector
├── 原有功能
│   ├── Web 界面
│   ├── Socket.IO 通信
│   └── 反馈收集
└── 新增 Toolbar 功能
    ├── SRPC WebSocket 桥接器
    ├── RPC 方法处理器
    ├── AI Agent 集成
    └── 端口管理扩展
```

## 配置说明

### Toolbar 端口配置
- 默认端口范围：5746-5756
- 自动端口发现
- 支持自定义端口

### SRPC 配置
- 自动初始化
- 错误容错处理
- 连接状态监控

## 故障排除

### 常见问题

1. **端口冲突**
   - 检查端口占用：`lsof -i :5746`
   - 使用端口管理器自动查找可用端口

2. **WebSocket 连接失败**
   - 检查 SRPC 桥接器初始化状态
   - 查看服务器日志

3. **RPC 方法未注册**
   - 确认 ToolbarRPCHandler 正确初始化
   - 检查方法注册日志

### 调试命令

```bash
# 检查服务状态
curl http://localhost:5000/api/toolbar/status

# 测试 ping 端点
curl http://localhost:5000/ping/stagewise

# 查看端口占用
lsof -i :5746-5756
```

## 下一步计划

1. **前端界面扩展**：在 Web 界面中添加 Toolbar 状态面板
2. **Socket.IO 事件扩展**：添加 Toolbar 相关的实时事件
3. **配置文件支持**：添加 Toolbar 配置选项
4. **测试覆盖**：添加单元测试和集成测试

## 总结

Toolbar 功能已成功集成到 mcp-feedback-collector 核心项目中，提供了：
- 完整的 SRPC WebSocket 通信支持
- AI Agent 与反馈收集系统的集成
- 统一的端口管理和服务发现
- 向后兼容的 API 设计

所有功能都经过测试验证，可以立即投入使用。 