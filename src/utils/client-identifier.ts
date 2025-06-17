/**
 * MCP Feedback Collector - 客户端标识生成器
 * 用于为stdio模式的客户端生成唯一标识
 */

import { logger } from './logger.js';
import { detectTransportMode, isStdioMode } from './mode-detector.js';

/**
 * 进程信息接口
 */
export interface ProcessInfo {
  pid: number;
  ppid?: number;
  startTime: number;
  platform: string;
  nodeVersion: string;
}

/**
 * 客户端标识生成器
 */
export class ClientIdentifier {
  private static instance: ClientIdentifier;
  private clientId?: string;

  /**
   * 获取单例实例
   */
  static getInstance(): ClientIdentifier {
    if (!ClientIdentifier.instance) {
      ClientIdentifier.instance = new ClientIdentifier();
    }
    return ClientIdentifier.instance;
  }

  /**
   * 生成客户端ID（每个进程只生成一次）
   */
  generateClientId(): string {
    if (this.clientId) {
      return this.clientId;
    }

    const processInfo = this.getProcessInfo();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);

    // 基于进程PID、启动时间、随机数生成唯一ID
    this.clientId = `stdio_${processInfo.pid}_${timestamp}_${random}`;

    logger.debug(`生成客户端ID: ${this.clientId}`, {
      pid: processInfo.pid,
      ppid: processInfo.ppid,
      platform: processInfo.platform,
      nodeVersion: processInfo.nodeVersion
    });

    return this.clientId;
  }

  /**
   * 获取当前客户端ID
   */
  getClientId(): string | undefined {
    return this.clientId;
  }

  /**
   * 获取进程相关信息
   */
  getProcessInfo(): ProcessInfo {
    return {
      pid: process.pid,
      ppid: process.ppid,
      startTime: Math.floor(process.uptime() * 1000), // 转换为毫秒
      platform: process.platform,
      nodeVersion: process.version
    };
  }

  /**
   * 检查是否为stdio模式
   */
  isStdioMode(): boolean {
    // 使用统一的模式检测逻辑
    const transportMode = detectTransportMode();
    return isStdioMode(transportMode);
  }

  /**
   * 获取客户端环境信息
   */
  getClientEnvironment(): {
    isStdio: boolean;
    isTTY: boolean;
    transportMode?: string;
    nodeEnv?: string;
    args: string[];
  } {
    const result: {
      isStdio: boolean;
      isTTY: boolean;
      transportMode?: string;
      nodeEnv?: string;
      args: string[];
    } = {
      isStdio: this.isStdioMode(),
      isTTY: process.stdin.isTTY,
      args: process.argv
    };

    const transportMode = process.env['MCP_TRANSPORT_MODE'];
    if (transportMode) {
      result.transportMode = transportMode;
    }

    const nodeEnv = process.env['NODE_ENV'];
    if (nodeEnv) {
      result.nodeEnv = nodeEnv;
    }

    return result;
  }

  /**
   * 生成短ID（用于日志显示）
   */
  generateShortId(): string {
    if (!this.clientId) {
      this.generateClientId();
    }

    // 取客户端ID的最后8位作为短ID
    return this.clientId!.split('_').pop()?.substr(0, 8) || 'unknown';
  }

  /**
   * 重置客户端ID（用于测试）
   */
  reset(): void {
    delete (this as any).clientId;
  }
} 