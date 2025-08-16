/**
 * Lowdb适配器 - 封装lowdb操作
 */

import { join, dirname } from 'path';
import { homedir } from 'os';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { logger } from './logger.js';
import { MCPError, MIGRATION_ERROR_CODES } from '../types/index.js';
import type {
  Scene,
  SceneMode,
  ScenePrompt,
  ClearPromptRecord
} from './json-storage-types.js';

interface DatabaseSchema {
  scenes: Scene[];
  sceneModes: SceneMode[];
  scenePrompts: ScenePrompt[];
  clearPrompts: ClearPromptRecord[];
}

export class LowdbAdapter {
  private db: Low<DatabaseSchema>;
  private storagePath: string;

  constructor() {
    this.storagePath = this.getStoragePath();
    this.ensureStorageDirectory();
    
    const adapter = new JSONFile<DatabaseSchema>(this.storagePath);
    this.db = new Low<DatabaseSchema>(adapter, null as any);
    
    logger.debug(`LowdbAdapter 初始化完成，数据库路径: ${this.storagePath}`);
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

    return join(baseDir, 'lowdb.json');
  }

  /**
   * 获取遗留JSON存储路径
   */
  private getLegacyStoragePath(): string {
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
    const dir = dirname(this.storagePath);
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
   * 获取默认数据结构
   */
  private getDefaultData(): DatabaseSchema {
    return {
      scenes: [],
      sceneModes: [],
      scenePrompts: [],
      clearPrompts: []
    };
  }

  /**
   * 检查lowdb数据库文件是否存在
   */
  private checkLowdbFileExists(): boolean {
    return existsSync(this.storagePath);
  }

  /**
   * 检查遗留数据是否存在
   */
  private checkLegacyDataExists(): boolean {
    const legacyPath = this.getLegacyStoragePath();
    return existsSync(legacyPath);
  }

  /**
   * 备份遗留数据
   */
  private backupLegacyData(): boolean {
    try {
      const legacyPath = this.getLegacyStoragePath();
      const backupDir = join(dirname(legacyPath), 'backup');
      
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = join(backupDir, `prompts-backup-${timestamp}.json`);
      
      copyFileSync(legacyPath, backupPath);
      logger.info(`遗留数据已备份到: ${backupPath}`);
      return true;
    } catch (error) {
      logger.error('备份遗留数据失败:', error);
      throw new MCPError(
        'Failed to backup legacy data',
        MIGRATION_ERROR_CODES.LEGACY_DATA_BACKUP_ERROR,
        error
      );
    }
  }

  /**
   * 读取遗留JSON数据
   */
  private readLegacyData(): any {
    try {
      const legacyPath = this.getLegacyStoragePath();
      const data = JSON.parse(readFileSync(legacyPath, 'utf-8'));
      logger.debug('成功读取遗留数据文件');
      return data;
    } catch (error) {
      logger.error('读取遗留数据失败:', error);
      throw new MCPError(
        'Failed to read legacy data',
        MIGRATION_ERROR_CODES.LEGACY_DATA_READ_ERROR,
        error
      );
    }
  }

  /**
   * 转换遗留数据格式
   */
  private convertLegacyData(legacyData: any): DatabaseSchema {
    try {
      if (!legacyData || !legacyData.data) {
        return this.getDefaultData();
      }

      const { data } = legacyData;
      
      const convertedData: DatabaseSchema = {
        scenes: data.scenes || [],
        sceneModes: data.scene_modes || [],
        scenePrompts: data.scene_prompts || [],
        clearPrompts: data.clear_prompts || []
      };

      logger.debug(`数据转换完成: 场景${convertedData.scenes.length}个, 模式${convertedData.sceneModes.length}个, 提示词${convertedData.scenePrompts.length}个`);
      return convertedData;
    } catch (error) {
      logger.error('转换遗留数据失败:', error);
      throw new MCPError(
        'Failed to convert legacy data',
        MIGRATION_ERROR_CODES.DATA_CONVERSION_ERROR,
        error
      );
    }
  }

  /**
   * 验证迁移结果
   */
  private validateMigration(originalData: any, convertedData: DatabaseSchema): boolean {
    try {
      if (!originalData || !originalData.data) {
        logger.debug('迁移验证通过: 无原始数据');
        return true;
      }

      const original = originalData.data;
      const errors: string[] = [];

      // 验证场景数量
      if ((original.scenes || []).length !== convertedData.scenes.length) {
        errors.push(`场景数量不匹配: 原始${(original.scenes || []).length} vs 新${convertedData.scenes.length}`);
      }

      // 验证模式数量
      if ((original.scene_modes || []).length !== convertedData.sceneModes.length) {
        errors.push(`模式数量不匹配: 原始${(original.scene_modes || []).length} vs 新${convertedData.sceneModes.length}`);
      }

      // 验证提示词数量
      if ((original.scene_prompts || []).length !== convertedData.scenePrompts.length) {
        errors.push(`提示词数量不匹配: 原始${(original.scene_prompts || []).length} vs 新${convertedData.scenePrompts.length}`);
      }

      if (errors.length > 0) {
        const errorMsg = errors.join('; ');
        logger.error('迁移验证失败:', errorMsg);
        throw new MCPError(
          'Migration validation failed',
          MIGRATION_ERROR_CODES.MIGRATION_VALIDATION_ERROR,
          { errors }
        );
      }

      logger.info('迁移验证通过: 数据完整性检查正常');
      return true;
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      logger.error('迁移验证过程出错:', error);
      throw new MCPError(
        'Migration validation process failed',
        MIGRATION_ERROR_CODES.MIGRATION_VALIDATION_ERROR,
        error
      );
    }
  }

  /**
   * 执行数据迁移
   */
  private async performMigration(): Promise<void> {
    logger.info('开始执行数据迁移: JsonStorage → Lowdb');
    
    try {
      // 1. 备份原始数据
      this.backupLegacyData();
      
      // 2. 读取遗留数据
      const legacyData = this.readLegacyData();
      
      // 3. 转换数据格式
      const convertedData = this.convertLegacyData(legacyData);
      
      // 4. 设置数据并写入
      this.db.data = convertedData;
      await this.db.write();
      
      // 5. 验证迁移结果
      this.validateMigration(legacyData, convertedData);
      
      logger.info('数据迁移完成: JsonStorage → Lowdb');
    } catch (error) {
      logger.error('数据迁移失败:', error);
      if (error instanceof MCPError) {
        throw error;
      }
      throw new MCPError(
        'Migration process failed',
        MIGRATION_ERROR_CODES.MIGRATION_WRITE_ERROR,
        error
      );
    }
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    try {
      // 检查lowdb文件是否存在
      const lowdbExists = this.checkLowdbFileExists();
      logger.debug(`Lowdb文件存在性检查: ${lowdbExists}`);
      
      if (!lowdbExists) {
        // lowdb文件不存在，检查是否需要迁移
        const legacyExists = this.checkLegacyDataExists();
        logger.debug(`遗留数据存在性检查: ${legacyExists}`);
        
        if (legacyExists) {
          logger.info('检测到遗留数据，开始自动迁移...');
          await this.performMigration();
        } else {
          logger.debug('未检测到遗留数据，创建空数据库');
          this.db.data = this.getDefaultData();
          await this.db.write();
        }
      } else {
        // lowdb文件存在，读取现有数据
        logger.debug('Lowdb文件已存在，读取现有数据');
        await this.db.read();
        
        // 如果读取后数据为空，设置默认数据
        if (!this.db.data) {
          logger.debug('读取的数据为空，设置默认数据');
          this.db.data = this.getDefaultData();
          await this.db.write();
        }
      }
      
      logger.debug('LowdbAdapter 数据库初始化完成');
    } catch (error) {
      logger.error('LowdbAdapter 数据库初始化失败:', error);
      throw new MCPError(
        'Failed to initialize LowdbAdapter',
        'LOWDB_INIT_ERROR',
        error
      );
    }
  }

  // ===== 场景管理方法 =====

  getAllScenes(): Scene[] {
    return this.db.data?.scenes || [];
  }

  getScene(sceneId: string): Scene | null {
    return this.db.data?.scenes.find(scene => scene.id === sceneId) || null;
  }

  async createScene(scene: Scene): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      this.db.data.scenes.push(scene);
      await this.db.write();
      logger.debug(`场景已创建 (id: ${scene.id})`);
    } catch (error) {
      logger.error(`创建场景失败 (id: ${scene.id}):`, error);
      throw new MCPError(`Failed to create scene: ${scene.id}`, 'SCENE_CREATE_ERROR', { scene, error });
    }
  }

  async updateScene(sceneId: string, updates: Partial<Scene>): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      const index = this.db.data.scenes.findIndex(s => s.id === sceneId);
      if (index !== -1 && this.db.data.scenes[index]) {
        Object.assign(this.db.data.scenes[index], updates);
        await this.db.write();
        logger.debug(`场景已更新 (id: ${sceneId})`);
      } else {
        throw new Error(`Scene not found: ${sceneId}`);
      }
    } catch (error) {
      logger.error(`更新场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(`Failed to update scene: ${sceneId}`, 'SCENE_UPDATE_ERROR', { sceneId, updates, error });
    }
  }

  async deleteScene(sceneId: string): Promise<boolean> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      const initialLength = this.db.data.scenes.length;
      this.db.data.scenes = this.db.data.scenes.filter(s => s.id !== sceneId);
      
      if (this.db.data.scenes.length < initialLength) {
        await this.db.write();
        logger.debug(`场景已删除 (id: ${sceneId})`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`删除场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(`Failed to delete scene: ${sceneId}`, 'SCENE_DELETE_ERROR', { sceneId, error });
    }
  }

  // ===== 场景模式管理方法 =====

  getSceneModes(sceneId: string): SceneMode[] {
    return this.db.data?.sceneModes.filter(mode => mode.scene_id === sceneId) || [];
  }

  getSceneMode(modeId: string): SceneMode | null {
    return this.db.data?.sceneModes.find(mode => mode.id === modeId) || null;
  }

  async createSceneMode(mode: SceneMode): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      this.db.data.sceneModes.push(mode);
      await this.db.write();
      logger.debug(`场景模式已创建 (id: ${mode.id})`);
    } catch (error) {
      logger.error(`创建场景模式失败 (id: ${mode.id}):`, error);
      throw new MCPError(`Failed to create scene mode: ${mode.id}`, 'SCENE_MODE_CREATE_ERROR', { mode, error });
    }
  }

  async updateSceneMode(modeId: string, updates: Partial<SceneMode>): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      const index = this.db.data.sceneModes.findIndex(m => m.id === modeId);
      if (index !== -1 && this.db.data.sceneModes[index]) {
        Object.assign(this.db.data.sceneModes[index], updates);
        await this.db.write();
        logger.debug(`场景模式已更新 (id: ${modeId})`);
      } else {
        throw new Error(`Scene mode not found: ${modeId}`);
      }
    } catch (error) {
      logger.error(`更新场景模式失败 (id: ${modeId}):`, error);
      throw new MCPError(`Failed to update scene mode: ${modeId}`, 'SCENE_MODE_UPDATE_ERROR', { modeId, updates, error });
    }
  }

  async deleteSceneMode(modeId: string): Promise<boolean> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      const initialLength = this.db.data.sceneModes.length;
      this.db.data.sceneModes = this.db.data.sceneModes.filter(m => m.id !== modeId);
      
      if (this.db.data.sceneModes.length < initialLength) {
        await this.db.write();
        logger.debug(`场景模式已删除 (id: ${modeId})`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`删除场景模式失败 (id: ${modeId}):`, error);
      throw new MCPError(`Failed to delete scene mode: ${modeId}`, 'SCENE_MODE_DELETE_ERROR', { modeId, error });
    }
  }

  getSceneModeByShortcut(sceneId: string, shortcut: string): SceneMode | null {
    return this.db.data?.sceneModes.find(mode => 
      mode.scene_id === sceneId && mode.shortcut === shortcut
    ) || null;
  }

  async updateSceneModeShortcuts(updates: Array<{ modeId: string; shortcut: string | null }>): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      
      for (const update of updates) {
        const index = this.db.data.sceneModes.findIndex(m => m.id === update.modeId);
        if (index !== -1 && this.db.data.sceneModes[index]) {
          if (update.shortcut === null) {
            delete this.db.data.sceneModes[index].shortcut;
          } else {
            this.db.data.sceneModes[index].shortcut = update.shortcut;
          }
        }
      }
      
      await this.db.write();
      logger.debug(`批量更新场景模式快捷键完成，共更新 ${updates.length} 个`);
    } catch (error) {
      logger.error('批量更新场景模式快捷键失败:', error);
      throw new MCPError('Failed to update scene mode shortcuts', 'SCENE_MODE_SHORTCUTS_UPDATE_ERROR', { updates, error });
    }
  }

  async clearSceneDefaultModes(sceneId: string): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      
      this.db.data.sceneModes.forEach(mode => {
        if (mode.scene_id === sceneId) {
          mode.is_default = false;
        }
      });
      
      await this.db.write();
      logger.debug(`已清除场景 ${sceneId} 下所有模式的默认状态`);
    } catch (error) {
      logger.error(`清除场景默认模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to clear scene default modes: ${sceneId}`, 'SCENE_DEFAULT_MODES_CLEAR_ERROR', { sceneId, error });
    }
  }

  async clearAllScenesDefault(): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      
      this.db.data.scenes.forEach(scene => {
        scene.is_default = false;
      });
      
      await this.db.write();
      logger.debug('已清除所有场景的默认状态');
    } catch (error) {
      logger.error('清除所有场景默认状态失败:', error);
      throw new MCPError('Failed to clear all scenes default status', 'SCENES_DEFAULT_CLEAR_ERROR', { error });
    }
  }

  // ===== 场景提示词管理方法 =====

  getScenePrompt(sceneId: string, modeId: string): ScenePrompt | null {
    return this.db.data?.scenePrompts.find(
      prompt => prompt.scene_id === sceneId && prompt.mode_id === modeId
    ) || null;
  }

  async saveScenePrompt(sceneId: string, modeId: string, prompt: string): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      
      const existingIndex = this.db.data.scenePrompts.findIndex(
        p => p.scene_id === sceneId && p.mode_id === modeId
      );
      
      const now = Date.now();
      const promptData: ScenePrompt = {
        scene_id: sceneId,
        mode_id: modeId,
        prompt,
        created_at: existingIndex === -1 ? now : (this.db.data.scenePrompts[existingIndex]?.created_at || now),
        updated_at: now
      };
      
      if (existingIndex !== -1) {
        this.db.data.scenePrompts[existingIndex] = promptData;
      } else {
        this.db.data.scenePrompts.push(promptData);
      }
      
      await this.db.write();
      logger.debug(`场景提示词已保存 (sceneId: ${sceneId}, modeId: ${modeId})`);
    } catch (error) {
      logger.error(`保存场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to save scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_SAVE_ERROR', { sceneId, modeId, error });
    }
  }

  async deleteScenePrompt(sceneId: string, modeId: string): Promise<boolean> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      const initialLength = this.db.data.scenePrompts.length;
      this.db.data.scenePrompts = this.db.data.scenePrompts.filter(
        p => !(p.scene_id === sceneId && p.mode_id === modeId)
      );
      
      if (this.db.data.scenePrompts.length < initialLength) {
        await this.db.write();
        logger.debug(`场景提示词已删除 (sceneId: ${sceneId}, modeId: ${modeId})`);
        return true;
      }
      return false;
    } catch (error) {
      logger.error(`删除场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to delete scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_DELETE_ERROR', { sceneId, modeId, error });
    }
  }

  getScenePrompts(sceneId: string): ScenePrompt[] {
    return this.db.data?.scenePrompts.filter(prompt => prompt.scene_id === sceneId) || [];
  }

  // ===== 清理提示词管理方法 =====

  getClearPrompt(): { prompt_text: string } {
    const clearPrompts = this.db.data?.clearPrompts || [];
    const defaultPrompt = clearPrompts.find(p => p.is_default);
    
    if (defaultPrompt) {
      return { prompt_text: defaultPrompt.prompt_text };
    }
    
    return {
      prompt_text: `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`
    };
  }

  async saveClearPrompt(promptText: string): Promise<void> {
    try {
      await this.db.read();
      this.db.data = this.db.data || this.getDefaultData();
      
      // 找到默认清理提示词
      const existingIndex = this.db.data.clearPrompts.findIndex(p => p.is_default);
      
      const now = Date.now();
      const clearPromptData: ClearPromptRecord = {
        id: existingIndex === -1 ? 'default' : (this.db.data.clearPrompts[existingIndex]?.id || 'default'),
        user_id: 'system',
        prompt_text: promptText,
        is_default: true,
        created_at: existingIndex === -1 ? now : (this.db.data.clearPrompts[existingIndex]?.created_at || now),
        updated_at: now
      };
      
      if (existingIndex !== -1) {
        this.db.data.clearPrompts[existingIndex] = clearPromptData;
      } else {
        this.db.data.clearPrompts.push(clearPromptData);
      }
      
      await this.db.write();
      logger.debug(`清理提示词已保存: 长度=${promptText.length}`);
    } catch (error) {
      logger.error('保存清理提示词失败:', error);
      throw new MCPError('Failed to save clear prompt', 'SAVE_CLEAR_PROMPT_ERROR', error);
    }
  }

  async resetClearPrompt(): Promise<string> {
    const defaultText = `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`;
    
    try {
      await this.saveClearPrompt(defaultText);
      logger.info('清理提示词已重置为默认值');
      return defaultText;
    } catch (error) {
      logger.error('重置清理提示词失败:', error);
      return defaultText;
    }
  }

  // ===== 生命周期管理方法 =====

  async close(): Promise<void> {
    try {
      // lowdb 不需要显式关闭连接
      logger.debug('LowdbAdapter 已关闭');
    } catch (error) {
      logger.error('关闭LowdbAdapter失败:', error);
    }
  }

  getDatabasePath(): string {
    return this.storagePath;
  }
}