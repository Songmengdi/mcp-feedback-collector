/**
 * JSON存储引擎
 * 高性能纯JSON数据存储，零native依赖
 */

import { promises as fs } from 'fs';
import { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import path from 'path';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';
import { MCPError } from '../types/index.js';
import type {
  Scene,
  SceneMode,
  ScenePrompt,
  ClearPrompt,
  ClearPromptRecord,
  JsonStorageData,
  JsonStorageMetadata,
  JsonStorageDataSection
} from './json-storage-types.js';

export class JsonStorage {
  private data: JsonStorageData;
  private storagePath: string;
  private readonly version: number = 3;
  private readonly autoSaveDelay: number = 100; // ms
  private saveTimer: NodeJS.Timeout | null = null;
  private saving: boolean = false;
  private pendingSave: boolean = false;

  // 缓存优化
  private sceneMap: Map<string, Scene> = new Map();
  private sceneModeMap: Map<string, SceneMode> = new Map();
  private promptMap: Map<string, ScenePrompt> = new Map(); // key: sceneId:modeId

  constructor() {
    this.storagePath = this.getStoragePath();
    this.ensureStorageDirectory();
    this.data = this.initializeEmptyData();
    this.loadData();
    this.rebuildCaches();
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
        baseDir = join(process.env['LOCALAPPDATA'] || join(homedir(), 'AppData', 'Local'), '.mcp_feedback');
        break;
      default: // Linux and others
        baseDir = join(process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config'), '.mcp_feedback');
        break;
    }

    return join(baseDir, 'prompts.json');
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    const dir = path.dirname(this.storagePath);
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true });
        logger.info(`创建存储目录: ${dir}`);
      } catch (error) {
        logger.error(`创建存储目录失败: ${dir}`, error);
        throw new MCPError(
          `Failed to create storage directory: ${dir}`,
          'STORAGE_DIRECTORY_CREATE_ERROR',
          error
        );
      }
    }
  }

  /**
   * 初始化空数据结构
   */
  private initializeEmptyData(): JsonStorageData {
    const now = this.now();
    return {
      version: this.version,
      metadata: {
        created_at: now,
        updated_at: now,
        backup_count: 0
      },
      data: {
        scenes: [],
        scene_modes: [],
        scene_prompts: [],
        clear_prompts: []
      }
    };
  }

  /**
   * 从文件加载数据
   */
  private loadData(): void {
    try {
      if (existsSync(this.storagePath)) {
        const content = readFileSync(this.storagePath, 'utf8');
        const parsedData = JSON.parse(content);
        this.data = this.validateData(parsedData);
        logger.info(`JSON数据加载成功: ${this.storagePath}`);
      } else {
        logger.info('JSON文件不存在，初始化默认数据');
        this.initializeDefaultData();
        this.saveToFileSync();
      }
    } catch (error) {
      logger.warn('主文件加载失败，尝试从备份恢复:', error);
      this.loadFromBackup();
    }
  }

  /**
   * 从备份文件恢复数据
   */
  private loadFromBackup(): void {
    const backupPath = this.storagePath + '.backup';
    try {
      if (existsSync(backupPath)) {
        const backupContent = readFileSync(backupPath, 'utf8');
        const backupData = JSON.parse(backupContent);
        this.data = this.validateData(backupData);
        this.saveToFileSync();
        logger.info('已从备份文件成功恢复数据');
      } else {
        logger.error('备份文件也不存在，使用默认数据');
        this.initializeDefaultData();
        this.saveToFileSync();
      }
    } catch (backupError) {
      logger.error('备份文件加载失败，使用默认数据:', backupError);
      this.initializeDefaultData();
      this.saveToFileSync();
    }
  }

  /**
   * 数据校验
   */
  private validateData(data: any): JsonStorageData {
    if (!data || typeof data !== 'object') {
      throw new MCPError('Invalid JSON data structure', 'JSON_VALIDATION_ERROR');
    }

    const { version, metadata, data: storageData } = data;

    // 版本校验
    if (typeof version !== 'number' || version < 1 || version > this.version) {
      throw new MCPError(`Unsupported data version: ${version}`, 'VERSION_MISMATCH_ERROR');
    }

    // 数据结构校验
    if (!storageData || typeof storageData !== 'object') {
      throw new MCPError('Missing or invalid data section', 'DATA_SECTION_ERROR');
    }

    const { scenes, scene_modes, scene_prompts, clear_prompts } = storageData;

    // 基础数组校验
    if (!Array.isArray(scenes)) {
      throw new MCPError('Scenes data must be an array', 'SCENES_DATA_ERROR');
    }
    if (!Array.isArray(scene_modes)) {
      throw new MCPError('Scene modes data must be an array', 'SCENE_MODES_DATA_ERROR');
    }
    if (!Array.isArray(scene_prompts)) {
      throw new MCPError('Scene prompts data must be an array', 'SCENE_PROMPTS_DATA_ERROR');
    }
    if (!Array.isArray(clear_prompts)) {
      throw new MCPError('Clear prompts data must be an array', 'CLEAR_PROMPTS_DATA_ERROR');
    }

    return data as JsonStorageData;
  }

  /**
   * 初始化默认数据
   */
  private initializeDefaultData(): void {
    const now = this.now();

    // 初始化编码场景
    const codingScene: Scene = {
      id: 'coding',
      name: '编码场景',
      description: '专门用于编程开发和代码相关工作的场景，包含探讨、编辑和搜索三种核心模式',
      icon: '💻',
      is_default: true,
      sort_order: 0,
      created_at: now,
      updated_at: now
    };

    // 初始化六种模式
    const modes: SceneMode[] = [
      {
        id: 'mode_1750303481576_1u68u7etj',
        scene_id: 'coding',
        name: '通用反馈',
        description: '不加入任何内容的继续讨论(不能进行编码)',
        shortcut: '1',
        is_default: false,
        sort_order: 0,
        created_at: now,
        updated_at: now
      },
      {
        id: 'mode_1750919642068_2r5ftbjqj',
        scene_id: 'coding',
        name: 'TO_DO_LIST',
        description: '简单性的方案制定',
        shortcut: '2',
        is_default: false,
        sort_order: 1,
        default_feedback: '根据讨论结果,以及你的新发现,开始指定方案',
        created_at: now,
        updated_at: now
      },
      {
        id: 'edit',
        scene_id: 'coding',
        name: 'EDITING',
        description: '代码修改和优化，编写具体的代码实现',
        shortcut: '3',
        is_default: false,
        sort_order: 2,
        default_feedback: '根据实施计划,完成编码',
        created_at: now,
        updated_at: now
      },
      {
        id: 'mode_1750738352748_unna8h3mh',
        scene_id: 'coding',
        name: '交互模式',
        description: '让Serena切换到交互模式',
        shortcut: '4',
        is_default: false,
        sort_order: 3,
        created_at: now,
        updated_at: now
      },
      {
        id: 'mode_1750294234725_zsiu9pg0n',
        scene_id: 'coding',
        name: '业务分析',
        description: '和用户进行问题的讨论,展示清晰地框架',
        shortcut: '5',
        is_default: false,
        sort_order: 4,
        created_at: now,
        updated_at: now
      },
      {
        id: 'mode_1751429552308_6ffmdq5dk',
        scene_id: 'coding',
        name: '更新规则',
        description: '规则更新',
        shortcut: '6',
        is_default: false,
        sort_order: 5,
        default_feedback: ' ',
        created_at: now,
        updated_at: now
      }
    ];

    // 初始化提示词
    const prompts: ScenePrompt[] = [
      {
        scene_id: 'coding',
        mode_id: 'edit',
        prompt: `注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---
成功激活的模式：editing（代码编写）

# 任务
接下来你的任务是根据用户反馈, 深入分析代码, 并编写具体的代码

# 用户反馈:
{{ feedback }}

# 代码编写步骤
step1. 查看\`.cursor/rules/when_rule_use.mdc\`,根据优先级以及你当前的编码场景,选择\`.cursor/rules\`下合适的多个规则;

step2. 对你未阅读的规则文档,进行阅读

step3. 根据用户反馈和当前方案, 确认具体的编码思路

step4. 完成代码编写,不做额外无关的个工作, 先完成全部的编码任务,这个过程中不进行错误修正

step5. 检查存在错误,统一修正

# 编码准则
- 尽可能的使用少量代码变更完成代码修改, 对于与修改无关的代码,禁止随机改动;
- 当某个具体业务代码无法立即完成时 \`// TODO\` 进行注释说明;


# 禁止事项
- 禁止提供额外的说明文档,测试文档,总结文档
- 禁止编写未完成的代码,或需要用户额外补充的代码`,
        created_at: now,
        updated_at: now
      },
      {
        scene_id: 'coding',
        mode_id: 'mode_1750294234725_zsiu9pg0n',
        prompt: `成功激活的模式：analysis（分析模式）

# 任务
你的任务是深入分析用户指定的业务逻辑部分，通过可视化图形帮助用户理解复杂的业务流程和代码结构。

# 用户反馈:
{{ feedback }}

# 核心目标
- 针对用户不理解的业务逻辑部分进行深度剖析
- 以图形化方式呈现业务流程、数据流向、模块关系
- 最小化自然语言描述，最大化图形表达效果
- 文档应聚焦于业务性质内容：如业务架构、流程、数据流转等非单一文件可说明的信息

# 分析流程

## 1. 业务逻辑识别阶段
- 快速定位用户关注的业务模块
- 识别相关的核心文件和方法
- 梳理业务流程的起点和终点

## 2. 深度代码分析阶段
- 详细查看相关代码文件的具体实现
- 追踪数据流和控制流
- 识别关键的业务规则和逻辑分支
- 使用 Markdown 链接（\`[文件名](路径#L行号)\`）引用具体代码位置，便于追溯


# 可视化表达规范

### 图表类型建议
根据业务特点选择最合适的 mermaid 图表类型：
- \`graph TD\`：用于表示流程图（推荐）
- \`sequenceDiagram\`：用于展示调用顺序
- \`classDiagram\`：用于展示类/模块关系
- \`stateDiagram\`：用于状态转换过程
- \`pie\`：用于占比分析（可选）

### 图形表达要求
- 确保 mermaid 语法正确，可直接渲染
- 节点名称简洁明了，不包含文件路径
- 连接关系清晰，标注必要的说明
- 复杂流程适当分解为多个子图
- 所有图表需配合表格提供详细的可追溯信息（如节点对应代码位置）

# 分析维度标准

## 必须分析的维度
1. **数据流向**: 输入→处理→输出的完整链路  
2. **控制流程**: 条件判断、循环、异常处理  
3. **模块依赖**: 调用关系、依赖层次  
4. **业务规则**: 验证逻辑、业务约束  
5. **状态变化**: 数据状态的转换过程  

## 分析输出要求
- 图形与表格相互对应，确保完整的可追溯性  
- 每个流程节点都能在表格中找到对应的代码位置  
- 复杂逻辑分层展示，提供从概览到细节的视图  
- 重点突出关键的业务逻辑和决策点  

# 问题与存疑点 (如果存在才给出)
...

# 禁止事项
- **禁止使用工具修改代码**
- 禁止在 mermaid 图形中包含文件路径等冗长信息
- 禁止使用无法渲染的 mermaid 语法
- 禁止遗漏关键的业务逻辑分支`,
        created_at: now,
        updated_at: now
      },
      {
        scene_id: 'coding',
        mode_id: 'mode_1750303481576_1u68u7etj',
        prompt: `**继续遵循当前激活的模式**

{{ feedback }}`,
        created_at: now,
        updated_at: now
      },
      {
        scene_id: 'coding',
        mode_id: 'mode_1750738352748_unna8h3mh',
        prompt: `成功激活的模式：interactive（交互式）

# 任务
你的任务是根据用户反馈,细化你的任务计划, 或者帮助用户解释清楚原理,代码等任何用户有疑问的内容

# 用户反馈
{{ feedback }}

# 反馈指南
- 你应该在整个任务过程中与用户进行互动,禁止做出编码动作
- 当用户要求计划变更时,查找相关信息,确认可行性; 你可以使用\`list_dir\`查看\`.memory\`目录下的记忆信息, 查看项目代码等加深代码理解;
   - 当计划确认后,使用编码工具进行\`.plan/current\`文件夹下当前计划的变更(不是创建新任务)
- 当用户对业务不清晰, 代码不清晰等任何有疑问的内容时
   - 使用markdown table, mermaid图等为用户澄清事实,提出建议

# 禁止事项
- 禁止调用工具修改用户的代码
- 禁止提供具体的代码编写内容`,
        created_at: now,
        updated_at: now
      },
      {
        scene_id: 'coding',
        mode_id: 'mode_1750919642068_2r5ftbjqj',
        prompt: `注意: 以下要求,仅在本次反馈之后有效,之后请另遵循用户指令
---
成功激活的模式：plan_to_do（检查与规划模式)

# 用户反馈
{{ feedback }}

# 任务
接下来你的任务是根据用户提供的反馈, 检查代码并给出具体的TO_DO_LIST

# 具体细则
- 该阶段禁止编码,你的核心任务为**任务规划**
- 你仅拥有 
 - 1. 项目代码检索与阅读
 - 2. 给出TO_DO_LIST
 - 3. 使用MCP服务(非\`making_code_changes\`形式)

## 步骤
### 1. 思路步骤分析
- 深度探究代码, 思考解决方案
- 查看\`.memory/model_link.md\`,阅读相关记忆,帮你快速确定业务位置
- 查看\`.cursor/rules/when_rule_use.mdc\`,根据优先级以及你当前的编码场景,选择\`.cursor/rules\`下合适的多个规则进行阅读

### 2. 是否有关于任何需求的疑问(如果有的话)
- 如遇到疑问,用户需求不清晰时,停止给出TO_DO_LIST, 需要确认的信息等,务必第一时间通过\`collect_feedback\`工具,询问用户的意见
 
### 3. 具体实施步骤
- [ ]  步骤1需要完成的内容
  - 需要具体做什么?
  - 需要具体做什么?
- [ ] 步骤2需要完成的内容
  - 需要具体做什么?
  - 需要具体做什么?
...
### 4. 询问用户TO_DO_LIST是否正确
给出实施步骤后,务必第一时间通过\`collect_feedback\`工具,询问用户的意见, 确认TO_DO_LIST是否合适,确认是否进行下一步编码

# 禁止事项
- 给出的TO_DO是关于如果一步一步变更代码的步骤,不要包含测试验证等额外的步骤
- 禁止调用工具修改用户的代码
- 禁止提供具体的代码编写内容
- 禁止给出空洞宽泛的建议
- 禁止给出需要长时间才能完成的建议`,
        created_at: now,
        updated_at: now
      },
      {
        scene_id: 'coding',
        mode_id: 'mode_1751429552308_6ffmdq5dk',
        prompt: `成功激活的模式：rule_update（规则更新模式）

# 任务
你的任务是深入分析之前你完成的任务,针对\`.cursor/rules\`下的规则进行更新

## 用户额外反馈
{{ feedback }}

## 实施细节
1. 阅读\`.cursor/rules/self_improve.mdc\`规则文件, 查看其中的详细更新规范
2. 按照规范要求, 查看现有规则(不要直接进行规则变更)
3. 为用户列出你认为需要进行规则改进的, 并第一时间通过\`collect_feedback\`工具,询问用户的意见
4. 得到用户与许可后,遵从用户的意见,进行规则的更新变动
5. 在所有规则创建或变更后, 查看\`.template/rule_use/when_rule_use_example.md\`模板, 并根据之前添加/更新的规则, 更新迭代我们的规则使用文件\`.cursor/rules/when_rule_use.mdc\``,
        created_at: now,
        updated_at: now
      }
    ];

    // 初始化默认清理提示词
    const clearPrompt: ClearPromptRecord = {
      id: this.generateId(),
      user_id: 'default',
      prompt_text: `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`,
      is_default: true,
      created_at: now,
      updated_at: now
    };

    // 设置数据
    this.data.data.scenes = [codingScene];
    this.data.data.scene_modes = modes;
    this.data.data.scene_prompts = prompts;
    this.data.data.clear_prompts = [clearPrompt];

    this.data.metadata.updated_at = now;
  }

  /**
   * 重建缓存
   */
  private rebuildCaches(): void {
    this.sceneMap.clear();
    this.sceneModeMap.clear();
    this.promptMap.clear();

    this.data.data.scenes.forEach(scene => {
      this.sceneMap.set(scene.id, scene);
    });

    this.data.data.scene_modes.forEach(mode => {
      this.sceneModeMap.set(mode.id, mode);
    });

    this.data.data.scene_prompts.forEach(prompt => {
      this.promptMap.set(`${prompt.scene_id}:${prompt.mode_id}`, prompt);
    });
  }

  /**
   * 计划保存
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveToFile().catch(error => {
        logger.error('计划保存失败:', error);
      });
    }, this.autoSaveDelay);
  }

  /**
   * 异步保存到文件
   */
  private async saveToFile(): Promise<void> {
    if (this.saving) {
      this.pendingSave = true;
      return;
    }

    this.saving = true;
    this.pendingSave = false;

    try {
      const tempPath = this.storagePath + '.tmp';
      const backupPath = this.storagePath + '.backup';

      // 更新时间戳
      this.data.metadata.updated_at = this.now();

      // 1. 写入临时文件
      await fs.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');

      // 2. 如果原文件存在，创建备份
      if (existsSync(this.storagePath)) {
        await fs.copyFile(this.storagePath, backupPath);
      }

      // 3. 原子重命名
      await fs.rename(tempPath, this.storagePath);

      logger.debug(`JSON数据已保存: ${this.storagePath}`);
    } catch (error) {
      logger.error('保存JSON数据失败:', error);
      // 清理临时文件
      try {
        await fs.unlink(this.storagePath + '.tmp');
      } catch {}
      throw error;
    } finally {
      this.saving = false;

      // 如果有待处理的保存请求，递归执行
      if (this.pendingSave) {
        setImmediate(() => this.saveToFile());
      }
    }
  }

  /**
   * 同步保存到文件
   */
  private saveToFileSync(): void {
      /**
   * 同步保存到文件
   */
    try {
      this.data.metadata.updated_at = this.now();
      
      // 添加调试信息
      logger.debug(`准备保存JSON数据到: ${this.storagePath}`);
      logger.debug(`数据结构检查: scenes=${this.data.data.scenes.length}, modes=${this.data.data.scene_modes.length}, prompts=${this.data.data.scene_prompts.length}`);
      
      // 测试JSON序列化
      const jsonString = JSON.stringify(this.data, null, 2);
      logger.debug(`JSON序列化成功，长度: ${jsonString.length}`);
      
      // 检查文件路径
      const dir = path.dirname(this.storagePath);
      logger.debug(`存储目录: ${dir}, 存在: ${existsSync(dir)}`);
      
      writeFileSync(this.storagePath, jsonString, 'utf8');
      logger.debug(`JSON数据同步保存成功: ${this.storagePath}`);
    } catch (error) {
      logger.error('同步保存JSON数据失败详情:', {
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error,
        storagePath: this.storagePath,
        dataStructure: {
          version: this.data.version,
          scenes: this.data.data.scenes.length,
          modes: this.data.data.scene_modes.length,
          prompts: this.data.data.scene_prompts.length,
          clearPrompts: this.data.data.clear_prompts.length
        }
      });
      throw error;
    }
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return randomUUID();
  }

  /**
   * 获取当前时间戳
   */
  private now(): number {
    return Date.now();
  }



  // ===== 场景管理方法 =====

  /**
   * 获取所有场景
   */
  getAllScenes(): Scene[] {
    try {
      return [...this.data.data.scenes].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
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
      return this.sceneMap.get(sceneId) || null;
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
      const now = this.now();
      const newScene: Scene = {
        ...scene,
        created_at: now,
        updated_at: now
      };

      this.data.data.scenes.push(newScene);
      this.sceneMap.set(newScene.id, newScene);
      this.scheduleSave();
      
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
      const sceneIndex = this.data.data.scenes.findIndex(s => s.id === sceneId);
      if (sceneIndex === -1) {
        throw new MCPError(`Scene not found: ${sceneId}`, 'SCENE_NOT_FOUND');
      }

      const now = this.now();
      const existingScene = this.data.data.scenes[sceneIndex];
      if (!existingScene) {
        throw new MCPError(`Scene not found: ${sceneId}`, 'SCENE_NOT_FOUND');
      }
      
      // 创建更新后的场景，处理可选属性的兼容性
      const updatedScene: Scene = {
        id: existingScene.id,
        name: updates.name !== undefined ? updates.name : existingScene.name,
        description: updates.description !== undefined ? updates.description : existingScene.description,
        is_default: updates.is_default !== undefined ? updates.is_default : existingScene.is_default,
        sort_order: updates.sort_order !== undefined ? updates.sort_order : existingScene.sort_order,
        created_at: existingScene.created_at,
        updated_at: now
      };

      // 处理可选的icon属性
      if ('icon' in updates) {
        updatedScene.icon = updates.icon;
      } else if (existingScene.icon !== undefined) {
        updatedScene.icon = existingScene.icon;
      }

      this.data.data.scenes[sceneIndex] = updatedScene;
      this.sceneMap.set(sceneId, updatedScene);
      this.scheduleSave();
      
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
      const sceneIndex = this.data.data.scenes.findIndex(s => s.id === sceneId);
      if (sceneIndex === -1) {
        return false;
      }

      // 删除相关的场景模式
      this.data.data.scene_modes = this.data.data.scene_modes.filter(m => m.scene_id !== sceneId);
      // 删除相关的提示词
      this.data.data.scene_prompts = this.data.data.scene_prompts.filter(p => p.scene_id !== sceneId);
      // 删除场景
      this.data.data.scenes.splice(sceneIndex, 1);

      // 更新缓存
      this.rebuildCaches();
      this.scheduleSave();
      
      logger.debug(`场景已删除 (id: ${sceneId})`);
      return true;
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
      return this.data.data.scene_modes
        .filter(mode => mode.scene_id === sceneId)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
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
      return this.sceneModeMap.get(modeId) || null;
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
      const now = this.now();
      const newMode: SceneMode = {
        ...mode,
        created_at: now,
        updated_at: now
      };

      this.data.data.scene_modes.push(newMode);
      this.sceneModeMap.set(newMode.id, newMode);
      this.scheduleSave();
      
      logger.info(`场景模式创建成功: ${mode.name} (${mode.id})`);
    } catch (error) {
      logger.error('场景模式创建失败:', error);
      throw new MCPError('Failed to create scene mode', 'SCENE_MODE_CREATE_ERROR', error);
    }
  }

  /**
   * 更新场景模式
   */
  updateSceneMode(modeId: string, updates: Partial<Omit<SceneMode, 'id' | 'created_at' | 'updated_at'>>): void {
    try {
      const modeIndex = this.data.data.scene_modes.findIndex(m => m.id === modeId);
      if (modeIndex === -1) {
        throw new MCPError(`Scene mode not found: ${modeId}`, 'SCENE_MODE_NOT_FOUND');
      }

      const now = this.now();
      const existingMode = this.data.data.scene_modes[modeIndex];
      if (!existingMode) {
        throw new MCPError(`Scene mode not found: ${modeId}`, 'SCENE_MODE_NOT_FOUND');
      }
      
      // 创建更新后的场景模式，处理可选属性的兼容性
      const updatedMode: SceneMode = {
        id: existingMode.id,
        scene_id: updates.scene_id !== undefined ? updates.scene_id : existingMode.scene_id,
        name: updates.name !== undefined ? updates.name : existingMode.name,
        description: updates.description !== undefined ? updates.description : existingMode.description,
        is_default: updates.is_default !== undefined ? updates.is_default : existingMode.is_default,
        sort_order: updates.sort_order !== undefined ? updates.sort_order : existingMode.sort_order,
        created_at: existingMode.created_at,
        updated_at: now
      };

      // 处理可选的shortcut属性
      if ('shortcut' in updates) {
        updatedMode.shortcut = updates.shortcut;
      } else if (existingMode.shortcut !== undefined) {
        updatedMode.shortcut = existingMode.shortcut;
      }

      // 处理可选的default_feedback属性
      if ('default_feedback' in updates) {
        updatedMode.default_feedback = updates.default_feedback;
      } else if (existingMode.default_feedback !== undefined) {
        updatedMode.default_feedback = existingMode.default_feedback;
      }

      this.data.data.scene_modes[modeIndex] = updatedMode;
      this.sceneModeMap.set(modeId, updatedMode);
      this.scheduleSave();
      
      logger.info(`场景模式更新成功: ${modeId}`);
    } catch (error) {
      logger.error('场景模式更新失败:', error);
      throw new MCPError('Failed to update scene mode', 'SCENE_MODE_UPDATE_ERROR', error);
    }
  }

  /**
   * 删除场景模式
   */
  deleteSceneMode(modeId: string): boolean {
    try {
      const modeIndex = this.data.data.scene_modes.findIndex(m => m.id === modeId);
      if (modeIndex === -1) {
        return false;
      }

      // 删除相关的提示词
      this.data.data.scene_prompts = this.data.data.scene_prompts.filter(p => p.mode_id !== modeId);
      // 删除模式
      this.data.data.scene_modes.splice(modeIndex, 1);

      // 更新缓存
      this.rebuildCaches();
      this.scheduleSave();
      
      logger.debug(`场景模式已删除 (id: ${modeId})`);
      return true;
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
      return this.data.data.scene_modes.find(mode => 
        mode.scene_id === sceneId && mode.shortcut === shortcut
      ) || null;
    } catch (error) {
      logger.error(`根据快捷键获取场景模式失败 (sceneId: ${sceneId}, shortcut: ${shortcut}):`, error);
      throw new MCPError(`Failed to get scene mode by shortcut: ${sceneId}/${shortcut}`, 'SCENE_MODE_SHORTCUT_GET_ERROR', { sceneId, shortcut, error });
    }
  }

  /**
   * 批量更新场景模式快捷键
   */
  updateSceneModeShortcuts(updates: Array<{ modeId: string; shortcut: string | null }>): void {
    try {
      const now = this.now();
      
      updates.forEach(({ modeId, shortcut }) => {
        const modeIndex = this.data.data.scene_modes.findIndex(m => m.id === modeId);
        if (modeIndex !== -1) {
          const existingMode = this.data.data.scene_modes[modeIndex];
          if (existingMode) {
            const updatedMode: SceneMode = {
              id: existingMode.id,
              scene_id: existingMode.scene_id,
              name: existingMode.name,
              description: existingMode.description,
              is_default: existingMode.is_default,
              sort_order: existingMode.sort_order,
              created_at: existingMode.created_at,
              updated_at: now
            };
            
            // 处理shortcut和default_feedback
            if (shortcut !== null) {
              updatedMode.shortcut = shortcut;
            }
            if (existingMode.default_feedback !== undefined) {
              updatedMode.default_feedback = existingMode.default_feedback;
            }
            
            this.data.data.scene_modes[modeIndex] = updatedMode;
            this.sceneModeMap.set(modeId, updatedMode);
          }
        }
      });

      this.scheduleSave();
      logger.debug(`批量更新场景模式快捷键完成，共更新 ${updates.length} 个`);
    } catch (error) {
      logger.error('批量更新场景模式快捷键失败:', error);
      throw new MCPError('Failed to update scene mode shortcuts', 'SCENE_MODE_SHORTCUTS_UPDATE_ERROR', { updates, error });
    }
  }

  /**
   * 清除场景下所有模式的默认状态
   */
  clearSceneDefaultModes(sceneId: string): void {
    try {
      const now = this.now();
      let updateCount = 0;

      this.data.data.scene_modes.forEach((mode, index) => {
        if (mode.scene_id === sceneId && mode.is_default) {
          this.data.data.scene_modes[index] = {
            ...mode,
            is_default: false,
            updated_at: now
          };
          this.sceneModeMap.set(mode.id, this.data.data.scene_modes[index]);
          updateCount++;
        }
      });

      if (updateCount > 0) {
        this.scheduleSave();
      }
      
      logger.debug(`已清除场景 ${sceneId} 下所有模式的默认状态，共更新 ${updateCount} 个`);
    } catch (error) {
      logger.error(`清除场景默认模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to clear scene default modes: ${sceneId}`, 'SCENE_DEFAULT_MODES_CLEAR_ERROR', { sceneId, error });
    }
  }

  /**
   * 清除所有场景的默认状态
   */
  clearAllScenesDefault(): void {
    try {
      const now = this.now();
      let updateCount = 0;

      this.data.data.scenes.forEach((scene, index) => {
        if (scene.is_default) {
          this.data.data.scenes[index] = {
            ...scene,
            is_default: false,
            updated_at: now
          };
          this.sceneMap.set(scene.id, this.data.data.scenes[index]);
          updateCount++;
        }
      });

      if (updateCount > 0) {
        this.scheduleSave();
      }
      
      logger.debug(`已清除所有场景的默认状态，共更新 ${updateCount} 个场景`);
    } catch (error) {
      logger.error('清除所有场景默认状态失败:', error);
      throw new MCPError('Failed to clear all scenes default status', 'SCENES_DEFAULT_CLEAR_ERROR', { error });
    }
  }

  // ===== 场景提示词管理方法 =====

  /**
   * 获取场景模式的提示词
   */
  getScenePrompt(sceneId: string, modeId: string): ScenePrompt | null {
    try {
      return this.promptMap.get(`${sceneId}:${modeId}`) || null;
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
      const now = this.now();
      const key = `${sceneId}:${modeId}`;
      const existingIndex = this.data.data.scene_prompts.findIndex(p => 
        p.scene_id === sceneId && p.mode_id === modeId
      );

      if (existingIndex !== -1) {
        // 更新现有记录
        const existingPrompt = this.data.data.scene_prompts[existingIndex];
        if (existingPrompt) {
          const updatedPrompt: ScenePrompt = {
            scene_id: existingPrompt.scene_id,
            mode_id: existingPrompt.mode_id,
            prompt,
            created_at: existingPrompt.created_at,
            updated_at: now
          };
          this.data.data.scene_prompts[existingIndex] = updatedPrompt;
          this.promptMap.set(key, updatedPrompt);
          logger.debug(`场景提示词已更新 (sceneId: ${sceneId}, modeId: ${modeId})`);
        }
      } else {
        // 插入新记录
        const newPrompt: ScenePrompt = {
          scene_id: sceneId,
          mode_id: modeId,
          prompt,
          created_at: now,
          updated_at: now
        };
        this.data.data.scene_prompts.push(newPrompt);
        this.promptMap.set(key, newPrompt);
        logger.debug(`场景提示词已创建 (sceneId: ${sceneId}, modeId: ${modeId})`);
      }

      this.scheduleSave();
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
      const promptIndex = this.data.data.scene_prompts.findIndex(p => 
        p.scene_id === sceneId && p.mode_id === modeId
      );
      
      if (promptIndex === -1) {
        return false;
      }

      this.data.data.scene_prompts.splice(promptIndex, 1);
      this.promptMap.delete(`${sceneId}:${modeId}`);
      this.scheduleSave();
      
      logger.debug(`场景提示词已删除 (sceneId: ${sceneId}, modeId: ${modeId})`);
      return true;
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
      return this.data.data.scene_prompts.filter(prompt => prompt.scene_id === sceneId);
    } catch (error) {
      logger.error(`获取场景所有提示词失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to get scene prompts: ${sceneId}`, 'SCENE_PROMPTS_GET_ERROR', { sceneId, error });
    }
  }

  // ===== 清理提示词管理方法 =====

  /**
   * 获取清理提示词
   */
  getClearPrompt(): ClearPrompt | null {
    try {
      // 1. 首先尝试获取自定义提示词（is_default = false）
      const customPrompt = this.data.data.clear_prompts
        .filter(p => !p.is_default)
        .sort((a, b) => b.updated_at - a.updated_at)[0];
      
      if (customPrompt) {
        return { prompt_text: customPrompt.prompt_text };
      }
      
      // 2. 如果没有自定义提示词，获取默认提示词（is_default = true）
      const defaultPrompt = this.data.data.clear_prompts.find(p => p.is_default);
      
      if (defaultPrompt) {
        return { prompt_text: defaultPrompt.prompt_text };
      }
      
      // 3. 如果数据库中完全没有提示词，初始化默认提示词并返回
      const defaultText = `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`;
      this.initializeDefaultClearPrompt();
      return { prompt_text: defaultText };
      
    } catch (error) {
      // 错误处理：返回硬编码的默认提示词
      logger.error('获取清理提示词失败:', error);
      return { 
        prompt_text: `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

` 
      };
    }
  }

  /**
   * 保存清理提示词
   */
  saveClearPrompt(promptText: string): void {
    try {
      const now = this.now();
      
      // 先删除所有自定义提示词（is_default = false）
      this.data.data.clear_prompts = this.data.data.clear_prompts.filter(p => p.is_default);
      
      // 插入新的自定义提示词
      const newPrompt: ClearPromptRecord = {
        id: this.generateId(),
        user_id: 'default',
        prompt_text: promptText,
        is_default: false,
        created_at: now,
        updated_at: now
      };
      
      this.data.data.clear_prompts.push(newPrompt);
      this.scheduleSave();
      
      logger.info(`清理提示词已保存: 长度=${promptText.length}`);
    } catch (error) {
      logger.error('保存清理提示词失败:', error);
      throw new MCPError('Failed to save clear prompt', 'SAVE_CLEAR_PROMPT_ERROR', error);
    }
  }

  /**
   * 重置清理提示词为默认值
   */
  resetClearPrompt(): string {
    try {
      // 1. 删除所有自定义提示词（is_default = false）
      this.data.data.clear_prompts = this.data.data.clear_prompts.filter(p => p.is_default);
      
      // 2. 确保默认提示词存在
      const defaultPrompt = this.data.data.clear_prompts.find(p => p.is_default);
      
      const defaultText = `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`;
      
      if (!defaultPrompt) {
        // 如果默认提示词不存在，重新初始化
        this.initializeDefaultClearPrompt();
      }
      
      this.scheduleSave();
      logger.info('清理提示词已重置为默认值');
      return defaultText;
      
    } catch (error) {
      logger.error('重置清理提示词失败:', error);
      // 错误时返回硬编码默认值
      return `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`;
    }
  }

  /**
   * 初始化默认清理提示词
   */
  private initializeDefaultClearPrompt(): void {
    try {
      // 检查是否已经有默认提示词（is_default = true）
      const existingDefault = this.data.data.clear_prompts.find(p => p.is_default);
      
      if (existingDefault) {
        logger.info('默认清理提示词已存在，跳过初始化');
        return;
      }

      logger.info('初始化默认清理提示词...');
      
      const now = this.now();
      const defaultPrompt: ClearPromptRecord = {
        id: this.generateId(),
        user_id: 'default',
        prompt_text: `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`,
        is_default: true,
        created_at: now,
        updated_at: now
      };
      
      this.data.data.clear_prompts.push(defaultPrompt);
      this.scheduleSave();
      
      logger.info('默认清理提示词初始化完成');
    } catch (error) {
      logger.error('初始化默认清理提示词失败:', error);
      throw new MCPError('Failed to initialize default clear prompt', 'DEFAULT_CLEAR_PROMPT_INIT_ERROR', error);
    }
  }

  // ===== 系统方法 =====

  /**
   * 关闭存储引擎
   */
  close(): void {
    try {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      
      // 确保所有数据已保存
      this.saveToFileSync();
      
      logger.debug('JSON存储引擎已关闭');
    } catch (error) {
      logger.error('关闭JSON存储引擎失败:', error);
    }
  }

  /**
   * 获取数据库路径
   */
  getDatabasePath(): string {
    return this.storagePath;
  }
} 