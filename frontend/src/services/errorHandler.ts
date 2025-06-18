/**
 * 全局错误处理服务
 * 统一管理应用中的错误处理和消息显示
 */

import type { MessageType } from '../types/app'

// 错误类型定义
export interface ApiError {
  message: string
  code?: string
  status?: number
}

export interface ErrorHandlerOptions {
  showToast?: boolean
  logToConsole?: boolean
  autoRemove?: boolean
}

class ErrorHandler {
  private showStatusMessage: ((type: MessageType, message: string, autoRemove?: boolean) => string | undefined) | null = null

  /**
   * 初始化错误处理器
   */
  init(showStatusMessageFn: (type: MessageType, message: string, autoRemove?: boolean) => string | undefined) {
    this.showStatusMessage = showStatusMessageFn
  }

  /**
   * 显示API错误
   */
  showApiError(error: ApiError | Error | string, options: ErrorHandlerOptions = {}) {
    const {
      showToast = true,
      logToConsole = true,
      autoRemove = true
    } = options

    let message: string
    let status: number | undefined

    // 解析错误信息
    if (typeof error === 'string') {
      message = error
    } else if (error instanceof Error) {
      message = error.message
    } else {
      message = error.message
      status = error.status
    }

    // 控制台日志
    if (logToConsole) {
      console.error('[ErrorHandler] API错误:', { message, status, error })
    }

    // 显示toast消息
    if (showToast && this.showStatusMessage) {
      return this.showStatusMessage('error', message, autoRemove)
    }

    return undefined
  }

  /**
   * 显示通用错误
   */
  showError(message: string, options: ErrorHandlerOptions = {}) {
    return this.showApiError(message, options)
  }

  /**
   * 显示警告消息
   */
  showWarning(message: string, options: ErrorHandlerOptions = {}) {
    const {
      showToast = true,
      logToConsole = true,
      autoRemove = true
    } = options

    if (logToConsole) {
      console.warn('[ErrorHandler] 警告:', message)
    }

    if (showToast && this.showStatusMessage) {
      return this.showStatusMessage('warning', message, autoRemove)
    }

    return undefined
  }

  /**
   * 显示成功消息
   */
  showSuccess(message: string, options: ErrorHandlerOptions = {}) {
    const {
      showToast = true,
      logToConsole = false,
      autoRemove = true
    } = options

    if (logToConsole) {
      console.log('[ErrorHandler] 成功:', message)
    }

    if (showToast && this.showStatusMessage) {
      return this.showStatusMessage('success', message, autoRemove)
    }

    return undefined
  }

  /**
   * 显示信息消息
   */
  showInfo(message: string, options: ErrorHandlerOptions = {}) {
    const {
      showToast = true,
      logToConsole = false,
      autoRemove = true
    } = options

    if (logToConsole) {
      console.info('[ErrorHandler] 信息:', message)
    }

    if (showToast && this.showStatusMessage) {
      return this.showStatusMessage('info', message, autoRemove)
    }

    return undefined
  }

  /**
   * 处理网络错误
   */
  handleNetworkError(_: Error) {
    const message = '网络连接失败，请检查网络设置后重试'
    return this.showApiError(message, { logToConsole: true })
  }

  /**
   * 处理权限错误
   */
  handlePermissionError(message = '您没有权限执行此操作') {
    return this.showApiError(message, { logToConsole: true })
  }

  /**
   * 处理服务器错误
   */
  handleServerError(message = '服务器内部错误，请稍后重试') {
    return this.showApiError(message, { logToConsole: true })
  }
}

// 创建单例实例
export const errorHandler = new ErrorHandler()
export default errorHandler 