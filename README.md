# 🎯 MCP Feedback Collector

[![npm version](https://badge.fury.io/js/mcp-feedback-collector.svg)](https://www.npmjs.com/package/mcp-feedback-collector)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

基于Node.js的现代化MCP反馈收集器，支持AI工作汇报和用户反馈收集。

## ✨ 特性

- 🎨 **现代界面**: VS Code深色主题风格的Web界面
- 🔧 **MCP集成**: 完整支持Model Context Protocol
- 🖼️ **图片支持**: 完整的图片上传、处理和显示功能
- 🌐 **跨平台**: 支持Windows、macOS、Linux
- ⚡ **高性能**: 解决了Python版本的稳定性问题


## 🚀 快速开始

### 安装和运行

```bash
# 安装包
npm install
# 构建
npm run build 
```

## 🔧 使用方法


### Cursor集成

#### 🚀 快速配置示例

假设您的项目位于 `d:\zhuomian\nodejsweb`，推荐配置：

```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "command": "node",
      "args": ["d:/zhuomian/nodejsweb/dist/cli.js"],
      "env": {
        "MCP_WEB_PORT": "5050",
        "MCP_DIALOG_TIMEOUT": "60000"
      }
    }
  }
}
```

**配置步骤**：
1. 确保项目已构建：`npm run build`
2. 将上述配置添加到Cursor的MCP设置中
3. 重启Cursor，查看MCP服务器状态为绿色
## 在cursor全局规则中加入如下规则
```text
- 当你需要询问用户问题时, 应请求用户提供反馈, 并使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.

- 每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。
```

## 🆕 改动

### 🎨 UI简化优化
- **纯文字状态显示**: 移除旋转动画，简洁直观
- **智能自动刷新**: 默认启用，无需用户选择
- **简约设计**: 符合现代UI设计趋势

### 🔄 会话管理优化
- **智能页面刷新**: 检测新内容时自动刷新页面
- **会话自动重置**: 解决"对话过期"问题
- **无缝体验**: 3秒倒计时提示



## 🛠️ MCP工具函数

### collect_feedback

收集用户对AI工作的反馈：

```typescript
// 基本调用（超时时间从环境变量读取）
collect_feedback("我已经完成了代码重构工作，主要改进了性能和可读性。")
```

**参数说明**:
- `work_summary` (必需): AI工作汇报内容

**超时时间配置**:
- 超时时间通过环境变量 `MCP_DIALOG_TIMEOUT` 统一配置
- 默认值为 60000 秒（约16.7小时）
- 有效范围：10-60000 秒

**功能**:
- 启动Web界面显示工作汇报
- 收集用户文字和图片反馈
- 返回结构化的反馈数据
- 自动管理服务器生命周期
- 提交反馈后自动关闭标签页（3秒倒计时）

## 🎨 界面特性

- **双标签页设计**: 工作汇报 + AI对话
- **VS Code主题**: 深色主题，专业美观
- **响应式布局**: 支持桌面和移动设备
- **实时通信**: WebSocket连接状态指示
- **多模态支持**: 文字+图片组合输入
- **智能关闭**: 反馈提交后3秒倒计时自动关闭标签页

## 📋 系统要求

- **Node.js**: 18.0.0 或更高版本
- **浏览器**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **操作系统**: Windows 10+, macOS 10.15+, Ubuntu 18.04+

## 🔒 安全特性

- 输入验证和文件大小限制
- CORS配置和安全头
- API密钥安全存储
- 恶意内容基础检测

## 📊 性能指标

- **启动时间**: < 3秒
- **内存使用**: < 100MB
- **响应时间**: < 2秒
- **并发连接**: 支持10个同时连接

## 🐛 故障排除

### 常见问题

1. **WebSocket连接失败**
   ```bash
   # 检查服务器状态
   mcp-feedback-collector health

   # 访问测试页面
   http://localhost:5000/test.html

   # 查看浏览器控制台错误信息
   ```

2. **端口被占用**
   ```bash
   # 检查端口使用情况
   netstat -an | grep :5000

   # 使用其他端口
   mcp-feedback-collector --port 5001
   ```
