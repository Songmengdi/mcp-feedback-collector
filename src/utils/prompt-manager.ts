/**
 * 提示词管理服务
 */

import { PromptDatabase, Scene, SceneMode, ScenePrompt } from './prompt-database.js';
import { logger } from './logger.js';
import { MCPError, SceneRequest, SceneModeRequest } from '../types/index.js';

export interface PromptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PromptApplyResult {
  success: boolean;
  appliedPrompt: string;
  mode: string;
  scene?: string;
  timestamp: number;
}

// 新增场景相关接口
export interface SceneDetails {
  id: string;
  name: string;
  description: string;
  modes: SceneModeDetails[];
  createdAt: number;
  updatedAt: number;
}

export interface SceneModeDetails {
  id: string;
  name: string;
  description: string;
  hasScenePrompt: boolean;
  hasDefaultPrompt: boolean;
}

export interface SceneConfig {
  scenes: Scene[];
  sceneModes: SceneMode[];
  scenePrompts: ScenePrompt[];
}

export class PromptManager {
  private database: PromptDatabase;

  constructor() {
    this.database = new PromptDatabase();
  }



  // 传统模式支持已移除，统一使用场景化API

  // 传统提示词管理方法已移除，统一使用场景化API

  /**
   * 验证提示词内容
   */
  validatePrompt(prompt: string): PromptValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 基本验证
    if (!prompt || prompt.trim().length === 0) {
      errors.push('提示词不能为空');
    }

    if (prompt.length < 10) {
      warnings.push('提示词内容较短，可能不够详细');
    }

    if (prompt.length > 10000) {
      warnings.push('提示词内容较长，可能影响性能');
    }

    // 检查是否包含基本结构
    if (!prompt.includes('#') && !prompt.includes('-')) {
      warnings.push('建议使用Markdown格式组织提示词内容');
    }

