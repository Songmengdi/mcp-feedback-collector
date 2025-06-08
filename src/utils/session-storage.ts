/**
 * 会话存储管理器
 * 提供内存存储和可选的持久化存储
 */

import { FeedbackData, MCPError } from '../types/index.js';
import { logger } from './logger.js';

export interface SessionData {
  workSummary: string;
  feedback: FeedbackData[];
  startTime: number;
  timeout: number;
  resolve?: (feedback: FeedbackData[]) => void;
  reject?: (error: Error) => void;
}

export interface PromptData {
  prompt: string;
  model?: string;
  files?: any[];
  images?: any[];
  mode?: string;
  metadata?: any;
  timestamp: number;
}

export class SessionStorage {
  private sessions = new Map<string, SessionData>();
  private prompts = new Map<string, PromptData>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(private cleanupIntervalMs: number = 60000) { // 1分钟清理一次
    this.startCleanupTimer();
  }

  /**
   * 创建会话
   */
  createSession(sessionId: string, data: SessionData): void {
    this.sessions.set(sessionId, data);
    logger.debug(`会话已创建: ${sessionId}`);
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): SessionData | undefined {
    const session = this.sessions.get(sessionId);
    
    if (session) {
      // 检查会话是否过期
      const now = Date.now();
      const elapsed = now - session.startTime;
      
      if (elapsed > session.timeout) {
        logger.debug(`会话已过期: ${sessionId}`);
        this.deleteSession(sessionId);
        return undefined;
      }
    }
    
    return session;
  }

  /**
   * 更新会话
   */
  updateSession(sessionId: string, updates: Partial<SessionData>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    Object.assign(session, updates);
    this.sessions.set(sessionId, session);
    logger.debug(`会话已更新: ${sessionId}`);
    return true;
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      logger.debug(`会话已删除: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * 获取所有活跃会话
   */
  getAllSessions(): Map<string, SessionData> {
    return new Map(this.sessions);
  }

  /**
   * 获取活跃会话数量
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions) {
      const elapsed = now - session.startTime;
      
      if (elapsed > session.timeout) {
        // 通知会话超时
        if (session.reject) {
          session.reject(new MCPError(
            `Session timeout after ${session.timeout / 1000} seconds`,
            'SESSION_TIMEOUT'
          ));
        }
        
        this.sessions.delete(sessionId);
        cleanedCount++;
        logger.debug(`清理过期会话: ${sessionId}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理了 ${cleanedCount} 个过期会话`);
    }

    return cleanedCount;
  }

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
      this.cleanupExpiredPrompts();
    }, this.cleanupIntervalMs);
  }

  /**
   * 停止清理定时器
   */
  stopCleanupTimer(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 清理所有会话
   */
  clear(): void {
    // 通知所有会话关闭
    for (const [sessionId, session] of this.sessions) {
      if (session.reject) {
        session.reject(new MCPError('Server is shutting down', 'SERVER_SHUTDOWN'));
      }
    }
    
    this.sessions.clear();
    logger.info('所有会话已清理');
  }

  /**
   * 获取会话统计信息
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;

    for (const session of this.sessions.values()) {
      const elapsed = now - session.startTime;
      if (elapsed > session.timeout) {
        expiredSessions++;
      } else {
        activeSessions++;
      }
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredSessions
    };
  }

  /**
   * 存储prompt数据
   */
  storePrompt(sessionId: string, promptData: PromptData): void {
    this.prompts.set(sessionId, promptData);
    logger.debug(`Prompt已存储: ${sessionId}`);
  }

  /**
   * 获取prompt数据
   */
  getPrompt(sessionId: string): PromptData | undefined {
    const promptData = this.prompts.get(sessionId);
    
    if (promptData) {
      // 检查prompt是否过期（24小时）
      const now = Date.now();
      const elapsed = now - promptData.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24小时
      
      if (elapsed > maxAge) {
        logger.debug(`Prompt已过期: ${sessionId}`);
        this.prompts.delete(sessionId);
        return undefined;
      }
    }
    
    return promptData;
  }

  /**
   * 删除prompt数据
   */
  deletePrompt(sessionId: string): boolean {
    const deleted = this.prompts.delete(sessionId);
    if (deleted) {
      logger.debug(`Prompt已删除: ${sessionId}`);
    }
    return deleted;
  }

  /**
   * 获取所有prompt数据
   */
  getAllPrompts(): Map<string, PromptData> {
    return new Map(this.prompts);
  }

  /**
   * 清理过期的prompt数据
   */
  cleanupExpiredPrompts(): number {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    let cleanedCount = 0;

    for (const [sessionId, promptData] of this.prompts) {
      const elapsed = now - promptData.timestamp;
      
      if (elapsed > maxAge) {
        this.prompts.delete(sessionId);
        cleanedCount++;
        logger.debug(`清理过期prompt: ${sessionId}`);
      }
    }

    if (cleanedCount > 0) {
      logger.info(`清理了 ${cleanedCount} 个过期prompt`);
    }

    return cleanedCount;
  }
}
