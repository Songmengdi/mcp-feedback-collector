# 独立Toolbar服务

独立的Stagewise工具栏服务，支持SRPC通信和WebSocket广播，解决多服务环境下的工具栏集成问题。

## 功能特性

- **SRPC通信**: 与Stagewise工具栏的完整兼容
- **WebSocket广播**: 支持多个WebService同时接收prompt
- **固定端口**: 使用5749端口，简化服务发现
- **实时广播**: prompt实时广播到所有连接的客户端
- **健康检查**: 提供完整的服务状态监控
- **优雅关闭**: 支持进程信号处理和优雅关闭

## 快速开始

### 安装依赖

```bash
cd toolbar
npm install
```

### 构建项目

```bash
npm run build
```

### 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run start
```

## 服务端点

### SRPC WebSocket
- **地址**: `ws://localhost:5749`
- **用途**: Stagewise工具栏连接
- **协议**: SRPC WebSocket通信

### 广播WebSocket
- **地址**: `ws://localhost:5749/broadcast`
- **用途**: WebService客户端连接
- **协议**: 自定义JSON消息格式

### HTTP API

#### 健康检查
```
GET http://localhost:5749/health
```

#### 服务状态
```
GET http://localhost:5749/api/toolbar/status
```

#### 最新Prompt
```
GET http://localhost:5749/api/latest-prompt
```

#### 客户端列表
```
GET http://localhost:5749/api/clients
```

#### Ping端点
```
GET http://localhost:5749/ping/stagewise
```

## 架构设计

### 服务解耦
- 从主项目中完全独立
- 固定端口5749，避免动态分配
- 支持多个WebService实例同时运行

### 通信流程
1. Stagewise工具栏连接到 `ws://localhost:5749`
2. 工具栏发送SRPC请求到独立服务
3. 独立服务接收prompt并广播到所有WebService
4. 所有连接的WebService同时收到prompt

### 消息格式

#### 广播消息格式
```json
{
  "event": "prompt_received",
  "data": {
    "prompt": "用户输入的prompt",
    "sessionId": "会话ID",
    "model": "模型名称",
    "files": [],
    "images": [],
    "mode": "模式",
    "metadata": {},
    "timestamp": 1234567890
  },
  "timestamp": 1234567890
}
```

#### 欢迎消息
```json
{
  "event": "welcome",
  "data": {
    "clientId": "client_xxx",
    "service": "standalone-toolbar-service",
    "version": "1.0.0",
    "timestamp": 1234567890
  }
}
```

## WebService集成

### 连接到广播服务

```javascript
const ws = new WebSocket('ws://localhost:5749/broadcast');

ws.on('open', () => {
  console.log('Connected to Toolbar broadcast service');
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  
  if (message.event === 'prompt_received') {
    // 处理接收到的prompt
    handlePrompt(message.data);
  }
});

function handlePrompt(promptData) {
  console.log('Received prompt:', promptData.prompt);
  // 在你的WebService中处理prompt
}
```

### 心跳保持连接

```javascript
// 发送心跳
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'ping' }));
  }
}, 30000);

// 处理心跳响应
ws.on('message', (data) => {
  const message = JSON.parse(data);
  if (message.event === 'pong') {
    console.log('Heartbeat response received');
  }
});
```

## 开发

### 项目结构
```
toolbar/
├── src/
│   ├── main.ts              # 主入口文件
│   ├── server/
│   │   └── toolbar-server.ts # Toolbar服务器
│   ├── toolbar/             # Toolbar模块
│   │   ├── index.ts
│   │   ├── handlers/        # RPC处理器
│   │   ├── bridge/          # SRPC桥接器
│   │   └── types/           # 类型定义
│   └── utils/               # 工具类
│       ├── logger.ts
│       └── port-manager.ts
├── package.json
├── tsconfig.json
└── README.md
```

### 构建命令
- `npm run build`: 构建TypeScript代码
- `npm run dev`: 开发模式运行
- `npm run start`: 生产模式运行
- `npm run clean`: 清理构建文件

## 故障排除

### 端口占用
如果5749端口被占用，服务会启动失败。请检查端口占用情况：

```bash
# macOS/Linux
lsof -i :5749

# Windows
netstat -ano | findstr :5749
```

### 连接问题
1. 确认服务正在运行: `curl http://localhost:5749/health`
2. 检查WebSocket连接: 使用浏览器开发者工具测试
3. 查看服务日志: 检查控制台输出

### 性能监控
服务提供详细的状态信息，可通过API端点监控：
- 连接的客户端数量
- 最新prompt时间
- 服务运行时间
- 内存使用情况

## 版本信息

- **版本**: 1.0.0
- **Node.js**: >= 18.0.0
- **兼容性**: Stagewise工具栏 v2.0+

## 许可证

MIT License 