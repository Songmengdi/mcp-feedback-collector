/**
 * 提示词服务 - 封装与后端API的通信，实现JSON存储+localStorage缓存策略
 */

import type { 
  Scene, 
  SceneMode, 
  CurrentSelection,
  ScenesResponse,
  SceneRequest,
  SceneModeRequest,
  SceneConfigExport 
} from '../types/app'
import errorHandler from './errorHandler'

export interface PromptCacheItem {
  prompt: string;
  timestamp: number;
  mode: string;
  sceneId?: string; // 添加场景ID支持
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

// 导入API专用响应类型
export interface ImportApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  result?: {
    success: number;
    failed: number;
    errors: string[];
  };
}

export class PromptService {
  private readonly CACHE_PREFIX = 'mcp-prompt-cache';
  // 传统API_BASE已移除，统一使用场景化API
  private readonly SCENES_API_BASE = '/api/scenes'; // 新增场景API基础路径
  private readonly UNIFIED_API_BASE = '/api/unified'; // 新增统一API基础路径

  // ===== 场景管理方法 =====

  /**
   * 获取所有场景
   */
  async getAllScenes(): Promise<Scene[]> {
    try {
      console.log('[PromptService] 获取所有场景');
      const response = await fetch(this.SCENES_API_BASE);
      
      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ScenesResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '获取场景列表失败');
      }

      return result.data?.scenes || [];
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 获取场景详情（包含模式列表）
   */
  async getSceneDetails(sceneId: string): Promise<{ scene: Scene; modes: SceneMode[] }> {
    try {
      console.log(`[PromptService] 获取场景详情: ${sceneId}`);
      const response = await fetch(`${this.SCENES_API_BASE}/${sceneId}`);
      
      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '获取场景详情失败');
      }

      return {
        scene: result.data?.scene || null,
        modes: result.data?.modes || []
      };
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 创建新场景
   */
  async createScene(sceneData: SceneRequest): Promise<Scene> {
    try {
      console.log('[PromptService] 创建新场景:', sceneData.name);
      const response = await fetch(this.SCENES_API_BASE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sceneData),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '创建场景失败');
      }

