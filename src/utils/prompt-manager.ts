/**
 * 提示词管理服务
 */

import { PromptDatabase, CustomPrompt } from './prompt-database.js';
import { logger } from './logger.js';
import { MCPError } from '../types/index.js';

export interface PromptValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface PromptApplyResult {
  success: boolean;
  appliedPrompt: string;
  mode: string;
  timestamp: number;
}

export class PromptManager {
  private database: PromptDatabase;
  private defaultPrompts: Map<string, string>;

  constructor() {
    this.database = new PromptDatabase();
    this.defaultPrompts = new Map();
    this.initializeDefaultPrompts();
  }

  /**
   * 初始化默认提示词
   */
  private initializeDefaultPrompts(): void {
    // 默认的反馈收集提示词
    this.defaultPrompts.set('feedback', `
# 语言设置
- 中文说明, 中文回答

# 反馈工具
- 使用MCP服务"mcp-feedback-collector"中的collect_feedback工具来收集反馈.
- **当发现反馈工具调用失败,或者用户手动取消,你需要重新尝试调用工具,而不是立即结束.**

## 必须遵循要求(强制性规则(必须遵守,非常重要))
- **每当您要完成用户请求时，请使用MCP服务"mcp-feedback-collector"中的collect_feedback工具收集反馈，而不是简单地结束该过程。继续调用该MCP，直到用户的反馈为空，然后结束请求。**
    `.trim());

    // 默认的代码审查提示词
    this.defaultPrompts.set('code-review', `
# 代码审查模式
- 仔细分析代码质量、性能和安全性
- 提供具体的改进建议
- 检查代码规范和最佳实践
- 使用中文进行说明和建议

## 审查重点
- 代码逻辑正确性
- 性能优化机会
- 安全漏洞检查
- 代码可维护性
- 错误处理完整性
    `.trim());

    // 默认的文档生成提示词
    this.defaultPrompts.set('documentation', `
# 文档生成模式
- 生成清晰、详细的技术文档
- 使用中文编写文档内容
- 包含代码示例和使用说明
- 遵循标准文档格式

## 文档要求
- 结构清晰，层次分明
- 包含完整的API说明
- 提供实际使用示例
- 注明注意事项和限制
    `.trim());

    logger.info('默认提示词初始化完成');
  }

