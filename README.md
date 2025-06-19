# 🎯 MCP Feedback Collector
基于Node.js的现代化MCP反馈收集器，支持AI工作汇报和用户反馈收集。

# Cursor配置说明
```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "command": "npx",
      "args": [
        "-y",
        "smd-mcp-feedback-collector@latest"
      ],
      "env": {
        "MCP_TRANSPORT_MODE": "stdio",
        "MCP_WEB_PORT": "5050"
      }
    }
  }
}
```

# Cursor stdio模式, 测试版本(多窗口兼容,不会因为多窗口断开连接)

```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "command": "npx",
      "args": [
        "-y",
        "smd-mcp-feedback-collector@1.3.2-beta.0"
      ],
    }
  }
}
```


# Cursor mcp模式配置(多窗口不冲突)
<!-- beta 非稳定版本,介意勿用 -->
使用 npx smd-mcp-feedback-collector@beta 全局启动(在控制台启动一个,之后在cursor中配置)

```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```