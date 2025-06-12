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