  /**
   * 获取提示词（优先使用自定义，回退到默认）
   */
  getPrompt(mode: string): string | null {
    try {
      // 首先尝试获取自定义提示词
      const customPrompt = this.database.getPrompt(mode);
      if (customPrompt) {
        logger.debug(`使用自定义提示词 (mode: ${mode})`);
        return customPrompt.prompt;
      }

      // 回退到默认提示词
      const defaultPrompt = this.defaultPrompts.get(mode);
      if (defaultPrompt) {
        logger.debug(`使用默认提示词 (mode: ${mode})`);
        return defaultPrompt;
      }

      logger.warn(`未找到提示词 (mode: ${mode})`);
      return null;
    } catch (error) {
      logger.error(`获取提示词失败 (mode: ${mode}):`, error);
      throw new MCPError(
        `Failed to get prompt for mode: ${mode}`,
        'PROMPT_GET_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 保存自定义提示词
   */
  saveCustomPrompt(mode: string, prompt: string): void {
    try {
      // 验证提示词
      const validation = this.validatePrompt(prompt);
      if (!validation.isValid) {
        throw new MCPError(
          `Invalid prompt: ${validation.errors.join(', ')}`,
          'PROMPT_VALIDATION_ERROR',
          { mode, errors: validation.errors }
        );
      }

      // 保存到数据库
      this.database.savePrompt(mode, prompt);
      logger.info(`自定义提示词已保存 (mode: ${mode})`);

      // 记录警告（如果有）
      if (validation.warnings.length > 0) {
        logger.warn(`提示词保存警告 (mode: ${mode}):`, validation.warnings);
      }
    } catch (error) {
      if (error instanceof MCPError) {
        throw error;
      }
      logger.error(`保存自定义提示词失败 (mode: ${mode}):`, error);
      throw new MCPError(
        `Failed to save custom prompt for mode: ${mode}`,
        'PROMPT_SAVE_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 删除自定义提示词
   */
  deleteCustomPrompt(mode: string): boolean {
    try {
      const deleted = this.database.deletePrompt(mode);
      if (deleted) {
        logger.info(`自定义提示词已删除 (mode: ${mode})`);
      } else {
        logger.warn(`未找到要删除的自定义提示词 (mode: ${mode})`);
      }
      return deleted;
    } catch (error) {
      logger.error(`删除自定义提示词失败 (mode: ${mode}):`, error);
      throw new MCPError(
        `Failed to delete custom prompt for mode: ${mode}`,
        'PROMPT_DELETE_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 获取所有可用的模式
   */
  getAvailableModes(): string[] {
    try {
      const customPrompts = this.database.getAllPrompts();
      const customModes = customPrompts.map(p => p.mode);
      const defaultModes = Array.from(this.defaultPrompts.keys());
      
      // 合并并去重
      const allModes = [...new Set([...customModes, ...defaultModes])];
      return allModes.sort();
    } catch (error) {
      logger.error('获取可用模式失败:', error);
      // 回退到默认模式
      return Array.from(this.defaultPrompts.keys()).sort();
    }
  }

  /**
   * 获取模式详情
   */
  getModeDetails(mode: string): {
    mode: string;
    hasCustom: boolean;
    hasDefault: boolean;
    customPrompt?: CustomPrompt;
    defaultPrompt?: string;
  } {
    const customPrompt = this.database.getPrompt(mode);
    const defaultPrompt = this.defaultPrompts.get(mode);

    const result: {
      mode: string;
      hasCustom: boolean;
      hasDefault: boolean;
      customPrompt?: CustomPrompt;
      defaultPrompt?: string;
    } = {
      mode,
      hasCustom: !!customPrompt,
      hasDefault: !!defaultPrompt
    };

    if (customPrompt) {
      result.customPrompt = customPrompt;
    }

    if (defaultPrompt) {
      result.defaultPrompt = defaultPrompt;
    }

    return result;
  }

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

  /**
   * 应用提示词到当前会话
   */
  applyPrompt(mode: string): PromptApplyResult {
    try {
      const prompt = this.getPrompt(mode);
      if (!prompt) {
        throw new MCPError(
          `No prompt found for mode: ${mode}`,
          'PROMPT_NOT_FOUND',
          { mode }
        );
      }

      const result: PromptApplyResult = {
        success: true,
        appliedPrompt: prompt,
        mode,
        timestamp: Date.now()
      };

      logger.info(`提示词已应用 (mode: ${mode})`);
      return result;
    } catch (error) {
      logger.error(`应用提示词失败 (mode: ${mode}):`, error);
      
      if (error instanceof MCPError) {
        throw error;
      }

      throw new MCPError(
        `Failed to apply prompt for mode: ${mode}`,
        'PROMPT_APPLY_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 重置到默认提示词
   */
  resetToDefault(mode: string): boolean {
    try {
      const hasDefault = this.defaultPrompts.has(mode);
      if (!hasDefault) {
        logger.warn(`没有默认提示词可重置 (mode: ${mode})`);
        return false;
      }

      // 删除自定义提示词（如果存在）
      this.database.deletePrompt(mode);
      logger.info(`已重置到默认提示词 (mode: ${mode})`);
      return true;
    } catch (error) {
      logger.error(`重置提示词失败 (mode: ${mode}):`, error);
      throw new MCPError(
        `Failed to reset prompt for mode: ${mode}`,
        'PROMPT_RESET_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 导出所有自定义提示词
   */
  exportCustomPrompts(): CustomPrompt[] {
    try {
      return this.database.getAllPrompts();
    } catch (error) {
      logger.error('导出自定义提示词失败:', error);
      throw new MCPError(
        'Failed to export custom prompts',
        'PROMPT_EXPORT_ERROR',
        error
      );
    }
  }

  /**
   * 导入自定义提示词
   */
  importCustomPrompts(prompts: CustomPrompt[]): { success: number; failed: number; errors: string[] } {
    const result = { success: 0, failed: 0, errors: [] as string[] };

    for (const prompt of prompts) {
      try {
        this.saveCustomPrompt(prompt.mode, prompt.prompt);
        result.success++;
      } catch (error) {
        result.failed++;
        result.errors.push(`模式 ${prompt.mode}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    logger.info(`提示词导入完成: 成功 ${result.success}, 失败 ${result.failed}`);
    return result;
  }

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
} 