      return result.data?.scene;
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 更新场景
   */
  async updateScene(sceneId: string, sceneData: Partial<SceneRequest>): Promise<Scene> {
    try {
      console.log(`[PromptService] 更新场景: ${sceneId}`);
      const response = await fetch(`${this.SCENES_API_BASE}/${sceneId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sceneData),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '更新场景失败');
      }

      return result.data?.scene;
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 删除场景
   */
  async deleteScene(sceneId: string): Promise<void> {
    try {
      console.log(`[PromptService] 删除场景: ${sceneId}`);
      const response = await fetch(`${this.SCENES_API_BASE}/${sceneId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '删除场景失败');
      }

      // 清理相关缓存
      this.clearSceneCache(sceneId);
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  // ===== 场景模式管理方法 =====

  /**
   * 获取场景下的所有模式
   */
  async getSceneModes(sceneId: string): Promise<SceneMode[]> {
    try {
      console.log(`[PromptService] 获取场景模式: ${sceneId}`);
      const response = await fetch(`${this.SCENES_API_BASE}/${sceneId}/modes`);
      
      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '获取场景模式失败');
      }

      return result.data?.modes || [];
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 为场景添加新模式
   */
  async addSceneMode(sceneId: string, modeData: SceneModeRequest): Promise<SceneMode> {
    try {
      console.log(`[PromptService] 添加场景模式: ${sceneId}/${modeData.name}`);
      const response = await fetch(`${this.SCENES_API_BASE}/${sceneId}/modes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modeData),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '添加场景模式失败');
      }

      return result.data?.mode;
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 更新场景模式
   */
  async updateSceneMode(sceneId: string, modeId: string, modeData: Partial<SceneModeRequest>): Promise<SceneMode> {
    try {
      console.log(`[PromptService] 更新场景模式: ${sceneId}/${modeId}`);
      const response = await fetch(`${this.SCENES_API_BASE}/${sceneId}/modes/${modeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(modeData),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '更新场景模式失败');
      }

      return result.data?.mode;
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 删除场景模式
   */
  async deleteSceneMode(sceneId: string, modeId: string): Promise<void> {
    try {
      console.log(`[PromptService] 删除场景模式: ${sceneId}/${modeId}`);
      const response = await fetch(`${this.SCENES_API_BASE}/${sceneId}/modes/${modeId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '删除场景模式失败');
      }

      // 清理相关缓存
      this.clearSceneModeCache(sceneId, modeId);
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  // ===== 统一提示词管理方法 =====

  /**
   * 获取提示词（统一API，支持场景化和传统模式）
   */
  async getUnifiedPrompt(selection: CurrentSelection): Promise<string> {
    try {
      // 直接调用统一API，不使用缓存
      console.log(`[PromptService] 直接从统一API获取提示词: ${selection.sceneId}/${selection.modeId}`);
      const response = await fetch(`${this.UNIFIED_API_BASE}/prompt?scene=${selection.sceneId}&mode=${selection.modeId}`);
      
      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '获取提示词失败');
      }

      const prompt = result.data?.prompt || '';
      
      console.log(`[PromptService] 成功获取提示词: ${selection.sceneId}/${selection.modeId}, 长度: ${prompt.length}`);
      
      return prompt;
    } catch (error) {
      console.error(`[PromptService] 获取提示词失败: ${selection.sceneId}/${selection.modeId}`, error);
      // 直接抛出错误，不使用缓存回退
      throw error;
    }
  }

  /**
   * 保存提示词（统一API）
   */
  async saveUnifiedPrompt(selection: CurrentSelection, prompt: string): Promise<void> {
    try {
      console.log(`[PromptService] 保存统一提示词: ${selection.sceneId}/${selection.modeId}`);
      
      const response = await fetch(`${this.UNIFIED_API_BASE}/prompt/apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          scene: selection.sceneId,
          mode: selection.modeId,
          prompt 
        }),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '保存提示词失败');
      }

      // 保存成功后更新缓存
      this.setCachedScenePrompt(selection.sceneId, selection.modeId, prompt);
      
      console.log(`[PromptService] 统一提示词保存成功: ${selection.sceneId}/${selection.modeId}`);
    } catch (error) {
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  // ===== 配置导出导入方法 =====

  /**
   * 导出场景配置
   */
  async exportSceneConfig(): Promise<SceneConfigExport> {
    try {
      console.log('[PromptService] 导出场景配置');
      const response = await fetch(`${this.SCENES_API_BASE}/export`);
      
      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result = await response.json();
      
      // 检查是否是包装在config字段中的响应格式
      if (result.config) {
        // SceneConfigExportResponse格式
        const config = result.config;
        return {
          version: config.version || '2.0',
          exportedAt: config.exportedAt || Date.now(),
          scenes: config.scenes || [],
          modes: config.modes || [],
          prompts: config.prompts || []
        };
      } else if (result.version && result.scenes) {
        // 直接的SceneConfigExport格式
        return {
          version: result.version || '2.0',
          exportedAt: result.exportedAt || Date.now(),
          scenes: result.scenes || [],
          modes: result.modes || [],
          prompts: result.prompts || []
        };
      } else {
        console.warn('[PromptService] 导出响应格式不匹配，返回空配置');
        return { 
          version: '2.0',
          exportedAt: Date.now(),
          scenes: [], 
          modes: [], 
          prompts: [] 
        };
      }
    } catch (error) {
      console.error('[PromptService] 导出场景配置失败:', error);
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  /**
   * 导入场景配置
   */
  async importSceneConfig(config: SceneConfigExport): Promise<void> {
    try {
      console.log('[PromptService] 导入场景配置');
      
      // 客户端验证
      if (!config || typeof config !== 'object') {
        throw new Error('导入数据无效：配置对象为空');
      }
      
      if (!Array.isArray(config.scenes) || !Array.isArray(config.modes) || !Array.isArray(config.prompts)) {
        throw new Error('导入数据格式错误：缺少必要的数据数组');
      }
      
      const response = await fetch(`${this.SCENES_API_BASE}/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ config }),
      });

      if (!response.ok) {
        await this.handleApiError(response);
      }

      const result: ImportApiResponse = await response.json();
      
      if (!result.success) {
        // 提供更详细的错误信息
        let errorMessage = '导入场景配置失败';
        
        if (result.result && result.result.errors && Array.isArray(result.result.errors)) {
          errorMessage += `:\n${result.result.errors.join('\n')}`;
        } else if (result.error) {
          errorMessage += `: ${result.error}`;
        } else if (result.message) {
          errorMessage += `: ${result.message}`;
        }
        
        throw new Error(errorMessage);
      }

      // 导入成功后清理所有缓存
      this.clearAllSceneCache();
      
      // 记录导入统计信息
      if (result.result) {
        console.log(`[PromptService] 场景配置导入完成: 成功 ${result.result.success} 个, 失败 ${result.result.failed} 个`);
        if (result.result.errors && result.result.errors.length > 0) {
          console.warn('[PromptService] 导入过程中的错误:', result.result.errors);
          
          // 如果有错误但导入成功了一些项目，给用户提示
          if (result.result.success > 0) {
            console.info(`[PromptService] 部分导入成功，建议检查导入结果`);
          }
        }
      } else {
        console.log('[PromptService] 场景配置导入成功');
      }
    } catch (error) {
      console.error('[PromptService] 导入场景配置失败:', error);
      // 错误已在handleApiError中处理
      throw error;
    }
  }

  // ===== 场景化缓存管理方法 =====


  /**
   * 设置场景化缓存的提示词
   */
  private setCachedScenePrompt(sceneId: string, modeId: string, prompt: string): void {
    try {
      const cacheKey = `${this.CACHE_PREFIX}-scene-${sceneId}-${modeId}`;
      const cacheItem: PromptCacheItem = {
        prompt,
        timestamp: Date.now(),
        mode: modeId,
        sceneId
      };

      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    } catch (error) {
      console.warn(`[PromptService] 设置场景缓存失败 (${sceneId}/${modeId}):`, error);
    }
  }

  /**
   * 清除指定场景的所有缓存
   */
  private clearSceneCache(sceneId: string): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(`${this.CACHE_PREFIX}-scene-${sceneId}-`)
      );
      
      keys.forEach(key => localStorage.removeItem(key));
      
      console.log(`[PromptService] 已清除场景缓存: ${sceneId} (${keys.length}个条目)`);
    } catch (error) {
      console.warn(`[PromptService] 清除场景缓存失败 (${sceneId}):`, error);
    }
  }

  /**
   * 清除指定场景模式的缓存
   */
  private clearSceneModeCache(sceneId: string, modeId: string): void {
    try {
      const cacheKey = `${this.CACHE_PREFIX}-scene-${sceneId}-${modeId}`;
      localStorage.removeItem(cacheKey);
      
      console.log(`[PromptService] 已清除场景模式缓存: ${sceneId}/${modeId}`);
    } catch (error) {
      console.warn(`[PromptService] 清除场景模式缓存失败 (${sceneId}/${modeId}):`, error);
    }
  }

  /**
   * 清除所有场景化缓存
   */
  private clearAllSceneCache(): void {
    try {
      const keys = Object.keys(localStorage).filter(key => 
        key.startsWith(`${this.CACHE_PREFIX}-scene-`)
      );
      
      keys.forEach(key => localStorage.removeItem(key));
      
      console.log(`[PromptService] 已清除所有场景缓存 (${keys.length}个条目)`);
    } catch (error) {
      console.warn('[PromptService] 清除所有场景缓存失败:', error);
    }
  }

  /**
   * 获取场景化缓存统计信息
   */
  getSceneCacheStats(): { total: number; scenes: string[]; modes: string[]; oldestTimestamp: number | null } {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(`${this.CACHE_PREFIX}-scene-`));
    const scenes = new Set<string>();
    const modes = new Set<string>();
    
    let oldestTimestamp: number | null = null;
    
    keys.forEach(key => {
      try {
        const cached = JSON.parse(localStorage.getItem(key) || '{}');
        if (cached.sceneId) scenes.add(cached.sceneId);
        if (cached.mode) modes.add(cached.mode);
        
        if (cached.timestamp) {
          if (oldestTimestamp === null || cached.timestamp < oldestTimestamp) {
            oldestTimestamp = cached.timestamp;
          }
        }
      } catch (error) {
        // 忽略解析错误
      }
    });
    
    return {
      total: keys.length,
      scenes: Array.from(scenes),
      modes: Array.from(modes),
      oldestTimestamp
    };
  }

  /**
   * 统一处理API错误响应
   */
  private async handleApiError(response: Response): Promise<never> {
    try {
      // 尝试解析响应体获取详细错误信息
      const errorData = await response.json();
      const errorMessage = errorData.message || errorData.error || `API请求失败: ${response.status} ${response.statusText}`;
      
      // 使用全局错误处理器显示错误
      errorHandler.showApiError({
        message: errorMessage,
        status: response.status,
        code: errorData.error
      });
      
      throw new Error(errorMessage);
    } catch (parseError) {
      // 如果解析响应体失败，使用通用错误信息
      const fallbackMessage = `API请求失败: ${response.status} ${response.statusText}`;
      
      if (parseError instanceof Error && parseError.message !== fallbackMessage) {
        // 重新抛出已经处理过的错误
        throw parseError;
      }
      
      // 显示通用错误信息
      errorHandler.showApiError({
        message: fallbackMessage,
        status: response.status
      });
      
      throw new Error(fallbackMessage);
    }
  }
}

// 创建单例实例
export const promptService = new PromptService();
export default promptService; 