/**
 * 自定义提示词数据库管理器 - Lowdb存储实现
 */

import { LowdbAdapter } from './lowdb-adapter.js';
import { logger } from './logger.js';
import { MCPError } from '../types/index.js';

// 重新导出类型定义
export type { Scene, SceneMode, ScenePrompt, ClearPrompt } from './json-storage-types.js';

export class PromptDatabase {
  private storage: LowdbAdapter;

  constructor() {
    try {
      this.storage = new LowdbAdapter();
      logger.debug('PromptDatabase (Lowdb存储) 初始化完成');
    } catch (error) {
      logger.error('PromptDatabase初始化失败:', error);
      throw new MCPError(
        'Failed to initialize PromptDatabase',
        'PROMPT_DATABASE_INIT_ERROR',
        error
      );
    }
  }

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    try {
      await this.storage.initialize();
      logger.debug('PromptDatabase 初始化完成');
    } catch (error) {
      logger.error('PromptDatabase 初始化失败:', error);
      throw error;
    }
  }

  // ===== 场景管理方法 =====

  getAllScenes() {
    try {
      return this.storage.getAllScenes();
    } catch (error) {
      logger.error('获取所有场景失败:', error);
      throw new MCPError('Failed to get all scenes', 'SCENE_GET_ALL_ERROR', error);
    }
  }

  getScene(sceneId: string) {
    try {
      return this.storage.getScene(sceneId);
    } catch (error) {
      logger.error(`获取场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(`Failed to get scene: ${sceneId}`, 'SCENE_GET_ERROR', { sceneId, error });
    }
  }

  async createScene(scene: any) {
    try {
      await this.storage.createScene(scene);
      logger.debug(`场景已创建 (id: ${scene.id})`);
    } catch (error) {
      logger.error(`创建场景失败 (id: ${scene.id}):`, error);
      throw new MCPError(`Failed to create scene: ${scene.id}`, 'SCENE_CREATE_ERROR', { scene, error });
    }
  }

  async updateScene(sceneId: string, updates: any) {
    try {
      await this.storage.updateScene(sceneId, updates);
      logger.debug(`场景已更新 (id: ${sceneId})`);
    } catch (error) {
      logger.error(`更新场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(`Failed to update scene: ${sceneId}`, 'SCENE_UPDATE_ERROR', { sceneId, updates, error });
    }
  }

  async deleteScene(sceneId: string) {
    try {
      const deleted = await this.storage.deleteScene(sceneId);
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

  getSceneModes(sceneId: string) {
    try {
      return this.storage.getSceneModes(sceneId);
    } catch (error) {
      logger.error(`获取场景模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to get scene modes: ${sceneId}`, 'SCENE_MODE_GET_ERROR', { sceneId, error });
    }
  }

  getSceneMode(modeId: string) {
    try {
      return this.storage.getSceneMode(modeId);
    } catch (error) {
      logger.error(`获取场景模式失败 (id: ${modeId}):`, error);
      throw new MCPError(`Failed to get scene mode: ${modeId}`, 'SCENE_MODE_GET_ERROR', { modeId, error });
    }
  }

  async createSceneMode(mode: any) {
    try {
      await this.storage.createSceneMode(mode);
      logger.info(`场景模式创建成功: ${mode.name} (${mode.id})`);
    } catch (error) {
      logger.error('场景模式创建失败:', error);
      throw new MCPError('Failed to create scene mode', 'SCENE_MODE_CREATE_ERROR', error);
    }
  }

  async updateSceneMode(modeId: string, updates: any) {
    try {
      await this.storage.updateSceneMode(modeId, updates);
      logger.info(`场景模式更新成功: ${modeId}`);
    } catch (error) {
      logger.error('场景模式更新失败:', error);
      throw new MCPError('Failed to update scene mode', 'SCENE_MODE_UPDATE_ERROR', error);
    }
  }

  async deleteSceneMode(modeId: string) {
    try {
      const deleted = await this.storage.deleteSceneMode(modeId);
      if (deleted) {
        logger.debug(`场景模式已删除 (id: ${modeId})`);
      }
      return deleted;
    } catch (error) {
      logger.error(`删除场景模式失败 (id: ${modeId}):`, error);
      throw new MCPError(`Failed to delete scene mode: ${modeId}`, 'SCENE_MODE_DELETE_ERROR', { modeId, error });
    }
  }

  getSceneModeByShortcut(sceneId: string, shortcut: string) {
    try {
      return this.storage.getSceneModeByShortcut(sceneId, shortcut);
    } catch (error) {
      logger.error(`根据快捷键获取场景模式失败 (sceneId: ${sceneId}, shortcut: ${shortcut}):`, error);
      throw new MCPError(`Failed to get scene mode by shortcut: ${sceneId}/${shortcut}`, 'SCENE_MODE_SHORTCUT_GET_ERROR', { sceneId, shortcut, error });
    }
  }

  async updateSceneModeShortcuts(updates: Array<{ modeId: string; shortcut: string | null }>) {
    try {
      await this.storage.updateSceneModeShortcuts(updates);
      logger.debug(`批量更新场景模式快捷键完成，共更新 ${updates.length} 个`);
    } catch (error) {
      logger.error('批量更新场景模式快捷键失败:', error);
      throw new MCPError('Failed to update scene mode shortcuts', 'SCENE_MODE_SHORTCUTS_UPDATE_ERROR', { updates, error });
    }
  }

  async clearSceneDefaultModes(sceneId: string) {
    try {
      await this.storage.clearSceneDefaultModes(sceneId);
      logger.debug(`已清除场景 ${sceneId} 下所有模式的默认状态`);
    } catch (error) {
      logger.error(`清除场景默认模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to clear scene default modes: ${sceneId}`, 'SCENE_DEFAULT_MODES_CLEAR_ERROR', { sceneId, error });
    }
  }

  async clearAllScenesDefault() {
    try {
      await this.storage.clearAllScenesDefault();
      logger.debug('已清除所有场景的默认状态');
    } catch (error) {
      logger.error('清除所有场景默认状态失败:', error);
      throw new MCPError('Failed to clear all scenes default status', 'SCENES_DEFAULT_CLEAR_ERROR', { error });
    }
  }

  // ===== 场景提示词管理方法 =====

  getScenePrompt(sceneId: string, modeId: string) {
    try {
      return this.storage.getScenePrompt(sceneId, modeId);
    } catch (error) {
      logger.error(`获取场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to get scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_GET_ERROR', { sceneId, modeId, error });
    }
  }

  async saveScenePrompt(sceneId: string, modeId: string, prompt: string) {
    try {
      await this.storage.saveScenePrompt(sceneId, modeId, prompt);
      logger.debug(`场景提示词已保存 (sceneId: ${sceneId}, modeId: ${modeId})`);
    } catch (error) {
      logger.error(`保存场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to save scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_SAVE_ERROR', { sceneId, modeId, error });
    }
  }

  async deleteScenePrompt(sceneId: string, modeId: string) {
    try {
      const deleted = await this.storage.deleteScenePrompt(sceneId, modeId);
      if (deleted) {
        logger.debug(`场景提示词已删除 (sceneId: ${sceneId}, modeId: ${modeId})`);
      }
      return deleted;
    } catch (error) {
      logger.error(`删除场景提示词失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(`Failed to delete scene prompt: ${sceneId}/${modeId}`, 'SCENE_PROMPT_DELETE_ERROR', { sceneId, modeId, error });
    }
  }

  getScenePrompts(sceneId: string) {
    try {
      return this.storage.getScenePrompts(sceneId);
    } catch (error) {
      logger.error(`获取场景所有提示词失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(`Failed to get scene prompts: ${sceneId}`, 'SCENE_PROMPTS_GET_ERROR', { sceneId, error });
    }
  }

  // ===== 清理提示词管理方法 =====

  getClearPrompt() {
    try {
      return this.storage.getClearPrompt();
    } catch (error) {
      logger.error('获取清理提示词失败:', error);
      return { 
        prompt_text: `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

` 
      };
    }
  }

  async saveClearPrompt(promptText: string) {
    try {
      await this.storage.saveClearPrompt(promptText);
      logger.info(`清理提示词已保存: 长度=${promptText.length}`);
    } catch (error) {
      logger.error('保存清理提示词失败:', error);
      throw new MCPError('Failed to save clear prompt', 'SAVE_CLEAR_PROMPT_ERROR', error);
    }
  }

  async resetClearPrompt() {
    try {
      const defaultText = await this.storage.resetClearPrompt();
      logger.info('清理提示词已重置为默认值');
      return defaultText;
    } catch (error) {
      logger.error('重置清理提示词失败:', error);
      return `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`;
    }
  }

  // ===== 生命周期管理方法 =====

  async close() {
    try {
      await this.storage.close();
      logger.debug('PromptDatabase (Lowdb存储) 已关闭');
    } catch (error) {
      logger.error('关闭PromptDatabase失败:', error);
    }
  }

  /**
   * 清理缓存（已废弃）
   * Lowdb不使用缓存，此方法保留以维持API兼容性
   */
  clearCaches() {
    // Lowdb不需要缓存机制，无需执行任何操作
    logger.debug('clearCaches调用（Lowdb无缓存，无需操作）');
  }

  getDatabasePath() {
    try {
      return this.storage.getDatabasePath();
    } catch (error) {
      logger.error('获取数据库路径失败:', error);
      return '';
    }
  }
} 