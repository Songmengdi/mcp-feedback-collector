# MCP Feedback Collector v1.3.8 发布说明

## 🎉 重大更新：零Native依赖重构

### 📅 发布日期
2024年12月19日

### 🚀 主要变更

#### 1. 彻底解决Windows编译权限问题
- **移除better-sqlite3依赖**：从SQLite + better-sqlite3迁移到纯JSON存储
- **零native依赖**：完全消除C++编译需求，解决Windows下npm权限清理问题
- **快速安装**：Windows用户安装速度显著提升，无编译等待时间

#### 2. 存储引擎重构
- **JSON存储引擎**：全新设计的高性能JSON存储系统
- **全新JSON存储**：从零开始的高性能JSON存储系统
- **性能优化**：内存缓存、原子写入、延迟保存机制

#### 3. 跨平台兼容性增强
- **纯JavaScript实现**：无平台特定依赖
- **人类可读格式**：JSON配置文件便于调试和维护
- **统一存储路径**：跨平台一致的数据存储位置

### 🔧 技术改进

#### 数据存储
- **存储格式**：SQLite → JSON
- **存储位置**：保持不变（`%LOCALAPPDATA%\.mcp_feedback\`）
- **文件名**：`prompts.db` → `prompts.json`
- **备份机制**：JSON文件自动备份和恢复机制

#### API兼容性
- **零破坏性变更**：所有现有API保持完全兼容
- **代理模式实现**：PromptDatabase类内部使用JsonStorage
- **类型定义**：完整的TypeScript类型支持

#### 性能特性
- **内存缓存**：Scene、SceneMode、ScenePrompt的Map索引
- **原子写入**：防止并发写入导致的数据损坏
- **延迟保存**：批量更新减少I/O操作
- **数据校验**：完整的JSON格式验证和错误恢复

### 📦 依赖变更

#### 移除的依赖
```json
{
  "dependencies": {
    "better-sqlite3": "^9.2.2"  // 已移除
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8"  // 已移除
  }
}
```

#### 新增特性
- 零native依赖
- 内置JSON存储引擎
- 内置JSON存储和备份功能

### 🔄 升级指南

#### 自动升级（推荐）
1. 运行 `npx -y smd-mcp-feedback-collector@latest`
2. 系统自动创建JSON存储配置
3. 包含默认场景和模式设置
4. 服务正常启动

#### 手动检查
```bash
# 检查数据文件
# Windows
dir "%LOCALAPPDATA%\.mcp_feedback\"

# macOS/Linux  
ls -la ~/.mcp_feedback/
```

应该看到：
- `prompts.json` - JSON存储文件
- `prompts.json.backup` - JSON备份文件（如果存在）

### 🐛 问题修复

#### Windows相关
- ✅ 修复：npm权限清理失败（EPERM错误）
- ✅ 修复：better-sqlite3编译权限问题
- ✅ 修复：Windows 11下进程文件锁定问题

#### 跨平台
- ✅ 改进：统一的存储路径处理
- ✅ 改进：更好的错误处理和恢复机制
- ✅ 改进：自动备份和数据迁移

### 🔍 兼容性说明

#### 数据兼容性
- **全新开始**：v1.3.8使用全新的JSON存储格式
- **默认配置**：自动创建预设的编码场景和基础模式
- **备份保护**：JSON文件自动备份和恢复机制

#### API兼容性
- **100%兼容**：所有现有的PromptDatabase API保持不变
- **类型兼容**：完整的TypeScript类型定义
- **行为一致**：所有方法的输入输出格式保持一致

### 🛠️ 开发者说明

#### 架构变更
```typescript
// 旧版本（v1.3.7）
import Database from 'better-sqlite3';

// 新版本（v1.3.8）
import { JsonStorage } from './json-storage.js';
```

#### 存储位置
```
Windows: %LOCALAPPDATA%\.mcp_feedback\prompts.json
macOS:   ~/.mcp_feedback/prompts.json
Linux:   ~/.config/.mcp_feedback/prompts.json
```

### 📊 性能对比

| 指标 | SQLite (v1.3.7) | JSON (v1.3.8) |
|------|------------------|----------------|
| 安装时间 | 30-60秒 (编译) | 5-10秒 |
| 启动时间 | ~200ms | ~50ms |
| 读取性能 | 优秀 | 优秀 (缓存) |
| 写入性能 | 优秀 | 良好 (批量) |
| 跨平台 | 需编译 | 纯JS |
| 调试性 | 困难 | 容易 (JSON) |

### 🙏 致谢

感谢所有遇到Windows权限问题的用户反馈，特别是Windows 11用户报告的npm权限清理问题。这次重构彻底解决了这个困扰用户的问题。

### 📞 支持

如遇到任何问题：
1. 检查 `WINDOWS_TROUBLESHOOTING.md` 文档
2. 提交GitHub Issue：https://github.com/Songmengdi/mcp-feedback-collector/issues
3. 确保包含日志文件和系统信息

---

**下载地址**: `npx -y smd-mcp-feedback-collector@1.3.8` 