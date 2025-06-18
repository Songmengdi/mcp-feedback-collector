# 数据库版本控制与迁移

## 📋 概述

MCP Feedback Collector 使用 SQLite 数据库存储场景、模式和提示词配置。系统实现了完整的数据库版本控制机制，支持自动迁移和向后兼容。

- **当前数据库版本**: 2
- **版本控制表**: `db_metadata`
- **迁移策略**: 渐进式迁移，保证数据完整性
- **向后兼容**: 支持从版本1自动升级到版本2

## 🔧 版本控制机制

### 版本管理表结构
```sql
CREATE TABLE db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 存储版本信息
INSERT INTO db_metadata (key, value) VALUES ('version', '2');
```

### 版本检测逻辑
```typescript
// 检查当前版本
const versionResult = this.db.prepare('SELECT value FROM db_metadata WHERE key = ?').get('version') as { value: string } | undefined;
const currentVersion = versionResult ? parseInt(versionResult.value) : 1;

logger.info(`现有数据库版本: ${currentVersion}, 目标版本: ${this.dbVersion}`);

// 确保表结构是最新的（必须在数据迁移之前）
this.createTables();

if (currentVersion < this.dbVersion) {
  logger.info(`开始升级数据库: ${currentVersion} -> ${this.dbVersion}`);
  this.migrateDatabase(currentVersion);
}
```

## 📊 数据库表结构

### 版本2表结构（当前版本）

#### 场景表 (scenes)
```sql
CREATE TABLE IF NOT EXISTS scenes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT,
  is_default BOOLEAN NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

#### 场景模式表 (scene_modes)
```sql
CREATE TABLE IF NOT EXISTS scene_modes (
  id TEXT PRIMARY KEY,
  scene_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  shortcut TEXT,
  is_default BOOLEAN NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  default_feedback TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE
);
```

#### 场景提示词表 (scene_prompts)
```sql
CREATE TABLE IF NOT EXISTS scene_prompts (
  scene_id TEXT NOT NULL,
  mode_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scene_id, mode_id),
  FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
  FOREIGN KEY (mode_id) REFERENCES scene_modes(id) ON DELETE CASCADE
);
```

#### 版本控制表 (db_metadata)
```sql
CREATE TABLE IF NOT EXISTS db_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

## 🔄 迁移策略

### 版本1到版本2迁移

#### 迁移内容
- 引入场景化架构
- 添加 `default_feedback` 字段到场景模式
- 创建默认编码场景和三种工作模式
- 迁移现有提示词配置（如果存在）

#### 迁移代码实现
```typescript
private migrateDatabase(currentVersion: number): void {
  logger.info(`开始数据库迁移: 版本 ${currentVersion} -> ${this.dbVersion}`);
  
  try {
    if (currentVersion < 2) {
      // 从版本1迁移到版本2：引入场景化架构（包含default_feedback功能）
      logger.info('执行版本1到版本2的迁移：初始化场景化架构');
      
      // 初始化默认场景数据（如果不存在的话）
      this.initializeDefaultScenes();
    }
    
    logger.info(`数据库迁移完成: 版本 ${currentVersion} -> ${this.dbVersion}`);
  } catch (error) {
    logger.error('数据库迁移失败:', error);
    throw new MCPError(
      'Database migration failed',
      'DATABASE_MIGRATION_ERROR',
      error
    );
  }
}
```

### 新数据库初始化
```typescript
private initializeNewDatabase(): void {
  logger.info('开始初始化新数据库...');
  
  // 创建版本控制表
  this.db.exec(`
    CREATE TABLE db_metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // 创建所有表结构
  this.createTables();

  // 初始化默认场景数据
  this.initializeDefaultScenes();

  // 设置版本号为当前最新版本
  this.db.prepare('INSERT INTO db_metadata (key, value) VALUES (?, ?)').run('version', this.dbVersion.toString());
  
  logger.info(`新数据库初始化完成，版本: ${this.dbVersion}`);
}
```

## 🛡️ 数据完整性保护

### 外键约束
```sql
-- 场景模式表的外键约束
FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE

