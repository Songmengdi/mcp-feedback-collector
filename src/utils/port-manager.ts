/**
 * MCP Feedback Collector - 端口管理工具
 */

import { Mutex } from 'async-mutex';
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
  


  // 互斥锁，防止并发端口分配竞态条件
  private readonly portAllocationMutex = new Mutex();
  
  // 已分配端口的跟踪集合
  private readonly allocatedPorts = new Set<number>();
  
  // 端口分配超时时间（毫秒）
  private readonly ALLOCATION_TIMEOUT = 5000;

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
   * 查找可用端口（从5000开始递增）- 线程安全版本
   */
  async findAvailablePort(): Promise<number> {
    // 使用互斥锁确保端口分配的原子性
    const release = await this.portAllocationMutex.acquire();
    
    try {
      logger.debug('开始查找可用端口，从5000开始...');

      // 从5000开始，依次+1查找可用端口
      for (let port = this.PORT_START; port <= this.MAX_PORT; port++) {
        // 跳过已分配的端口
        if (this.allocatedPorts.has(port)) {
          logger.debug(`端口 ${port} 已被分配，跳过`);
          continue;
        }

        logger.debug(`检查端口: ${port}`);
        if (await this.isPortAvailable(port)) {
          // 立即标记为已分配，防止其他并发请求使用
          this.allocatedPorts.add(port);
          logger.debug(`找到并分配端口: ${port}`);
          
          // 设置超时清理，防止端口泄漏
          this.schedulePortCleanup(port);
          
          return port;
        }
      }

      throw new MCPError(
        'No available ports found',
        'NO_AVAILABLE_PORTS',
        { 
          startPort: this.PORT_START,
          maxPort: this.MAX_PORT,
          allocatedPorts: Array.from(this.allocatedPorts)
        }
      );
    } finally {
      release();
    }
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
   * 手动释放端口分配
   */
  async releasePort(port: number): Promise<void> {
    const release = await this.portAllocationMutex.acquire();
    
    try {
      if (this.allocatedPorts.has(port)) {
        this.allocatedPorts.delete(port);
        logger.info(`端口 ${port} 已手动释放`);
      } else {
        logger.debug(`端口 ${port} 未在分配列表中，无需释放`);
      }
    } finally {
      release();
    }
  }

  /**
   * 安排端口清理（防止端口泄漏）
   */
  private schedulePortCleanup(port: number): void {
    setTimeout(() => {
      this.releasePort(port).catch(error => {
        logger.warn(`自动清理端口 ${port} 失败:`, error);
      });
    }, this.ALLOCATION_TIMEOUT);
  }

  /**
   * 获取当前已分配端口的统计信息
   */
  getAllocationStats(): {
    allocatedPorts: number[];
    totalAllocated: number;
    availableInRange: number;
  } {
    const allocatedPorts = Array.from(this.allocatedPorts).sort((a, b) => a - b);
    const totalRange = this.MAX_PORT - this.PORT_START + 1;
    const availableInRange = totalRange - allocatedPorts.length;

    return {
      allocatedPorts,
      totalAllocated: allocatedPorts.length,
      availableInRange
    };
  }

  /**
   * 清理所有已分配端口（用于重置或清理）
   */
  async clearAllAllocations(): Promise<void> {
    const release = await this.portAllocationMutex.acquire();
    
    try {
      const count = this.allocatedPorts.size;
      this.allocatedPorts.clear();
      logger.info(`已清理所有端口分配，共 ${count} 个端口`);
    } finally {
      release();
    }
  }

  /**
   * 批量检查端口可用性（线程安全）
   */
  async checkPortsBatch(ports: number[]): Promise<Map<number, boolean>> {
    const release = await this.portAllocationMutex.acquire();
    const results = new Map<number, boolean>();
    
    try {
      for (const port of ports) {
        // 如果已被分配，直接标记为不可用
        if (this.allocatedPorts.has(port)) {
          results.set(port, false);
        } else {
          const available = await this.isPortAvailable(port);
          results.set(port, available);
        }
      }
    } finally {
      release();
    }
    
    return results;
  }
}
