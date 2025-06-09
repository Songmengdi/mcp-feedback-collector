# 🎯 MCP Feedback Collector
基于Node.js的现代化MCP反馈收集器，支持AI工作汇报和用户反馈收集。

## ✨ 新版本特性 (v1.2.0)

### 🔄 多传输模式支持
- **StreamableHTTP传输** - 现代化HTTP传输模式（默认，推荐）
- **SSE传输** - Server-Sent Events传输，向后兼容
- **Stdio传输** - 标准输入输出传输，传统模式
- **智能配置** - 支持环境变量和命令行参数配置

### 🌐 HTTP服务架构
- **独立HTTP服务器** - MCP服务运行在独立的HTTP端口（默认3001）
- **Web管理界面** - 提供Web界面进行反馈管理（默认5000端口）
- **Stagewise集成** - 拦截stagewise插件的prompt并在Web窗口中捕获作为反馈信息
- **会话管理** - 支持多个并发MCP客户端连接

### 🚀 后台运行支持
- **后台启动** - 启动脚本支持后台运行，不占用控制台
- **进程管理** - 提供start/stop/status/restart命令
- **日志管理** - 自动日志文件记录和PID文件管理
- **跨平台** - Linux、macOS、Windows全平台支持

### 🎯 智能反馈模式
- **三种反馈模式** - 探讨/编辑/搜索模式，提供预设反馈内容
- **动态占位符** - 输入框实时显示当前模式的默认反馈预览
- **快捷键支持** - `Ctrl/Cmd + 1/2/3` 快速切换模式，`Ctrl/Cmd + Enter` 提交

### 🖼️ 多媒体支持
- **图片上传** - 支持图片拖拽、粘贴和文件选择
- **图片预览** - 优化的图片预览界面
- **文件管理** - 自动文件大小限制和格式验证

### 🎨 现代化界面
- **Vue3 + Vite** - 使用现代前端技术栈重构
- **响应式设计** - 适配不同屏幕尺寸，支持移动端
- **主题支持** - 现代化UI设计，支持深色模式

## 🚀 快速开始

### 环境要求
- Node.js 20+
- npm 或 yarn

### 安装和构建
```bash
# 克隆项目
git clone <repository-url>
cd mcp-feedback-collector

# 安装依赖
npm install

# 构建项目
npm run build
```

### 启动服务
```bash
# 启动服务器（后台运行）
./start.sh                    # Linux/macOS
start.bat                     # Windows

# 查看服务状态
./start.sh status             # Linux/macOS
start.bat status              # Windows

# 停止服务器
./start.sh stop               # Linux/macOS
start.bat stop                # Windows
```

## 🔧 Cursor集成配置

### 方式一：HTTP传输模式（推荐）

在Cursor的MCP设置中添加以下配置：

```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "url": "http://localhost:3001/sse"
    }
  }
}
```

**配置步骤：**
1. 启动MCP服务器：`./start.sh` 或 `start.bat`
2. 确认服务运行正常：`./start.sh status`
3. 将上述配置添加到Cursor的MCP设置
4. 重启Cursor，确认MCP服务器状态为绿色

### 方式二：命令行模式（兼容）

```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "command": "node",
      "args": ["path/to/mcp-feedback-collector/dist/cli.js"],
      "env": {
        "MCP_TRANSPORT_MODE": "stdio",
        "MCP_WEB_PORT": "5000"
      }
    }
  }
}
```

### 环境变量配置

支持以下环境变量自定义配置：

```bash
# 传输模式配置
MCP_TRANSPORT_MODE=streamable_http    # 传输模式（streamable_http|sse|stdio）

# 端口配置
MCP_WEB_PORT=5000                     # Web界面端口
MCP_HTTP_PORT=3001                    # MCP HTTP服务端口
MCP_TOOLBAR_PORT=5749                 # Stagewise拦截服务端口（固定）

# 功能配置
MCP_ENABLE_SSE_FALLBACK=true          # 启用SSE向后兼容
LOG_LEVEL=info                        # 日志级别（error|warn|info|debug）
```

### Cursor全局规则配置

在Cursor的全局规则中添加以下内容：

```text
# MCP反馈收集规则
- 当你需要询问用户问题时，应请求用户提供反馈，并使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈。

- 每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。

- 使用反馈工具时，请提供清晰的工作汇报，描述完成的任务和结果。
```

