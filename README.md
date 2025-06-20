# 🎯 MCP Feedback Collector
基于Node.js的现代化MCP反馈收集器，支持AI工作汇报和用户反馈收集。

# Cursor配置说明(1.3.6版本)
```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "command": "npx",
      "args": [
        "-y",
        "smd-mcp-feedback-collector@latest"
      ],
    }
  }
}
```

# 
# Cursor配置说明(1.2.2版本,指定之前版本)
```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "command": "npx",
      "args": [
        "-y",
        "smd-mcp-feedback-collector@1.2.2"
      ],
      "env": {
        "MCP_TRANSPORT_MODE": "stdio",
        "MCP_WEB_PORT": "5050"
      }
    }
  }
}
```


# Cursor mcp模式配置
<!-- beta 非稳定版本,介意勿用 -->
使用 npx smd-mcp-feedback-collector@latest 全局启动(在控制台启动一个,之后在cursor中配置)

```json
{
  "mcpServers": {
    "mcp-feedback-collector": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

# Stagewise Toobar prompt拦截
```bash
# 在命令行窗口中启动服务(你可以自己编写脚本改为后台启动)
npx -y standalone-toolbar-service@latest
```