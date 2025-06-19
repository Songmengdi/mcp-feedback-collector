/**
 * Standalone Toolbar Service - 简化端口管理器
 */

import { createServer } from 'net';
import { logger } from './logger.js';

/**
 * 简化的端口管理器
 * 专门为独立Toolbar服务设计，固定使用5749端口
 */
export class SimplePortManager {
  private readonly TOOLBAR_PORT = 5749;

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
   * 获取工具栏端口
   * 固定返回5749，如果不可用则抛出错误
   */
  async getToolbarPort(): Promise<number> {
    logger.debug(`检查工具栏端口: ${this.TOOLBAR_PORT}`);
    
    const available = await this.isPortAvailable(this.TOOLBAR_PORT);
    
    if (!available) {
      const error = new Error(`工具栏端口 ${this.TOOLBAR_PORT} 不可用，请确保端口未被占用`);
      logger.error('端口检查失败:', error.message);
      throw error;
    }

    logger.debug(`工具栏端口 ${this.TOOLBAR_PORT} 可用`);
    return this.TOOLBAR_PORT;
  }

  /**
   * 获取端口配置信息
   */
  getPortConfig() {
    return {
      toolbarPort: this.TOOLBAR_PORT,
      description: '独立Toolbar服务固定端口',
      service: 'standalone-toolbar-service'
    };
  }
} 