/**
 * MCP会话上下文管理器
 * 使用AsyncLocalStorage在异步调用链中传递MCP会话ID
 */

import { AsyncLocalStorage } from 'async_hooks';
import { logger } from './logger.js';

export class SessionContextManager {
  private static instance: AsyncLocalStorage<string> = new AsyncLocalStorage();

  /**
   * 获取当前MCP会话ID
   */
  static getCurrentMcpSessionId(): string | undefined {
    const sessionId = this.instance.getStore();
    logger.debug(`获取MCP会话上下文: ${sessionId || 'undefined'}`);
    return sessionId;
  }

  /**
   * 在指定的MCP会话上下文中运行回调函数
   */
  static runWithSession<T>(sessionId: string, callback: () => T): T {
    logger.debug(`在MCP会话上下文中运行: ${sessionId}`);
    return this.instance.run(sessionId, callback);
  }

  /**
   * 在指定的MCP会话上下文中运行异步回调函数
   */
  static async runWithSessionAsync<T>(sessionId: string, callback: () => Promise<T>): Promise<T> {
    logger.debug(`在MCP会话上下文中异步运行: ${sessionId}`);
    return this.instance.run(sessionId, callback);
  }

  /**
   * 检查是否存在活跃的会话上下文
   */
  static hasActiveSession(): boolean {
    return this.instance.getStore() !== undefined;
  }

  /**
   * 清理当前会话上下文（主要用于调试）
   */
  static clearCurrentSession(): void {
    const currentSession = this.getCurrentMcpSessionId();
    if (currentSession) {
      logger.debug(`清理MCP会话上下文: ${currentSession}`);
    }
  }

  /**
   * 获取会话统计信息（用于调试）
   */
  static getSessionStats(): { hasActiveSession: boolean; currentSessionId: string | undefined } {
    const currentSessionId = this.getCurrentMcpSessionId();
    return {
      hasActiveSession: this.hasActiveSession(),
      currentSessionId
    };
  }
} 