    // 检查潜在的格式问题
    if (prompt.includes('\t')) {
      warnings.push('建议使用空格而不是制表符进行缩进');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  // 传统应用提示词方法已移除，使用applyScenePrompt方法

  /**
   * 重置到默认提示词
   */
  // 传统导入导出方法已移除，统一使用场景化API

  /**
   * 关闭管理器
   */
  close(): void {
    try {
      this.database.close();
      logger.debug('提示词管理器已关闭');
    } catch (error) {
      logger.error('关闭提示词管理器失败:', error);
    }
  }

  /**
   * 获取数据库路径
   */
  getDatabasePath(): string {
    return this.database.getDatabasePath();
  }

  // ================== 场景管理方法 ==================

  /**
   * 获取所有场景
   */
  getAllScenes(): Scene[] {
    try {
      return this.database.getAllScenes();
    } catch (error) {
      logger.error('获取所有场景失败:', error);
      throw new MCPError(
        'Failed to get all scenes',
        'SCENE_GET_ERROR',
        error
      );
    }
  }

  /**
   * 根据ID获取场景
   */
  getSceneById(sceneId: string): Scene | null {
    try {
      return this.database.getScene(sceneId);
    } catch (error) {
      logger.error(`获取场景失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(
        `Failed to get scene: ${sceneId}`,
        'SCENE_GET_ERROR',
        { sceneId, error }
      );
    }
  }

  /**
   * 根据ID获取场景详情
   */
  getSceneDetails(sceneId: string): SceneDetails | null {
    try {
      const scene = this.database.getScene(sceneId);
      if (!scene) {
        return null;
      }

      const modes = this.database.getSceneModes(sceneId);
      const modeDetails: SceneModeDetails[] = modes.map(mode => {
        const scenePrompt = this.database.getScenePrompt(sceneId, mode.id);
        
        return {
          id: mode.id,
          name: mode.name,
          description: mode.description,
          hasScenePrompt: !!scenePrompt,
          hasDefaultPrompt: false // 不再依赖默认提示词文件
        };
      });

      return {
        id: scene.id,
        name: scene.name,
        description: scene.description,
        modes: modeDetails,
        createdAt: scene.created_at,
        updatedAt: scene.updated_at
      };
    } catch (error) {
      logger.error(`获取场景详情失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(
        `Failed to get scene details: ${sceneId}`,
        'SCENE_GET_ERROR',
        { sceneId, error }
      );
    }
  }

  /**
   * 创建新场景
   */
  createScene(sceneRequest: SceneRequest): Scene {
    try {
      logger.debug('接收到场景创建请求:', sceneRequest);
      
      // 验证必要字段
      if (!sceneRequest.name || !sceneRequest.description) {
        throw new MCPError(
          'Scene name and description are required',
          'INVALID_SCENE_REQUEST',
          { sceneRequest }
        );
      }

      // 如果要设置为默认场景，先清除所有场景的默认状态
      if (sceneRequest.isDefault === true) {
        logger.debug('设置为默认场景 - 先清除所有场景的默认状态');
        this.database.clearAllScenesDefault();
      }

      const now = Date.now();
      const sceneData = {
        id: `scene_${now}_${Math.random().toString(36).substr(2, 9)}`,
        name: sceneRequest.name,
        description: sceneRequest.description,
        icon: sceneRequest.icon || '📁',
        is_default: sceneRequest.isDefault || false,  // 驼峰转下划线
        sort_order: sceneRequest.sortOrder || 999     // 驼峰转下划线
      };
      
      logger.debug('准备存储的场景数据:', sceneData);
      this.database.createScene(sceneData);
      
      // 返回完整的场景对象（保持数据库格式）
      const scene: Scene = {
        id: sceneData.id,
        name: sceneData.name,
        description: sceneData.description,
        icon: sceneData.icon,
        is_default: sceneData.is_default,
        sort_order: sceneData.sort_order,
        created_at: now,
        updated_at: now
      };
      
      logger.info(`场景已创建 (id: ${scene.id}, name: ${sceneRequest.name})`);
      return scene;
    } catch (error) {
      logger.error(`创建场景失败 (name: ${sceneRequest.name}):`, error);
      throw new MCPError(
        `Failed to create scene: ${sceneRequest.name}`,
        'SCENE_CREATE_ERROR',
        { sceneRequest, error }
      );
    }
  }

  /**
   * 更新场景
   */
  updateScene(sceneId: string, sceneRequest: Partial<SceneRequest>): Scene | null {
    try {
      logger.debug('接收到场景更新请求:', { sceneId, sceneRequest });
      
      // 如果要设置为默认场景，先清除所有场景的默认状态
      if (sceneRequest.isDefault === true) {
        logger.debug('设置为默认场景 - 先清除所有场景的默认状态');
        this.database.clearAllScenesDefault();
      }
      
      // 构建更新数据，转换驼峰命名为下划线命名
      const updateData: any = {};
      if (sceneRequest.name !== undefined) updateData.name = sceneRequest.name;
      if (sceneRequest.description !== undefined) updateData.description = sceneRequest.description;
      if (sceneRequest.icon !== undefined) updateData.icon = sceneRequest.icon;
      if (sceneRequest.isDefault !== undefined) updateData.is_default = sceneRequest.isDefault;
      if (sceneRequest.sortOrder !== undefined) updateData.sort_order = sceneRequest.sortOrder;
      
      logger.debug('准备更新的场景数据:', updateData);
      this.database.updateScene(sceneId, updateData);
      logger.info(`场景已更新 (id: ${sceneId})`);
      
      // 返回更新后的场景对象
      return this.database.getScene(sceneId);
    } catch (error) {
      logger.error(`更新场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(
        `Failed to update scene: ${sceneId}`,
        'SCENE_UPDATE_ERROR',
        { sceneId, sceneRequest, error }
      );
    }
  }

  /**
   * 删除场景
   */
  deleteScene(sceneId: string): boolean {
    try {
      const deleted = this.database.deleteScene(sceneId);
      if (deleted) {
        logger.info(`场景已删除 (id: ${sceneId})`);
      } else {
        logger.warn(`场景不存在 (id: ${sceneId})`);
      }
      return deleted;
    } catch (error) {
      logger.error(`删除场景失败 (id: ${sceneId}):`, error);
      throw new MCPError(
        `Failed to delete scene: ${sceneId}`,
        'SCENE_DELETE_ERROR',
        { sceneId, error }
      );
    }
  }

  /**
   * 获取场景的所有模式
   */
  getSceneModes(sceneId: string): SceneMode[] {
    try {
      return this.database.getSceneModes(sceneId);
    } catch (error) {
      logger.error(`获取场景模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(
        `Failed to get scene modes: ${sceneId}`,
        'SCENE_MODE_GET_ERROR',
        { sceneId, error }
      );
    }
  }

  /**
   * 为场景添加模式
   */
  addSceneMode(sceneId: string, modeRequest: SceneModeRequest): SceneMode {
    try {
      logger.debug('接收到场景模式创建请求:', { sceneId, modeRequest });
      
      // 验证必要字段
      if (!modeRequest.name || !modeRequest.description) {
        throw new MCPError(
          'Mode name and description are required',
          'INVALID_MODE_REQUEST',
          { sceneId, modeRequest }
        );
      }

      // 如果要设置为默认模式，先清除同场景下其他模式的默认状态
      if (modeRequest.isDefault) {
        logger.debug(`设置为默认模式 - 先清除场景 ${sceneId} 下所有模式的默认状态`);
        this.database.clearSceneDefaultModes(sceneId);
      }

      const now = Date.now();
      const modeData = {
        id: `mode_${now}_${Math.random().toString(36).substr(2, 9)}`,
        scene_id: sceneId,
        name: modeRequest.name,
        description: modeRequest.description,
        shortcut: modeRequest.shortcut || '',
        is_default: modeRequest.isDefault || false,
        sort_order: modeRequest.sortOrder || 999,
        default_feedback: modeRequest.defaultFeedback || ''
      };
      
      logger.debug('准备存储的模式数据:', modeData);
      this.database.createSceneMode(modeData);
      
      // 返回完整的模式对象（保持数据库格式）
      const mode: SceneMode = {
        id: modeData.id,
        scene_id: modeData.scene_id,
        name: modeData.name,
        description: modeData.description,
        shortcut: modeData.shortcut,
        is_default: modeData.is_default,
        sort_order: modeData.sort_order,
        default_feedback: modeData.default_feedback,
        created_at: now,
        updated_at: now
      };
      
      logger.info(`场景模式已添加 (sceneId: ${sceneId}, modeId: ${mode.id})`);
      return mode;
    } catch (error) {
      logger.error(`添加场景模式失败 (sceneId: ${sceneId}):`, error);
      throw new MCPError(
        `Failed to add scene mode: ${sceneId}`,
        'SCENE_MODE_CREATE_ERROR',
        { sceneId, modeRequest, error }
      );
    }
  }

  /**
   * 更新场景模式
   */
  updateSceneMode(sceneId: string, modeId: string, modeRequest: Partial<SceneModeRequest>): SceneMode | null {
    try {
      logger.debug('接收到场景模式更新请求:', { sceneId, modeId, modeRequest });
      
      // 如果更新了默认状态，采用"先清零再设置"的策略
      if (modeRequest.isDefault !== undefined) {
        logger.debug(`更新默认状态 - 先清除场景 ${sceneId} 下所有模式的默认状态`);
        this.database.clearSceneDefaultModes(sceneId);
      }
      
      // 构建更新数据，只包含提供的字段
      const updateData: any = {};
      if (modeRequest.name !== undefined) updateData.name = modeRequest.name;
      if (modeRequest.description !== undefined) updateData.description = modeRequest.description;
      if (modeRequest.shortcut !== undefined) updateData.shortcut = modeRequest.shortcut;
      if (modeRequest.isDefault !== undefined) updateData.is_default = modeRequest.isDefault;
      if (modeRequest.sortOrder !== undefined) updateData.sort_order = modeRequest.sortOrder;
      if (modeRequest.defaultFeedback !== undefined) updateData.default_feedback = modeRequest.defaultFeedback;
      
      logger.debug('准备更新的模式数据:', updateData);
      this.database.updateSceneMode(modeId, updateData);
      logger.info(`场景模式已更新 (sceneId: ${sceneId}, modeId: ${modeId})`);
      
      // 返回更新后的模式对象
      return this.database.getSceneMode(modeId);
    } catch (error) {
      logger.error(`更新场景模式失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(
        `Failed to update scene mode: ${sceneId}:${modeId}`,
        'SCENE_MODE_UPDATE_ERROR',
        { sceneId, modeId, modeRequest, error }
      );
    }
  }

  /**
   * 删除场景模式
   */
  deleteSceneMode(sceneId: string, modeId: string): boolean {
    try {
      this.database.deleteSceneMode(modeId);
      logger.info(`场景模式已删除 (sceneId: ${sceneId}, modeId: ${modeId})`);
      return true;
    } catch (error) {
      logger.error(`删除场景模式失败 (sceneId: ${sceneId}, modeId: ${modeId}):`, error);
      throw new MCPError(
        `Failed to delete scene mode: ${sceneId}:${modeId}`,
        'SCENE_MODE_DELETE_ERROR',
        { sceneId, modeId, error }
      );
    }
  }

  /**
   * 获取场景提示词
   */
  getScenePrompt(sceneId: string, modeId: string): string | null {
    try {
      // 直接从数据库获取场景提示词
      const scenePrompt = this.database.getScenePrompt(sceneId, modeId);
      if (scenePrompt) {
        logger.debug(`使用场景提示词 (scene: ${sceneId}, mode: ${modeId})`);
        return scenePrompt.prompt;
      }

      logger.warn(`未找到场景提示词 (scene: ${sceneId}, mode: ${modeId}), 返回通用模板`);
      
      // 返回通用默认模板
      const genericTemplate = `# 用户反馈
{{ feedback }}

# 任务
请根据用户反馈进行相应的处理和回应。

# 说明
这是一个通用的提示词模板，您可以根据具体需求进行修改和完善。

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈。

## 必须遵循要求
- 每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。`;

      return genericTemplate;
    } catch (error) {
      logger.error(`获取场景提示词失败 (scene: ${sceneId}, mode: ${modeId}):`, error);
      throw new MCPError(
        `Failed to get scene prompt: ${sceneId}:${modeId}`,
        'SCENE_PROMPT_GET_ERROR',
        { sceneId, modeId, error }
      );
    }
  }

  /**
   * 保存场景提示词
   */
  saveScenePrompt(sceneId: string, modeId: string, prompt: string): void {
    try {
      // 验证提示词
      const validation = this.validatePrompt(prompt);
      if (!validation.isValid) {
        throw new MCPError(
          `Invalid prompt: ${validation.errors.join(', ')}`,
          'PROMPT_VALIDATION_ERROR',
          { sceneId, modeId, errors: validation.errors }
        );
      }

      // 保存到数据库
      this.database.saveScenePrompt(sceneId, modeId, prompt);
      logger.info(`场景提示词已保存 (scene: ${sceneId}, mode: ${modeId})`);

      // 记录警告（如果有）
      if (validation.warnings.length > 0) {
        logger.warn(`场景提示词保存警告 (scene: ${sceneId}, mode: ${modeId}):`, validation.warnings);
      }
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      logger.error(`保存场景提示词失败 (scene: ${sceneId}, mode: ${modeId}):`, error);
      throw new MCPError(
        `Failed to save scene prompt: ${sceneId}:${modeId}`,
        'SCENE_PROMPT_SAVE_ERROR',
        { sceneId, modeId, error }
      );
    }
  }

  /**
   * 删除场景提示词
   */
  deleteScenePrompt(sceneId: string, modeId: string): boolean {
    try {
      const deleted = this.database.deleteScenePrompt(sceneId, modeId);
      if (deleted) {
        logger.info(`场景提示词已删除 (scene: ${sceneId}, mode: ${modeId})`);
      } else {
        logger.warn(`未找到要删除的场景提示词 (scene: ${sceneId}, mode: ${modeId})`);
      }
      return deleted;
    } catch (error) {
      logger.error(`删除场景提示词失败 (scene: ${sceneId}, mode: ${modeId}):`, error);
      throw new MCPError(
        `Failed to delete scene prompt: ${sceneId}:${modeId}`,
        'SCENE_PROMPT_DELETE_ERROR',
        { sceneId, modeId, error }
      );
    }
  }

  /**
   * 导出场景配置
   */
  exportSceneConfig(): SceneConfig {
    try {
      const scenes = this.database.getAllScenes();
      
      // 获取所有场景的模式
      const sceneModes: SceneMode[] = [];
      for (const scene of scenes) {
        const modes = this.database.getSceneModes(scene.id);
        sceneModes.push(...modes);
      }

      // 获取所有场景的提示词
      const scenePrompts: ScenePrompt[] = [];
      for (const scene of scenes) {
        const prompts = this.database.getScenePrompts(scene.id);
        scenePrompts.push(...prompts);
      }

      return {
        scenes,
        sceneModes,
        scenePrompts
      };
    } catch (error) {
      logger.error('导出场景配置失败:', error);
      throw new MCPError(
        'Failed to export scene config',
        'SCENE_CONFIG_EXPORT_ERROR',
        error
      );
    }
  }

  /**
   * 导入场景配置
   */
  importSceneConfig(config: SceneConfig): { success: number; failed: number; errors: string[] } {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    try {
      // 导入场景
      for (const scene of config.scenes) {
        try {
          this.database.createScene(scene);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push(`场景 ${scene.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 导入场景模式
      for (const mode of config.sceneModes) {
        try {
          this.database.createSceneMode(mode);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push(`模式 ${mode.name}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // 导入场景提示词
      for (const prompt of config.scenePrompts) {
        try {
          this.database.saveScenePrompt(prompt.scene_id, prompt.mode_id, prompt.prompt);
          result.success++;
        } catch (error) {
          result.failed++;
          result.errors.push(`提示词 ${prompt.scene_id}:${prompt.mode_id}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      logger.info(`场景配置导入完成: 成功 ${result.success}, 失败 ${result.failed}`);
      return result;
    } catch (error) {
      logger.error('导入场景配置失败:', error);
      throw new MCPError(
        'Failed to import scene config',
        'SCENE_CONFIG_IMPORT_ERROR',
        error
      );
    }
  }

  /**
   * 应用场景提示词到当前会话
   */
  applyScenePrompt(sceneId: string, modeId: string): PromptApplyResult {
    try {
      const prompt = this.getScenePrompt(sceneId, modeId);
      if (!prompt) {
        throw new MCPError(
          `No prompt found for scene: ${sceneId}, mode: ${modeId}`,
          'SCENE_PROMPT_NOT_FOUND',
          { sceneId, modeId }
        );
      }

      const result: PromptApplyResult = {
        success: true,
        appliedPrompt: prompt,
        mode: modeId,
        scene: sceneId,
        timestamp: Date.now()
      };

      logger.info(`场景提示词已应用 (scene: ${sceneId}, mode: ${modeId})`);
      return result;
    } catch (error) {
      logger.error(`应用场景提示词失败 (scene: ${sceneId}, mode: ${modeId}):`, error);
      
      if (error instanceof MCPError) {
        throw error;
      }

      throw new MCPError(
        `Failed to apply scene prompt: ${sceneId}:${modeId}`,
        'SCENE_PROMPT_APPLY_ERROR',
        { sceneId, modeId, error }
      );
    }
  }
} 