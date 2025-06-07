# 🎯 MCP Feedback Collector
基于Node.js的现代化MCP反馈收集器，支持AI工作汇报和用户反馈收集。


## 新版本特性
### 三种反馈模式
- **智能默认反馈** - 三种反馈模式（探讨/编辑/搜索）提供预设反馈内容，支持零输入提交

### ✨ 用户体验增强
- **动态占位符** - 输入框实时显示当前模式的默认反馈预览
- **自动聚焦** - 页面加载和弹窗打开时自动聚焦到输入区域

### ⌨️ 快捷键支持
- **模式切换** - `Ctrl/Cmd + 1/2/3` 快速切换反馈模式
- **清空表单** - `Ctrl/Cmd + Backspace` 快速清空输入内容
- **提交反馈** - `Ctrl/Cmd + Enter` 快速提交反馈
- **跨平台适配** - 自动识别操作系统显示对应快捷键符号

### 🖼️ 图片处理优化
- **简化预览** - 移除文件名显示，优化图片预览尺寸
- **粘贴提示** - 添加图片粘贴操作说明和快捷键提示
- **布局优化** - 工具栏和提示信息横向排列，提升空间利用率

### 🎨 界面改进
- **扩展编辑区** - 自定义提示弹窗支持更大编辑空间（900px宽，350px高）
- **响应式设计** - 适配不同屏幕尺寸，支持移动端全屏显示
- **隐藏调整手柄** - 移除textarea右下角的调整大小控件

### 🔧 技术优化
- **代码重构** - 使用vue3+vite 重构前端代码
- **状态管理** - 集中管理默认反馈配置和模式状态
- **组件通信** - 优化组件间状态同步和事件传播机制


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

## 🐛 故障排除

### 常见问题
1. **course不亮绿灯**
```bash
- 检查是否安装了node,且版本> 20
- 是否 npm install 安装package, 是否使用 npm run build 构建项目

```

2. **端口被占用**
   ```bash
   # 检查端口使用情况
   netstat -an | grep :5000

   # 使用其他端口
   mcp-feedback-collector --port 5001
   ```
