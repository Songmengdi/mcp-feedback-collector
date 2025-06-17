/**
 * 提示词服务 - 封装与后端API的通信，实现SQLite+localStorage缓存策略
 */

export interface PromptCacheItem {
  prompt: string;
  timestamp: number;
  mode: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export class PromptService {
  private readonly CACHE_PREFIX = 'mcp-prompt-cache';
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30分钟
  private readonly API_BASE = '/api/prompts';

  /**
   * 获取提示词 (优先缓存，回退API)
   */
  async getPrompt(mode: string): Promise<string> {
    try {
      // 首先检查缓存
      const cached = this.getCachedPrompt(mode);
      if (cached) {
        console.log(`[PromptService] 使用缓存提示词: ${mode}`);
        return cached;
      }

      // 缓存未命中，调用API
      console.log(`[PromptService] 从API获取提示词: ${mode}`);
      const response = await fetch(`${this.API_BASE}/${mode}`);
      
      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '获取提示词失败');
      }

      const prompt = result.data?.prompt || '';
      
      // 更新缓存
      this.setCachedPrompt(mode, prompt);
      
      return prompt;
    } catch (error) {
      console.error(`[PromptService] 获取提示词失败 (${mode}):`, error);
      
      // 网络错误时尝试使用过期缓存
      const expiredCache = this.getCachedPrompt(mode, true);
      if (expiredCache) {
        console.warn(`[PromptService] 使用过期缓存: ${mode}`);
        return expiredCache;
      }
      
      throw error;
    }
  }

  /**
   * 保存提示词 (API + 缓存同步)
   */
  async savePrompt(mode: string, prompt: string): Promise<void> {
    try {
      console.log(`[PromptService] 保存提示词: ${mode}`);
      
      const response = await fetch(`${this.API_BASE}/${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '保存提示词失败');
      }

      // 保存成功后更新缓存
      this.setCachedPrompt(mode, prompt);
      
      console.log(`[PromptService] 提示词保存成功: ${mode}`);
    } catch (error) {
      console.error(`[PromptService] 保存提示词失败 (${mode}):`, error);
      throw error;
    }
  }

  /**
   * 删除提示词 (API + 缓存清理)
   */
  async deletePrompt(mode: string): Promise<void> {
    try {
      console.log(`[PromptService] 删除提示词: ${mode}`);
      
      const response = await fetch(`${this.API_BASE}/${mode}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '删除提示词失败');
      }

      // 删除成功后清理缓存
      this.clearCachedPrompt(mode);
      
      console.log(`[PromptService] 提示词删除成功: ${mode}`);
    } catch (error) {
      console.error(`[PromptService] 删除提示词失败 (${mode}):`, error);
      throw error;
    }
  }

  /**
   * 验证提示词
   */
  async validatePrompt(mode: string, prompt: string): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    try {
      const response = await fetch(`${this.API_BASE}/${mode}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '验证提示词失败');
      }

      return result.data?.validation || { isValid: false, errors: ['验证失败'], warnings: [] };
    } catch (error) {
      console.error(`[PromptService] 验证提示词失败 (${mode}):`, error);
      throw error;
    }
  }

  /**
   * 重置到默认提示词
   */
  async resetToDefault(mode: string): Promise<void> {
    try {
      console.log(`[PromptService] 重置到默认提示词: ${mode}`);
      
      const response = await fetch(`${this.API_BASE}/${mode}/reset`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`API请求失败: ${response.status} ${response.statusText}`);
      }

      const result: ApiResponse = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || '重置提示词失败');
      }

      // 重置成功后清理缓存，强制重新获取
      this.clearCachedPrompt(mode);
      
      console.log(`[PromptService] 提示词重置成功: ${mode}`);
    } catch (error) {
      console.error(`[PromptService] 重置提示词失败 (${mode}):`, error);
      throw error;
    }
  }

  /**
   * 获取缓存的提示词
   */
  private getCachedPrompt(mode: string, ignoreExpiry = false): string | null {
    try {
      const cacheKey = `${this.CACHE_PREFIX}-${mode}`;
      const cached = localStorage.getItem(cacheKey);
      
      if (!cached) {
        return null;
      }

      const cacheItem: PromptCacheItem = JSON.parse(cached);
      
      // 检查缓存是否过期
      if (!ignoreExpiry && Date.now() - cacheItem.timestamp > this.CACHE_DURATION) {
        this.clearCachedPrompt(mode);
        return null;
      }

      return cacheItem.prompt;
    } catch (error) {
      console.error(`[PromptService] 读取缓存失败 (${mode}):`, error);
      this.clearCachedPrompt(mode);
      return null;
    }
  }

  /**
   * 设置缓存的提示词
   */
  private setCachedPrompt(mode: string, prompt: string): void {
    try {
      const cacheKey = `${this.CACHE_PREFIX}-${mode}`;
      const cacheItem: PromptCacheItem = {
        prompt,
        timestamp: Date.now(),
        mode,
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
      console.log(`[PromptService] 缓存已更新: ${mode}`);
    } catch (error) {
      console.error(`[PromptService] 设置缓存失败 (${mode}):`, error);
    }
  }

  /**
   * 清理缓存的提示词
   */
  private clearCachedPrompt(mode: string): void {
    try {
      const cacheKey = `${this.CACHE_PREFIX}-${mode}`;
      localStorage.removeItem(cacheKey);
      console.log(`[PromptService] 缓存已清理: ${mode}`);
    } catch (error) {
      console.error(`[PromptService] 清理缓存失败 (${mode}):`, error);
    }
  }

  /**
   * 清理所有过期缓存
   */
  clearExpiredCache(): void {
    try {
      const keys = Object.keys(localStorage);
      const expiredKeys = keys.filter(key => {
        if (!key.startsWith(this.CACHE_PREFIX)) {
          return false;
        }

        try {
          const cached = localStorage.getItem(key);
          if (!cached) return true;

          const cacheItem: PromptCacheItem = JSON.parse(cached);
          return Date.now() - cacheItem.timestamp > this.CACHE_DURATION;
        } catch {
          return true; // 解析失败的缓存也清理掉
        }
      });

      expiredKeys.forEach(key => localStorage.removeItem(key));
      
      if (expiredKeys.length > 0) {
        console.log(`[PromptService] 已清理 ${expiredKeys.length} 个过期缓存`);
      }
    } catch (error) {
      console.error('[PromptService] 清理过期缓存失败:', error);
    }
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { total: number; modes: string[]; oldestTimestamp: number | null } {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(key => key.startsWith(this.CACHE_PREFIX));
      
      const modes: string[] = [];
      let oldestTimestamp: number | null = null;

      cacheKeys.forEach(key => {
        try {
          const cached = localStorage.getItem(key);
          if (cached) {
            const cacheItem: PromptCacheItem = JSON.parse(cached);
            modes.push(cacheItem.mode);
            
            if (oldestTimestamp === null || cacheItem.timestamp < oldestTimestamp) {
              oldestTimestamp = cacheItem.timestamp;
            }
          }
        } catch {
          // 忽略解析失败的缓存
        }
      });

      return {
        total: cacheKeys.length,
        modes,
        oldestTimestamp,
      };
    } catch (error) {
      console.error('[PromptService] 获取缓存统计失败:', error);
      return { total: 0, modes: [], oldestTimestamp: null };
    }
  }
}

// 创建单例实例
export const promptService = new PromptService();
export default promptService; 