## 🔗 Stagewise插件集成

### 什么是Stagewise集成

Stagewise是一个Cursor插件，提供UI选择工具，能够将prompt直接发送给Cursor。我们的MCP Feedback Collector能够拦截stagewise发送的prompt，并在自己的Web窗口中捕获这些prompt作为反馈信息使用。

### 集成原理

1. **Prompt拦截** - 监听stagewise插件发送的prompt请求
2. **Web窗口捕获** - 在我们的Web界面中显示拦截到的prompt
3. **反馈转换** - 将拦截到的prompt转换为反馈信息
4. **统一管理** - 与其他反馈信息一起进行统一管理和处理

### 配置要求

- **固定端口** - Stagewise拦截服务运行在固定的5749端口
- **自动启动** - 随MCP服务器自动启动，无需额外配置
- **透明集成** - 对用户透明，无需修改现有工作流程

### 使用方式

1. 启动MCP Feedback Collector服务
2. 在Cursor中正常使用stagewise插件
3. 发送的prompt会自动被拦截并显示在Web界面中
4. 可以在Web界面中查看、编辑和管理这些prompt

## 📊 服务管理

### 启动脚本命令

```bash
# Linux/macOS
./start.sh [命令] [选项]

# Windows  
start.bat [命令] [选项]
```

**可用命令：**
- `start` - 启动服务器（默认）
- `stop` - 停止服务器
- `status` - 查看服务器状态
- `restart` - 重启服务器

**可用选项（仅适用于start命令）：**
- `--transport=MODE` - 设置传输模式
- `--web-port=PORT` - 设置Web端口
- `--mcp-port=PORT` - 设置MCP端口
- `--log-level=LEVEL` - 设置日志级别

### 服务访问地址

启动后可通过以下地址访问：

- **Web管理界面**: http://localhost:5000
- **MCP HTTP API**: http://localhost:3001/mcp
- **SSE端点**: http://localhost:3001/sse
- **Stagewise拦截服务**: http://localhost:5749 (用于拦截stagewise插件的prompt)

## 🐛 故障排除

### 常见问题

**1. Cursor中MCP服务器不显示绿色状态**
```bash
# 检查Node.js版本（需要20+）
node --version

# 检查项目是否已构建
npm run build

# 检查服务是否运行
./start.sh status
```

**2. 端口被占用**
```bash
# 检查端口使用情况
netstat -an | grep :3001

# 使用其他端口启动
./start.sh start --mcp-port=3002
```

**3. 服务启动失败**
```bash
# 查看详细日志
tail -f logs/mcp-feedback-collector.log

# 使用调试模式启动
./start.sh start --log-level=debug
```

**4. HTTP传输模式连接失败**
- 确认防火墙设置允许相应端口
- 检查是否有其他服务占用端口
- 尝试使用stdio模式作为备选方案

### 日志文件位置

- **应用日志**: `logs/mcp-feedback-collector.log`
- **进程ID**: `logs/mcp-feedback-collector.pid`

## 🔄 版本迁移

### 从v1.x升级到v1.2.0

1. **更新依赖**：
   ```bash
   npm install
   npm run build
   ```

2. **更新Cursor配置**：
   - 推荐使用HTTP传输模式
   - 更新MCP服务器URL为 `http://localhost:3001/mcp`

3. **新增功能**：
   - `MCP_TRANSPORT_MODE` 默认值改为 `streamable_http`
   - 新增 `MCP_HTTP_PORT` 配置项
   - 新增Stagewise插件集成功能

## 📝 开发说明

### 项目结构
```
mcp-feedback-collector/
├── src/                    # 后端源码
│   ├── server/            # 服务器实现
│   ├── toolbar/           # Stagewise拦截服务
│   ├── config/            # 配置管理
│   ├── types/             # 类型定义
│   └── utils/             # 工具函数
├── frontend/              # 前端源码
│   ├── src/               # Vue3源码
│   └── public/            # 静态资源
├── logs/                  # 日志文件
├── start.sh              # Linux/macOS启动脚本
├── start.bat             # Windows启动脚本
└── dist/                 # 构建输出
```

### 开发模式
```bash
# 后端开发
npm run dev

# 前端开发
cd frontend
npm run dev

# 同时运行前后端
npm run dev:all
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。
