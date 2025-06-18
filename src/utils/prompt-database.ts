/**
 * 自定义提示词数据库管理器
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from './logger.js';
import { MCPError } from '../types/index.js';



// ===== 新增场景化相关接口 =====

export interface Scene {
  id: string;
  name: string;
  description: string;
  icon?: string;
  is_default: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

export interface SceneMode {
  id: string;
  scene_id: string;
  name: string;
  description: string;
  shortcut?: string;
  is_default: boolean;
  sort_order: number;
  default_feedback?: string;
  created_at: number;
  updated_at: number;
}

export interface ScenePrompt {
  scene_id: string;
  mode_id: string;
  prompt: string;
  created_at: number;
  updated_at: number;
}

export class PromptDatabase {
  private db: Database.Database;
  private dbPath: string;
  private dbVersion: number = 2; // 目标版本号设为2

  constructor() {
    this.dbPath = this.getStoragePath();
    this.ensureStorageDirectory();
    // 注意：必须在检查文件存在性之前创建数据库连接
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  /**
   * 将布尔值转换为SQLite兼容的整数值
   */
  private convertBooleanForSQLite(value: boolean): number {
    return value ? 1 : 0;
  }

  /**
   * 获取跨平台存储路径
   */
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

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info(`创建存储目录: ${dir}`);
    }
  }

  /**
   * 初始化数据库表
   */
  private initializeDatabase(): void {
    try {
      // 检查是否为新数据库（文件不存在）
      const isNewDatabase = !existsSync(this.dbPath);
      
      if (isNewDatabase) {
        logger.info('检测到新数据库，执行完整初始化');
        this.initializeNewDatabase();
      } else {
        logger.info('检测到现有数据库，检查版本升级');
        this.upgradeExistingDatabase();
      }

      logger.info(`提示词数据库初始化完成: ${this.dbPath} (版本: ${this.dbVersion})`);
    } catch (error) {
      logger.error('提示词数据库初始化失败:', error);
      throw new MCPError(
        'Failed to initialize prompt database',
        'PROMPT_DATABASE_INIT_ERROR',
        error
      );
    }
  }

  /**
   * 初始化新数据库（直接创建最新版本）
   */
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

  /**
   * 升级现有数据库
   */
  private upgradeExistingDatabase(): void {
    // 确保版本控制表存在
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS db_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);

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

    // 更新版本号
    this.db.prepare('INSERT OR REPLACE INTO db_metadata (key, value) VALUES (?, ?)').run('version', this.dbVersion.toString());
    
    logger.info(`数据库升级完成，当前版本: ${this.dbVersion}`);
  }

  /**
   * 创建数据库表
   */
  private createTables(): void {
    // 新增场景表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scenes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        icon TEXT,
        is_default BOOLEAN NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    // 新增场景模式表
    this.db.exec(`
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
        FOREIGN KEY (scene_id) REFERENCES scenes (id) ON DELETE CASCADE
      )
    `);

    // 新增场景提示词表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS scene_prompts (
        scene_id TEXT NOT NULL,
        mode_id TEXT NOT NULL,
        prompt TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (scene_id, mode_id),
        FOREIGN KEY (scene_id) REFERENCES scenes (id) ON DELETE CASCADE,
        FOREIGN KEY (mode_id) REFERENCES scene_modes (id) ON DELETE CASCADE
      )
    `);

    // 创建索引以优化查询性能
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_scene_modes_scene_id ON scene_modes (scene_id);
      CREATE INDEX IF NOT EXISTS idx_scene_prompts_scene_id ON scene_prompts (scene_id);
      CREATE INDEX IF NOT EXISTS idx_scene_prompts_mode_id ON scene_prompts (mode_id);
      CREATE INDEX IF NOT EXISTS idx_scenes_sort_order ON scenes (sort_order);
      CREATE INDEX IF NOT EXISTS idx_scene_modes_sort_order ON scene_modes (sort_order);
    `);
  }

  /**
   * 数据库迁移逻辑
   */
  private migrateDatabase(currentVersion: number): void {
    logger.info(`开始数据库迁移: 版本 ${currentVersion} -> ${this.dbVersion}`);
    
    try {
      if (currentVersion < 2) {
        // 从版本1迁移到版本2：引入场景化架构（包含default_feedback功能）
        logger.info('执行版本1到版本2的迁移：初始化场景化架构');
        this.initializeDefaultScenes();
      }
      
      logger.info('数据库迁移完成');
    } catch (error) {
      logger.error('数据库迁移失败:', error);
      throw new MCPError(
        'Database migration failed',
        'DATABASE_MIGRATION_ERROR',
        error
      );
    }
  }

  /**
   * 初始化默认场景（首次启动或迁移时调用）
   */
  private initializeDefaultScenes(): void {
    try {
      // 检查是否已经有场景数据
      const existingScenes = this.db.prepare('SELECT COUNT(*) as count FROM scenes').get() as { count: number };
      if (existingScenes.count > 0) {
        logger.info('场景数据已存在，跳过初始化');
        return;
      }

      logger.info('初始化默认场景数据...');
      
      // 使用事务确保数据一致性
      const initTransaction = this.db.transaction(() => {
        this.insertDefaultScenesData();
      });
      
      initTransaction();
      logger.info('默认场景数据初始化完成');
    } catch (error) {
      logger.error('初始化默认场景失败:', error);
      throw new MCPError(
        'Failed to initialize default scenes',
        'DEFAULT_SCENES_INIT_ERROR',
        error
      );
    }
  }

  /**
   * 插入默认场景数据
   */
  private insertDefaultScenesData(): void {
    try {
      const now = Date.now();
      
      // 插入编码场景
      const insertScene = this.db.prepare(`
        INSERT INTO scenes (id, name, description, icon, is_default, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertScene.run(
        'coding',
        '编码场景',
        '专门用于编程开发和代码相关工作的场景，包含探讨、编辑和搜索三种核心模式',
        '💻',
        1, // is_default
        0, // sort_order
        now,
        now
      );

      // 插入三种模式
      const insertMode = this.db.prepare(`
        INSERT INTO scene_modes (id, scene_id, name, description, shortcut, is_default, sort_order, default_feedback, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insertMode.run('discuss', 'coding', '探讨模式', '深入分析和建议，提供具体的实施意见', '1', 1, 0, '对之前的所有过程,做一个整体的总结性的归纳,并且明确最近一段时间我们的核心聚焦点是什么,思考接下来我们需要做什么', now, now);
      insertMode.run('edit', 'coding', '编辑模式', '代码修改和优化，编写具体的代码实现', '2', 0, 1, '根据之前步骤及需求,完成编码', now, now);
      insertMode.run('search', 'coding', '搜索模式', '信息查找和检索，深度检索相关代码', '3', 0, 2, '深入研究相关代码', now, now);

      // 插入提示词
      const insertPrompt = this.db.prepare(`
        INSERT INTO scene_prompts (scene_id, mode_id, prompt, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);

      // discuss模式提示词
      const discussPrompt = `# 用户反馈
{{ feedback }}

注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---
<task>

# 任务
接下来你的任务是根据用户提供的反馈, 探讨并给出具体的实施意见

# 具体细则
- 给出的意见必须经过全局考虑
- 如果你没有深入理解代码,请先查看代码逻辑
- 对于方法的重构,必须给出完善的重构方案(考虑对现有代码的影响)
- 如遇到问题,请第一时间向用户反馈
- 该阶段禁止使用工具进行\`making_code_changes\`
- 你仅拥有 
 - 1. 项目代码检索与阅读
 - 2. 给出建议(包括执行命令的建议,不是执行命令)
 - 3. 使用MCP服务(非\`making_code_changes\`形式)

# 可用手段
1. 通过mermaid表达流程
2. 通过自然语言表达过程
3. 其他你认为合理的表达手段

# 给出意见的形式

## 当需要指导更改时
### 1. 变更理由与效果
- 明确说明为何要更改
- 详细描述更改后能达到的具体效果

### 2. 具体实施方案(必须包含以下要素)
**文件级别的具体指导:**
- 参照文件: 明确指出具体的文件路径(如: \`src/domain/user/UserService.java\`)
- 目标逻辑: 详细说明该文件中的哪个方法、哪个类、哪段逻辑需要变更
- 变更内容: 具体描述需要做出怎样的变更(但不提供具体代码)

**分步执行流程:**
- 第1步: 具体操作内容(如: 在UserService.java的createUser方法中,将验证逻辑提取到独立的Validator类)
- 第2步: 具体操作内容(如: 在domain层新建UserValidator.java,实现邮箱格式验证逻辑)
- 第3步: 具体操作内容(如: 修改UserService.createUser方法,调用UserValidator进行验证)
- ...以此类推

**流程图指导:**
- 使用mermaid绘制详细的操作流程图
- 每个节点必须包含具体的操作说明
- 标明每一步的输入、处理过程、输出

**如何测试的建议:**
- 给出测试的建议, 如果需要
- 不要轻易要求编写测试指南,测试脚本等建议,除非用户要求

## 当需要探讨时
### 1. 代码结构分析
- 详细查看必要的代码以及结构
- 给出基于具体文件和代码逻辑的探讨意见
- 必须引用具体的文件路径和方法名

### 2. 意见反思与分析
- 反思用户反馈的意见,以思辨的思维分析
- 如果认为用户意见不可取,必须:
  - 指出具体的文件和逻辑为什么不适合用户的建议
  - 提供替代方案,包含具体的文件路径和实施步骤

# 输出质量标准
## 务实性要求
- 禁止空洞宽泛的建议
- 每个建议都必须包含具体的文件路径
- 每个建议都必须说明具体的逻辑变更点
- 每个建议都必须提供分步执行流程

## 可执行性要求
- 所有步骤必须是立即可以开始的
- 每个步骤都有明确的输入和预期输出
- 复杂任务必须拆分为简单的子任务


# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**

## 必须遵循要求(强制性规则(必须遵守,非常重要))
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**

# 禁止事项
- 禁止调用工具修改用户的代码
- 禁止说教
- 禁止提供具体的代码编写内容
- 禁止给出空洞宽泛的建议
- 禁止给出需要长时间才能完成的建议`;

      // edit模式提示词
      const editPrompt = `# 用户反馈
{{ feedback }}

注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---

# 任务
接下来你的任务是根据用户指示的步骤, 深入分析代码, 并编写具体的代码

# 具体细则
- 给出的代码必须经过全局考虑
- 代码编写应当分步骤进行,不要一些做过多修改
- 先编写代码,后检查错误
- 如遇到问题,请第一时间向用户反馈
- 如需要测试,测试工作交给用户, 你直接给出测试用的命令即可

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**

## 必须遵循要求(强制性规则(必须遵守,非常重要))
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**

# 禁止行为
- 禁止执行terminal命令,而是给出命令,由用户运行
- 禁止编写测试脚本,测试说明,使用指南等信息,除非用户明确指出`;

      // search模式提示词
      const searchPrompt = `# 用户反馈
{{ feedback }}

注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---

# 任务
接下来你的任务是根据用户提供的反馈, 深度检索相关代码, 了解有关问题的各类信息

# 可用检索手段
1. 检索项目中相关文件目录结构,文件内容(通过提供的各类搜索手段)
2. 使用 web工具 从网络中检索相关信息(当你认为有必要时)

# 可用展示手段
1. 通过mermaid表达流程
2. 通过自然语言表达过程
3. 其他你认为合理的表达手段

**流程图指导:**
- 使用mermaid绘制详细的操作流程图
- 每个节点必须包含具体的操作说明
- 标明每一步的输入、处理过程、输出

### 3. 立即可执行性要求
- 所有建议必须是当下立即可以开始处理的
- 每个步骤的执行时间不超过30分钟
- 如果某个变更需要较长时间,必须将其拆分为多个可立即执行的小步骤

## 当需要探讨时
### 1. 代码结构分析
- 详细查看必要的代码以及结构
- 给出基于具体文件和代码逻辑的探讨意见
- 必须引用具体的文件路径和方法名

### 2. 意见反思与分析
- 反思用户反馈的意见,以思辨的思维分析
- 如果认为用户意见不可取,必须:
  - 指出具体的文件和逻辑为什么不适合用户的建议
  - 提供替代方案,包含具体的文件路径和实施步骤

# 输出质量标准
## 务实性要求
- 禁止空洞宽泛的建议
- 每个建议都必须包含具体的文件路径
- 每个建议都必须说明具体的逻辑变更点
- 每个建议都必须提供分步执行流程

## 可执行性要求
- 所有步骤必须是立即可以开始的
- 每个步骤都有明确的输入和预期输出
- 复杂任务必须拆分为简单的子任务




# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**

## 必须遵循要求(强制性规则(必须遵守,非常重要))
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**



# 禁止事项
- 禁止调用工具修改用户的代码
- 禁止说教
- 禁止提供具体的代码编写内容
- 禁止给出空洞宽泛的建议
- 禁止给出需要长时间才能完成的建议`;

      insertPrompt.run('coding', 'discuss', discussPrompt, now, now);
      insertPrompt.run('coding', 'edit', editPrompt, now, now);
      insertPrompt.run('coding', 'search', searchPrompt, now, now);

      logger.info('默认场景数据初始化完成');
    } catch (error) {
      logger.error('初始化默认场景失败:', error);
      throw new MCPError(
        'Failed to initialize default scenes',
        'DEFAULT_SCENES_INIT_ERROR',
        error
      );
    }
  }

  // ===== 场景管理方法 =====

  /**
   * 获取所有场景
   */
  getAllScenes(): Scene[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM scenes ORDER BY sort_order, name');
      return stmt.all() as Scene[];
    } catch (error) {
      logger.error('获取所有场景失败:', error);
      throw new MCPError('Failed to get all scenes', 'SCENE_GET_ALL_ERROR', error);
    }
  }

  /**
   * 根据ID获取场景
   */
  getScene(sceneId: string): Scene | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM scenes WHERE id = ?');
      const result = stmt.get(sceneId) as Scene | undefined;
      return result || null;
    } catch (error) {
      logger.error(`获取场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(`Failed to get scene: ${sceneId}`, 'SCENE_GET_ERROR', { sceneId, error });
    }
  }

  /**
   * 创建场景
   */
  createScene(scene: Omit<Scene, 'created_at' | 'updated_at'>): void {
    try {
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO scenes (id, name, description, icon, is_default, sort_order, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      // 将布尔值转换为整数值以兼容SQLite
      const isDefaultValue = this.convertBooleanForSQLite(scene.is_default);
      stmt.run(scene.id, scene.name, scene.description, scene.icon, isDefaultValue, scene.sort_order, now, now);
      logger.debug(`场景已创建 (id: ${scene.id})`);
    } catch (error) {
      logger.error(`创建场景失败 (id: ${scene.id}):`, error);
      throw new MCPError(`Failed to create scene: ${scene.id}`, 'SCENE_CREATE_ERROR', { scene, error });
    }
  }

  /**
   * 更新场景
   */
  updateScene(sceneId: string, updates: Partial<Omit<Scene, 'id' | 'created_at' | 'updated_at'>>): void {
    try {
      const now = Date.now();
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      
      // 处理布尔值转换
      const values = Object.values(updates).map((value, index) => {
        const key = Object.keys(updates)[index];
        if (key === 'is_default' && typeof value === 'boolean') {
          return this.convertBooleanForSQLite(value);
        }
        return value;
      });
      
      const stmt = this.db.prepare(`UPDATE scenes SET ${fields}, updated_at = ? WHERE id = ?`);
      stmt.run(...values, now, sceneId);
      logger.debug(`场景已更新 (id: ${sceneId})`);
    } catch (error) {
      logger.error(`更新场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(`Failed to update scene: ${sceneId}`, 'SCENE_UPDATE_ERROR', { sceneId, updates, error });
    }
  }

  /**
   * 删除场景
   */
  deleteScene(sceneId: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM scenes WHERE id = ?');
      const result = stmt.run(sceneId);
      const deleted = result.changes > 0;
      
      if (deleted) {
        logger.debug(`场景已删除 (id: ${sceneId})`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`删除场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(`Failed to delete scene: ${sceneId}`, 'SCENE_DELETE_ERROR', { sceneId, error });
    }
  }

  // ===== 场景模式管理方法 =====

  /**
   * 获取场景下的所有模式
   */
  getSceneModes(sceneId: string): SceneMode[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM scene_modes WHERE scene_id = ? ORDER BY sort_order, name');
      return stmt.all(sceneId) as SceneMode[];
    } catch (error) {
      logger.error(`获取场景模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to get scene modes: ${sceneId}`, 'SCENE_MODE_GET_ERROR', { sceneId, error });
    }
  }

  /**
   * 根据ID获取场景模式
   */
  getSceneMode(modeId: string): SceneMode | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM scene_modes WHERE id = ?');
      const result = stmt.get(modeId) as SceneMode | undefined;
      return result || null;
    } catch (error) {
      logger.error(`获取场景模式失败 (id: ${modeId}):`, error);
      throw new MCPError(`Failed to get scene mode: ${modeId}`, 'SCENE_MODE_GET_ERROR', { modeId, error });
    }
  }

  /**
   * 创建场景模式
   */
  createSceneMode(mode: Omit<SceneMode, 'created_at' | 'updated_at'>): void {
    try {
      const now = Date.now();
      const stmt = this.db.prepare(`
        INSERT INTO scene_modes (
          id, scene_id, name, description, shortcut, is_default, sort_order, default_feedback, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        mode.id,
        mode.scene_id,
        mode.name,
        mode.description,
        mode.shortcut || null,
        this.convertBooleanForSQLite(mode.is_default),
        mode.sort_order,
        mode.default_feedback || null,
        now,
        now
      );
      
      logger.info(`场景模式创建成功: ${mode.name} (${mode.id})`);
    } catch (error) {
      logger.error('场景模式创建失败:', error);
      throw new MCPError(
        'Failed to create scene mode',
        'SCENE_MODE_CREATE_ERROR',
        error
      );
    }
  }

  /**
   * 更新场景模式
   */
  updateSceneMode(modeId: string, updates: Partial<Omit<SceneMode, 'id' | 'created_at' | 'updated_at'>>): void {
    try {
      const fields = [];
      const values = [];
      
      if (updates.scene_id !== undefined) {
        fields.push('scene_id = ?');
        values.push(updates.scene_id);
      }
      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.shortcut !== undefined) {
        fields.push('shortcut = ?');
        values.push(updates.shortcut || null);
      }
      if (updates.is_default !== undefined) {
        fields.push('is_default = ?');
        values.push(this.convertBooleanForSQLite(updates.is_default));
      }
      if (updates.sort_order !== undefined) {
        fields.push('sort_order = ?');
        values.push(updates.sort_order);
      }
      if (updates.default_feedback !== undefined) {
        fields.push('default_feedback = ?');
        values.push(updates.default_feedback || null);
      }
      
      if (fields.length === 0) {
        return; // 没有需要更新的字段
      }
      
      fields.push('updated_at = ?');
      values.push(Date.now());
      values.push(modeId);
      
      const sql = `UPDATE scene_modes SET ${fields.join(', ')} WHERE id = ?`;
      const result = this.db.prepare(sql).run(...values);
      
      if (result.changes === 0) {
        throw new MCPError(
          `Scene mode not found: ${modeId}`,
          'SCENE_MODE_NOT_FOUND'
        );
      }
      
      logger.info(`场景模式更新成功: ${modeId}`);
    } catch (error) {
      logger.error('场景模式更新失败:', error);
      throw new MCPError(
        'Failed to update scene mode',
        'SCENE_MODE_UPDATE_ERROR',
        error
      );
    }
  }

  /**
   * 删除场景模式
   */
  deleteSceneMode(modeId: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM scene_modes WHERE id = ?');
      const result = stmt.run(modeId);
      const deleted = result.changes > 0;
      
      if (deleted) {
        logger.debug(`场景模式已删除 (id: ${modeId})`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`删除场景模式失败 (id: ${modeId}):`, error);
      throw new MCPError(`Failed to delete scene mode: ${modeId}`, 'SCENE_MODE_DELETE_ERROR', { modeId, error });
    }
  }

  /**
   * 根据快捷键获取场景模式
   */
  getSceneModeByShortcut(sceneId: string, shortcut: string): SceneMode | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM scene_modes WHERE scene_id = ? AND shortcut = ?');
      const result = stmt.get(sceneId, shortcut) as SceneMode | undefined;
      return result || null;
    } catch (error) {
      logger.error(`根据快捷键获取场景模式失败 (sceneId: ${sceneId}, shortcut: ${shortcut}):`, error);
      throw new MCPError(`Failed to get scene mode by shortcut: ${sceneId}/${shortcut}`, 'SCENE_MODE_GET_BY_SHORTCUT_ERROR', { sceneId, shortcut, error });
    }
  }

  /**
   * 批量更新场景模式快捷键
   */
  updateSceneModeShortcuts(updates: Array<{ modeId: string; shortcut: string | null }>): void {
    try {
      const now = Date.now();
      const stmt = this.db.prepare('UPDATE scene_modes SET shortcut = ?, updated_at = ? WHERE id = ?');
      
      // 使用事务确保数据一致性
      const transaction = this.db.transaction(() => {
        for (const update of updates) {
          stmt.run(update.shortcut, now, update.modeId);
        }
      });
      
      transaction();
      logger.debug(`批量更新场景模式快捷键完成，共更新 ${updates.length} 个模式`);
    } catch (error) {
      logger.error('批量更新场景模式快捷键失败:', error);
      throw new MCPError('Failed to update scene mode shortcuts', 'SCENE_MODE_SHORTCUTS_UPDATE_ERROR', { updates, error });
    }
  }

  /**
   * 清除指定场景下所有模式的默认状态
   */
  clearSceneDefaultModes(sceneId: string): void {
    try {
      const now = Date.now();
      const stmt = this.db.prepare('UPDATE scene_modes SET is_default = 0, updated_at = ? WHERE scene_id = ?');
      stmt.run(now, sceneId);
      logger.debug(`已清除场景 ${sceneId} 下所有模式的默认状态`);
    } catch (error) {
      logger.error(`清除场景默认模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to clear scene default modes: ${sceneId}`, 'SCENE_DEFAULT_MODES_CLEAR_ERROR', { sceneId, error });
    }
  }

  // ===== 场景提示词管理方法 =====

  /**
   * 获取场景模式的提示词
   */
  getScenePrompt(sceneId: string, modeId: string): ScenePrompt | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM scene_prompts WHERE scene_id = ? AND mode_id = ?');
      const result = stmt.get(sceneId, modeId) as ScenePrompt | undefined;
      return result || null;
    } catch (error) {
      logger.error(`获取场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to get scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_GET_ERROR', { sceneId, modeId, error });
    }
  }

  /**
   * 保存场景提示词
   */
  saveScenePrompt(sceneId: string, modeId: string, prompt: string): void {
    try {
      const now = Date.now();
      const existing = this.getScenePrompt(sceneId, modeId);

      if (existing) {
        // 更新现有记录
        const stmt = this.db.prepare('UPDATE scene_prompts SET prompt = ?, updated_at = ? WHERE scene_id = ? AND mode_id = ?');
        stmt.run(prompt, now, sceneId, modeId);
        logger.debug(`场景提示词已更新 (sceneId: ${sceneId}, modeId: ${modeId})`);
      } else {
        // 插入新记录
        const stmt = this.db.prepare('INSERT INTO scene_prompts (scene_id, mode_id, prompt, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
        stmt.run(sceneId, modeId, prompt, now, now);
        logger.debug(`场景提示词已创建 (sceneId: ${sceneId}, modeId: ${modeId})`);
      }
    } catch (error) {
      logger.error(`保存场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to save scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_SAVE_ERROR', { sceneId, modeId, error });
    }
  }

  /**
   * 删除场景提示词
   */
  deleteScenePrompt(sceneId: string, modeId: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM scene_prompts WHERE scene_id = ? AND mode_id = ?');
      const result = stmt.run(sceneId, modeId);
      const deleted = result.changes > 0;
      
      if (deleted) {
        logger.debug(`场景提示词已删除 (sceneId: ${sceneId}, modeId: ${modeId})`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`删除场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to delete scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_DELETE_ERROR', { sceneId, modeId, error });
    }
  }

  /**
   * 获取场景的所有提示词
   */
  getScenePrompts(sceneId: string): ScenePrompt[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM scene_prompts WHERE scene_id = ?');
      return stmt.all(sceneId) as ScenePrompt[];
    } catch (error) {
      logger.error(`获取场景所有提示词失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to get scene prompts: ${sceneId}`, 'SCENE_PROMPTS_GET_ERROR', { sceneId, error });
    }
  }



  /**
   * 关闭数据库连接
   */
  close(): void {
    try {
      this.db.close();
      logger.debug('提示词数据库连接已关闭');
    } catch (error) {
      logger.error('关闭提示词数据库连接失败:', error);
    }
  }

  /**
   * 获取数据库路径
   */
  getDatabasePath(): string {
    return this.dbPath;
  }
} 