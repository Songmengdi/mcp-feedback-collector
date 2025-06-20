# @songm_d/standalone-toolbar-service

[![npm version](https://badge.fury.io/js/@smd%2Fstandalone-toolbar-service.svg)](https://badge.fury.io/js/@smd%2Fstandalone-toolbar-service)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

独立的Stagewise工具栏服务命令行工具，支持SRPC通信和WebSocket广播。

## 快速启动

使用npx直接启动服务（无需安装）：

```bash
npx @smd/standalone-toolbar-service
```

## 服务端点

- **SRPC WebSocket**: `ws://localhost:5748` - Stagewise工具栏连接
- **广播WebSocket**: `ws://localhost:5748/broadcast` - WebService客户端连接
- **健康检查**: `http://localhost:5748/health`

## 开发

```bash
# 克隆项目
git clone <repository-url>
cd toolbar

# 安装依赖
npm install

# 开发模式
npm run dev

# 构建
npm run build

# 启动
npm start
``` 