-- 场景提示词表的外键约束
FOREIGN KEY (scene_id) REFERENCES scenes(id) ON DELETE CASCADE,
FOREIGN KEY (mode_id) REFERENCES scene_modes(id) ON DELETE CASCADE
```

### 事务处理
```typescript
// 使用事务确保数据一致性
const transaction = this.db.transaction(() => {
  // 创建场景
  const sceneResult = this.db.prepare(`
    INSERT INTO scenes (id, name, description, is_default, sort_order, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(scene.id, scene.name, scene.description, isDefaultValue, scene.sortOrder, now, now);

  // 创建关联的模式
  scene.modes.forEach(mode => {
    this.db.prepare(`
      INSERT INTO scene_modes (id, scene_id, name, description, shortcut, is_default, sort_order, default_feedback, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(mode.id, scene.id, mode.name, mode.description, mode.shortcut, mode.isDefault ? 1 : 0, mode.sortOrder, mode.defaultFeedback, now, now);
  });
});

transaction();
```

## 📁 存储路径管理

### 跨平台存储路径
```typescript
private getStoragePath(): string {
  const platform = process.platform;
  let baseDir: string;

  switch (platform) {
    case 'darwin': // macOS
      baseDir = join(homedir(), '.mcp_feedback');
      break;
    case 'win32': // Windows
      baseDir = join(process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming'), 'mcp_feedback');
      break;
    default: // Linux and others
      baseDir = join(process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config'), 'mcp_feedback');
      break;
  }

  return join(baseDir, 'prompts.db');
}
```

### 目录创建
```typescript
private ensureStorageDirectory(): void {
  const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.info(`创建存储目录: ${dir}`);
  }
}
```

## 🔍 调试和监控

### 日志记录
```typescript
// 初始化日志
logger.info(`提示词数据库初始化完成: ${this.dbPath} (版本: ${this.dbVersion})`);

// 迁移日志
logger.info(`开始升级数据库: ${currentVersion} -> ${this.dbVersion}`);
logger.info(`数据库升级完成，当前版本: ${this.dbVersion}`);

// 错误日志
logger.error('提示词数据库初始化失败:', error);
```

### 性能监控
```typescript
// 数据库操作性能监控
const startTime = Date.now();
const result = this.db.prepare(query).all();
const duration = Date.now() - startTime;

if (duration > 100) {
  logger.warn(`数据库查询耗时过长: ${duration}ms, 查询: ${query}`);
}
```

## 🚀 未来版本规划

### 版本3计划功能
- 用户自定义字段支持
- 提示词版本历史
- 数据导入导出优化
- 性能索引优化

### 迁移准备
```typescript
// 为未来版本预留的迁移框架
private migrateToVersion3(): void {
  // 添加用户自定义字段表
  this.db.exec(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      field_name TEXT NOT NULL,
      field_value TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}
```

## 🧪 测试策略

### 迁移测试
```typescript
// 测试数据库迁移
describe('Database Migration', () => {
  it('should migrate from version 1 to version 2', async () => {
    // 创建版本1数据库
    const v1Database = createV1Database();
    
    // 执行迁移
    const database = new PromptDatabase();
    
    // 验证迁移结果
    expect(database.getCurrentVersion()).toBe(2);
    expect(database.getAllScenes()).toHaveLength(1); // 默认场景
  });
});
```

### 数据完整性测试
```typescript
// 测试外键约束
it('should cascade delete scene modes when scene is deleted', () => {
  const sceneId = 'test-scene';
  database.createScene({ id: sceneId, name: 'Test', description: 'Test' });
  database.createSceneMode({ id: 'test-mode', sceneId, name: 'Test Mode' });
  
  database.deleteScene(sceneId);
  
  expect(database.getSceneModes(sceneId)).toHaveLength(0);
});
```

## 🧭 相关文档

- **[提示词数据库工具](./index.md)** - 数据库工具总览
- **[场景管理系统](../../前端模块/组件/scene-management.md)** - 场景管理功能
- **[架构设计](../../../架构层/架构设计.md)** - 整体架构设计

---

*数据库版本控制文档最后更新: 2024年1月* 