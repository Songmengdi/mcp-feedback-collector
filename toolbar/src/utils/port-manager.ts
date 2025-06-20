/**
 * Standalone Toolbar Service - 简化端口管理器
 */

import { createServer } from 'net';
import { logger } from './logger.js';

/**
 * 简化的端口管理器
 * 专门为独立Toolbar服务设计，支持SRPC端口5748和广播端口15749
 */
export class SimplePortManager {
  private readonly TOOLBAR_PORT = 5748;  // SRPC服务端口
  private readonly BROADCAST_PORT = 15749;  // 广播服务端口

  /**
   * 检查端口是否可用
   */
  async isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = createServer();
      let resolved = false;

      // 设置超时，避免长时间等待
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          server.close(() => {
            resolve(false);
          });
        }
      }, 1000);

      server.listen(port, () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          // 端口可用，立即关闭测试服务器
          server.close(() => {
            resolve(true);
          });
        }
      });

      server.on('error', (err: any) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          // 端口不可用
          resolve(false);
        }
      });
    });
  }

  /**
   * 检查所有必需端口是否可用
   */
  async checkAllPorts(): Promise<{ toolbarPort: boolean; broadcastPort: boolean; allAvailable: boolean }> {
    const toolbarAvailable = await this.isPortAvailable(this.TOOLBAR_PORT);
    const broadcastAvailable = await this.isPortAvailable(this.BROADCAST_PORT);
    
    return {
      toolbarPort: toolbarAvailable,
      broadcastPort: broadcastAvailable,
      allAvailable: toolbarAvailable && broadcastAvailable
    };
  }

  /**
   * 获取工具栏端口（SRPC服务）
   * 固定返回5748，如果不可用则抛出错误
   */
  async getToolbarPort(): Promise<number> {
    logger.debug(`检查SRPC端口: ${this.TOOLBAR_PORT}`);
    
    const available = await this.isPortAvailable(this.TOOLBAR_PORT);
    
    if (!available) {
      const error = new Error(`SRPC端口 ${this.TOOLBAR_PORT} 不可用，请确保端口未被占用`);
      logger.error('SRPC端口检查失败:', error.message);
      throw error;
    }

    logger.debug(`SRPC端口 ${this.TOOLBAR_PORT} 可用`);
    return this.TOOLBAR_PORT;
  }

  /**
   * 获取广播端口
   * 固定返回15749，如果不可用则抛出错误
   */
  async getBroadcastPort(): Promise<number> {
    logger.debug(`检查广播端口: ${this.BROADCAST_PORT}`);
    
    const available = await this.isPortAvailable(this.BROADCAST_PORT);
    
    if (!available) {
      const error = new Error(`广播端口 ${this.BROADCAST_PORT} 不可用，请确保端口未被占用`);
      logger.error('广播端口检查失败:', error.message);
      throw error;
    }

    logger.debug(`广播端口 ${this.BROADCAST_PORT} 可用`);
    return this.BROADCAST_PORT;
  }

  /**
   * 获取端口配置信息
   */
  getPortConfig() {
    return {
      toolbarPort: this.TOOLBAR_PORT,
      broadcastPort: this.BROADCAST_PORT,
      description: '独立Toolbar服务双端口配置',
      service: 'standalone-toolbar-service',
      services: {
        srpc: {
          port: this.TOOLBAR_PORT,
          description: 'SRPC WebSocket服务'
        },
        broadcast: {
          port: this.BROADCAST_PORT,
          description: 'Prompt广播服务'
        }
      }
    };
  }
} 