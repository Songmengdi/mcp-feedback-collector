/**
 * 清理提示词服务
 * 负责与后端API通信，管理清理提示词的CRUD操作
 */

import { errorHandler } from './errorHandler'

export interface ClearPrompt {
  prompt_text: string
}

export interface ClearPromptResponse {
  success: boolean
  data?: ClearPrompt
  message?: string
  error?: string
}

class ClearPromptService {
  private baseUrl: string

  constructor() {
    // 从当前页面URL获取基础URL
    const currentUrl = new URL(window.location.href)
    this.baseUrl = `${currentUrl.protocol}//${currentUrl.hostname}:${currentUrl.port}`
  }

  /**
   * 获取清理提示词
   */
  async getClearPrompt(): Promise<ClearPrompt | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/clear-prompt`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: ClearPromptResponse = await response.json()
      
      if (!result.success || !result.data) {
        throw new Error(result.error || '获取清理提示词失败')
      }

      return result.data
    } catch (error) {
      errorHandler.showError('获取清理提示词失败')
      throw error
    }
  }

  /**
   * 保存清理提示词
   */
  async saveClearPrompt(promptText: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/api/clear-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptText: promptText
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: ClearPromptResponse = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || '保存清理提示词失败')
      }
    } catch (error) {
      errorHandler.showError('保存清理提示词失败')
      throw error
    }
  }

  /**
   * 重置清理提示词为默认值
   */
  async resetClearPrompt(): Promise<string> {
    try {
      const response = await fetch(`${this.baseUrl}/api/clear-prompt`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result: ClearPromptResponse = await response.json()
      
      if (!result.success || !result.data) {
        throw new Error(result.error || '重置清理提示词失败')
      }

      return (result.data as any).promptText || ''
    } catch (error) {
      errorHandler.showError('重置清理提示词失败')
      throw error
    }
  }
}

// 导出单例实例
export default new ClearPromptService() 