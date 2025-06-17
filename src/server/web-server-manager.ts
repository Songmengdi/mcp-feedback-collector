/**
 * MCP Feedback Collector - WebServer实例管理器
 * 专门用于stdio模式下的多客户端WebServer实例管理
 */

import { Config, MCPError } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { PortManager } from '../utils/port-manager.js';
import { WebServer } from './web-server.js';

/**
 * WebServer实例信息
 */
export interface WebServerInstance {
  clientId: string;
  webServer: WebServer;
  port: number;
  startTime: number;
  config: Config;
}

/**
 * WebServer管理器
 * 负责为stdio模式的多客户端创建和管理独立的WebServer实例
 */
export class WebServerManager {
  private instances: Map<string, WebServerInstance> = new Map();
  private portManager: PortManager;
  private baseConfig: Config;

  constructor(baseConfig: Config) {
    this.baseConfig = baseConfig;
    this.portManager = new PortManager();
  }

  /**
   * 为指定客户端创建WebServer实例
   */
  async createInstance(clientId: string): Promise<WebServer> {
    // 检查是否已存在实例
    if (this.instances.has(clientId)) {
      const existing = this.instances.get(clientId)!;
      logger.warn(`客户端 ${clientId} 的WebServer实例已存在，端口: ${existing.port}`);
      return existing.webServer;
    }

    try {
      logger.info(`为客户端 ${clientId} 创建WebServer实例...`);

      // 为stdio模式分配专用端口
      const port = await this.portManager.findAvailablePortForStdio();
      logger.info(`为客户端 ${clientId} 分配端口: ${port}`);

      // 创建独立的配置副本
      const instanceConfig: Config = {
        ...this.baseConfig,
        webPort: port,
        // 为stdio模式优化配置
        forcePort: true,  // 强制使用分配的端口
        cleanupPortOnStart: true,  // 启动时清理端口
        useFixedUrl: true  // 使用固定URL
      };

      // 创建WebServer实例
      const webServer = new WebServer(instanceConfig);

      // 存储实例信息
      const instance: WebServerInstance = {
        clientId,
        webServer,
        port,
        startTime: Date.now(),
        config: instanceConfig
      };

      this.instances.set(clientId, instance);

      logger.info(`✅ 客户端 ${clientId} 的WebServer实例创建成功，端口: ${port}`);
      return webServer;

    } catch (error) {
      logger.error(`为客户端 ${clientId} 创建WebServer实例失败:`, error);
      throw new MCPError(
        `Failed to create WebServer instance for client ${clientId}`,
        'WEBSERVER_INSTANCE_CREATE_ERROR',
        { clientId, error }
      );
    }
  }

  /**
   * 获取指定客户端的WebServer实例
   */
  getInstance(clientId: string): WebServer | undefined {
    const instance = this.instances.get(clientId);
    return instance?.webServer;
  }

  /**
   * 获取指定客户端的实例信息
   */
  getInstanceInfo(clientId: string): WebServerInstance | undefined {
    return this.instances.get(clientId);
  }

  /**
   * 销毁指定客户端的WebServer实例
   */
  async destroyInstance(clientId: string): Promise<void> {
    const instance = this.instances.get(clientId);
    if (!instance) {
      logger.warn(`客户端 ${clientId} 的WebServer实例不存在`);
      return;
    }

    try {
      logger.info(`销毁客户端 ${clientId} 的WebServer实例，端口: ${instance.port}`);

      // 停止WebServer
      if (instance.webServer.isRunning()) {
        await instance.webServer.stop();
      }

      // 等待端口释放
      await this.portManager.waitForPortRelease(instance.port, 3000);

      // 从映射中移除
      this.instances.delete(clientId);

      logger.info(`✅ 客户端 ${clientId} 的WebServer实例已销毁`);

    } catch (error) {
      logger.error(`销毁客户端 ${clientId} 的WebServer实例失败:`, error);
      // 即使销毁失败，也要从映射中移除，避免内存泄漏
      this.instances.delete(clientId);
      throw new MCPError(
        `Failed to destroy WebServer instance for client ${clientId}`,
        'WEBSERVER_INSTANCE_DESTROY_ERROR',
        { clientId, error }
      );
    }
  }

  /**
   * 获取所有活跃实例的统计信息
   */
  getStats(): {
    totalInstances: number;
    activeInstances: number;
    instances: Array<{
      clientId: string;
      port: number;
      running: boolean;
      uptime: number;
    }>;
  } {
    const instances: Array<{
      clientId: string;
      port: number;
      running: boolean;
      uptime: number;
    }> = [];

    let activeCount = 0;

    for (const [clientId, instance] of this.instances) {
      const running = instance.webServer.isRunning();
      if (running) {
        activeCount++;
      }

      instances.push({
        clientId,
        port: instance.port,
        running,
        uptime: Date.now() - instance.startTime
      });
    }

    return {
      totalInstances: this.instances.size,
      activeInstances: activeCount,
      instances
    };
  }

  /**
   * 清理所有实例
   */
  async cleanup(): Promise<void> {
    logger.info(`开始清理所有WebServer实例，总数: ${this.instances.size}`);

    const cleanupPromises: Promise<void>[] = [];

    for (const [clientId] of this.instances) {
      cleanupPromises.push(
        this.destroyInstance(clientId).catch(error => {
          logger.warn(`清理客户端 ${clientId} 实例失败:`, error);
        })
      );
    }

    await Promise.all(cleanupPromises);
    logger.info('✅ 所有WebServer实例清理完成');
  }

  /**
   * 检查管理器是否有活跃实例
   */
  hasActiveInstances(): boolean {
    for (const instance of this.instances.values()) {
      if (instance.webServer.isRunning()) {
        return true;
      }
    }
    return false;
  }
} 