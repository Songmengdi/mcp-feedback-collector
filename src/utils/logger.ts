/**
 * MCP Feedback Collector - 日志工具
 */

import { LogLevel, TransportMode } from '../types/index.js';

// 日志级别优先级
const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  silent: 999
};


class Logger {
  private currentLevel: LogLevel = 'warn';
  private model: TransportMode = TransportMode.STDIO;

  setModel(model: TransportMode): void {
    this.model = model;
  }

  getModel(): TransportMode {
    return this.model;
  }

  /**
   * 设置日志级别
   */
  setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * 获取当前日志级别
   */
  getLevel(): LogLevel {
    return this.currentLevel;
  }

  /**
   * 检查是否应该输出指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    // silent模式下不输出任何日志
    if (this.currentLevel === 'silent') {
      return false;
    }
    if (this.model === TransportMode.STDIO) {
      return false;
    }

    return LOG_LEVELS[level] <= LOG_LEVELS[this.currentLevel];
  }


  /**
   * 输出日志
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;
    if (level === 'error') {
      console.error(message, ...args);
    } else if (level === 'warn') {
      console.warn(message, ...args);
    } else {
      console.log(message, ...args);
    }
  }

  /**
   * 错误日志
   */
  error(message: string, ...args: unknown[]): void {
    this.log('error', message, ...args);
  }

  /**
   * 警告日志
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * 信息日志
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * 调试日志
   */
  debug(message: string, ...args: unknown[]): void {
    this.log('debug', message, ...args);
  }

  /**
   * 记录HTTP请求
   */
  request(method: string, url: string, statusCode?: number, duration?: number): void {
    const parts = [method.toUpperCase(), url];
    if (statusCode !== undefined) parts.push(`${statusCode}`);
    if (duration !== undefined) parts.push(`${duration}ms`);
    
    this.info(`HTTP ${parts.join(' ')}`);
  }

  /**
   * 记录WebSocket事件
   */
  socket(event: string, sessionId?: string, data?: unknown): void {
    const parts = ['WebSocket', event];
    if (sessionId) parts.push(`session:${sessionId}`);
    
    this.debug(parts.join(' '), data);
  }

  /**
   * 记录MCP工具调用
   */
  mcp(tool: string, params?: unknown, result?: unknown): void {
    this.info(`MCP Tool: ${tool}`, { params, result });
  }
}

// 创建全局日志实例
export const logger = new Logger();

// 导出日志级别类型
export type { LogLevel };
