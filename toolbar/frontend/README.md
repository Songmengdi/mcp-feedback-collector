# Toolbar Monitor - 独立工具栏监控台

这是一个独立的前端页面，用于监控Toolbar服务接收到的prompt消息。

## 功能特性

- 🔗 **实时连接**：直接连接到Toolbar广播服务（端口15749）
- 📊 **状态监控**：显示服务状态、连接数量、运行时间等
- 📝 **消息显示**：实时接收和显示prompt消息
- 🔄 **自动重连**：智能重连机制，指数退避策略
- 💾 **数据导出**：支持导出消息历史为JSON格式
- 📱 **响应式设计**：支持桌面和移动设备

## 使用方法

### 1. 启动Toolbar服务

确保独立的Toolbar服务正在运行：

```bash
cd toolbar
npm start
# 或
npx standalone-toolbar-service
```

### 2. 打开监控页面

在浏览器中打开 `index.html` 文件：

```bash
# 方法1：直接打开文件
open frontend/index.html

# 方法2：使用简单HTTP服务器
cd frontend
python3 -m http.server 8080
# 然后访问 http://localhost:8080
```

### 3. 连接到服务

页面会自动尝试连接到 `ws://localhost:15749/broadcast`。如果连接失败，可以手动点击"连接"按钮重试。

## 服务端口

- **SRPC服务端口**: 5748
- **广播服务端口**: 15749（WebSocket）

## 界面说明

### 状态监控区域
- **连接状态**：显示WebSocket连接状态（红色=断开，黄色=连接中，绿色=已连接）
- **端口信息**：显示SRPC和广播端口
- **连接数量**：当前连接到广播服务的客户端数量
- **运行时间**：服务运行时长
- **最新消息**：最后接收到消息的时间

### 连接控制区域
- **连接/断开**：手动控制WebSocket连接
- **清除历史**：清空消息列表
- **导出数据**：下载消息历史JSON文件

### 消息监控区域
- 实时显示接收到的prompt消息
- 每条消息包含：会话ID、时间戳、提示内容、模型信息、文件数量等
- 支持滚动查看历史消息

## 技术实现

- **纯前端实现**：HTML + CSS + JavaScript，无需构建工具
- **WebSocket连接**：直接连接Toolbar广播服务
- **自动重连**：连接断开时自动重连，最多尝试10次
- **状态更新**：每30秒更新一次服务状态信息

## 故障排除

### 连接失败
1. 确认Toolbar服务正在运行
2. 检查端口15749是否被占用
3. 查看浏览器控制台的错误信息

### 无法接收消息
1. 确认连接状态为"已连接"
2. 检查Toolbar服务是否接收到prompt
3. 查看服务日志确认广播功能正常

### 性能问题
- 如果消息过多，可以定期清除历史
- 建议导出重要数据后清空消息列表 