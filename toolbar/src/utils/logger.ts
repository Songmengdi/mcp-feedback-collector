/**
 * Standalone Toolbar Service - 日志工具
 */

import fs from 'fs';
import path from 'path';

// 日志级别类型定义
type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silent';

// 日志级别优先级
const LOG_LEVELS: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  silent: 999
};

// 日志颜色
const LOG_COLORS: Record<LogLevel, string> = {
  error: '\x1b[31m', // 红色
  warn: '\x1b[33m',  // 黄色
  info: '\x1b[36m',  // 青色
  debug: '\x1b[37m', // 白色
  silent: ''         // 无颜色
};

const RESET_COLOR = '\x1b[0m';

class Logger {
  private currentLevel: LogLevel = 'info';
  private logFile?: string;
  private fileLoggingEnabled = false;
  private colorsDisabled = false;

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
   * 禁用颜色输出
   */
  disableColors(): void {
    this.colorsDisabled = true;
  }

  /**
   * 启用文件日志记录
   */
  enableFileLogging(logDir: string = 'logs'): void {
    try {
      // 确保日志目录存在
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }

      // 生成日志文件名
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      this.logFile = path.join(logDir, `toolbar-service-${timestamp}.log`);
      this.fileLoggingEnabled = true;

      // 写入日志文件头
      const header = `=== Standalone Toolbar Service Log ===\n` +
                    `Start Time: ${new Date().toISOString()}\n` +
                    `Log Level: ${this.currentLevel}\n` +
                    `======================================\n\n`;

      fs.writeFileSync(this.logFile, header);

      console.log(`日志文件已创建: ${this.logFile}`);
    } catch (error) {
      console.error('无法创建日志文件:', error);
      this.fileLoggingEnabled = false;
    }
  }

  /**
   * 检查是否应该输出指定级别的日志
   */
  private shouldLog(level: LogLevel): boolean {
    // silent模式下不输出任何日志
    if (this.currentLevel === 'silent') {
      return false;
    }
    return LOG_LEVELS[level] <= LOG_LEVELS[this.currentLevel];
  }

  /**
   * 格式化时间戳
   */
  private formatTimestamp(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string, ...args: unknown[]): string {
    const timestamp = this.formatTimestamp();
    const levelStr = level.toUpperCase().padEnd(5);

    let formattedMessage: string;

    if (this.colorsDisabled) {
      // 无颜色模式
      formattedMessage = `[${timestamp}] ${levelStr} ${message}`;
    } else {
      // 有颜色模式（用于终端）
      const color = LOG_COLORS[level];
      formattedMessage = `${color}[${timestamp}] ${levelStr}${RESET_COLOR} ${message}`;
    }

    if (args.length > 0) {
      const argsStr = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');
      formattedMessage += ` ${argsStr}`;
    }

    return formattedMessage;
  }

  /**
   * 输出日志
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, ...args);

    // 控制台输出
    if (level === 'error') {
      console.error(formattedMessage);
    } else if (level === 'warn') {
      console.warn(formattedMessage);
    } else {
      console.log(formattedMessage);
    }

    // 文件输出（去除颜色代码）
    if (this.fileLoggingEnabled && this.logFile) {
      try {
        const cleanMessage = this.removeColorCodes(formattedMessage);
        fs.appendFileSync(this.logFile, cleanMessage + '\n');
      } catch (error) {
        console.error('写入日志文件失败:', error);
      }
    }
  }

  /**
   * 移除颜色代码
   */
  private removeColorCodes(text: string): string {
    return text.replace(/\x1b\[[0-9;]*m/g, '');
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
   * HTTP请求日志
   */
  request(method: string, url: string, statusCode?: number, duration?: number): void {
    let message = `${method} ${url}`;
    if (statusCode !== undefined) {
      message += ` - ${statusCode}`;
    }
    if (duration !== undefined) {
      message += ` (${duration}ms)`;
    }
    this.info(`[HTTP] ${message}`);
  }

  /**
   * WebSocket事件日志
   */
  socket(event: string, sessionId?: string, data?: unknown): void {
    let message = `[WebSocket] ${event}`;
    if (sessionId) {
      message += ` (session: ${sessionId})`;
    }
    if (data !== undefined) {
      message += ` - ${typeof data === 'object' ? JSON.stringify(data) : data}`;
    }
    this.debug(message);
  }

  /**
   * Toolbar相关日志
   */
  toolbar(action: string, params?: unknown, result?: unknown): void {
    let message = `[Toolbar] ${action}`;
    if (params !== undefined) {
      message += ` - params: ${typeof params === 'object' ? JSON.stringify(params) : params}`;
    }
    if (result !== undefined) {
      message += ` - result: ${typeof result === 'object' ? JSON.stringify(result) : result}`;
    }
    this.debug(message);
  }
}

// 导出单例实例
export const logger = new Logger();

// 导出类型
export type { LogLevel }; 