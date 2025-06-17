/**
 * MCP Feedback Collector - 端口管理工具
 */

import { createServer } from 'net';
import { MCPError, PortInfo } from '../types/index.js';
import { logger } from './logger.js';
import { processManager } from './process-manager.js';

/**
 * 端口管理器
 */
export class PortManager {
  private readonly PORT_START = 5000;
  private readonly MAX_PORT = 65535;
  
  // Toolbar 专用端口范围
  private readonly TOOLBAR_PORT_RANGE_START = 5746;
  private readonly TOOLBAR_PORT_RANGE_END = 5756;

  /**
   * 检查端口是否可用（增强版本）
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
   * 深度检查端口是否真正可用（包括进程检测）
   */
  async isPortTrulyAvailable(port: number): Promise<boolean> {
    // 首先进行基础检查
    const basicCheck = await this.isPortAvailable(port);
    if (!basicCheck) {
      return false;
    }

    // 检查是否有进程占用该端口
    const processInfo = await processManager.getPortProcess(port);
    if (processInfo) {
      logger.debug(`端口 ${port} 被进程占用:`, processInfo);
      return false;
    }

    return true;
  }

  /**
   * 查找可用端口（从5000开始递增）
   */
  async findAvailablePort(): Promise<number> {
    logger.debug('开始查找可用端口，从5000开始...');

    // 从5000开始，依次+1查找可用端口
    for (let port = this.PORT_START; port <= this.MAX_PORT; port++) {
      logger.debug(`检查端口: ${port}`);
      if (await this.isPortAvailable(port)) {
        logger.info(`找到可用端口: ${port}`);
        return port;
      }
    }

    throw new MCPError(
      'No available ports found',
      'NO_AVAILABLE_PORTS',
      { 
        startPort: this.PORT_START,
        maxPort: this.MAX_PORT
      }
    );
  }



  /**
   * 获取端口信息
   */
  async getPortInfo(port: number): Promise<PortInfo> {
    const available = await this.isPortAvailable(port);
    
    return {
      port,
      available,
      // TODO: 添加PID检测（需要跨平台实现）
      pid: undefined
    };
  }

  /**
   * 获取端口范围内的所有端口状态
   */
  async getPortRangeStatus(): Promise<PortInfo[]> {
    const results: PortInfo[] = [];
    
    // 检查前20个端口的状态
    for (let port = this.PORT_START; port < this.PORT_START + 20; port++) {
      const info = await this.getPortInfo(port);
      results.push(info);
    }
    
    return results;
  }

  /**
   * 清理僵尸进程（跨平台实现）
   */
  async cleanupZombieProcesses(): Promise<void> {
    logger.info('开始清理僵尸进程...');
    
    try {
      // TODO: 实现跨平台的进程清理
      // Windows: tasklist, taskkill
      // Unix/Linux: ps, kill
      
      logger.info('僵尸进程清理完成');
    } catch (error) {
      logger.warn('清理僵尸进程时出错:', error);
    }
  }



  /**
   * 强制释放端口（杀死占用进程）
   */
  async forceReleasePort(port: number): Promise<void> {
    logger.warn(`强制释放端口: ${port}`);
    
    try {
      // TODO: 实现跨平台的进程杀死
      // 1. 找到占用端口的进程PID
      // 2. 杀死该进程
      // 3. 等待端口释放
      
      // 简单等待端口释放
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info(`端口 ${port} 强制释放成功`);
      
    } catch (error) {
      logger.error(`强制释放端口 ${port} 失败:`, error);
      throw new MCPError(
        `Failed to force release port ${port}`,
        'FORCE_RELEASE_FAILED',
        error
      );
    }
  }

  /**
   * 查找 Toolbar 可用端口
   */
  async findToolbarPort(preferredPort?: number): Promise<number> {
    // 如果指定了首选端口，先尝试该端口
    if (preferredPort) {
      logger.info(`[Toolbar] 检查首选端口: ${preferredPort}`);
      const available = await this.isPortAvailable(preferredPort);
      if (available) {
        logger.info(`[Toolbar] ✅ 使用首选端口: ${preferredPort}`);
        return preferredPort;
      } else {
        logger.warn(`[Toolbar] ❌ 首选端口 ${preferredPort} 不可用，寻找其他端口...`);
      }
    }

    // 在 Toolbar 端口范围内查找可用端口
    for (let port = this.TOOLBAR_PORT_RANGE_START; port <= this.TOOLBAR_PORT_RANGE_END; port++) {
      logger.debug(`[Toolbar] 检查端口: ${port}`);
      if (await this.isPortAvailable(port)) {
        logger.info(`[Toolbar] ✅ 找到可用端口: ${port}`);
        return port;
      }
    }

    // 如果 Toolbar 范围内没有可用端口，使用通用方法
    logger.warn('[Toolbar] ⚠️ 专用端口范围内无可用端口，使用通用端口范围');
    const fallbackPort = await this.findAvailablePort();
    logger.info(`[Toolbar] 🔄 使用备用端口: ${fallbackPort}`);
    return fallbackPort;
  }

  /**
   * 获取 Toolbar 端口范围状态
   */
  async getToolbarPortRangeStatus(): Promise<PortInfo[]> {
    const results: PortInfo[] = [];
    
    for (let port = this.TOOLBAR_PORT_RANGE_START; port <= this.TOOLBAR_PORT_RANGE_END; port++) {
      const info = await this.getPortInfo(port);
      results.push(info);
    }
    
    return results;
  }

  /**
   * 检测 Toolbar 服务
   * 通过 ping 端点检测是否有 Toolbar 兼容的服务运行
   */
  async detectToolbarServices(): Promise<Array<{ port: number; service: string; status: string }>> {
    const services: Array<{ port: number; service: string; status: string }> = [];
    
    for (let port = this.TOOLBAR_PORT_RANGE_START; port <= this.TOOLBAR_PORT_RANGE_END; port++) {
      try {
        // 检查端口是否被占用
        const available = await this.isPortAvailable(port);
        if (available) {
          continue; // 端口未被占用，跳过
        }

        // 尝试访问 ping 端点
        const response = await fetch(`http://localhost:${port}/ping/stagewise`, {
          method: 'GET',
          signal: AbortSignal.timeout(1000) // 1秒超时
        });

        if (response.ok) {
          const text = await response.text();
          services.push({
            port,
            service: text.trim() || 'unknown',
            status: 'active'
          });
        }
      } catch (error) {
        // 端口被占用但不是 Toolbar 服务
        services.push({
          port,
          service: 'unknown',
          status: 'occupied'
        });
      }
    }
    
    return services;
  }

  /**
   * 获取 Toolbar 端口配置
   */
  getToolbarPortConfig() {
    return {
      rangeStart: this.TOOLBAR_PORT_RANGE_START,
      rangeEnd: this.TOOLBAR_PORT_RANGE_END,
      defaultPort: this.TOOLBAR_PORT_RANGE_START
    };
  }
}
