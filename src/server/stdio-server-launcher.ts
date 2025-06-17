/**
 * MCP Feedback Collector - stdio模式服务器启动器
 * 专门处理stdio模式下的多客户端场景
 */

import { Config, MCPError, TransportMode } from '../types/index.js';
import { ClientIdentifier } from '../utils/client-identifier.js';
import { logger } from '../utils/logger.js';
import { MCPServer } from './mcp-server.js';
import { WebServerManager } from './web-server-manager.js';

/**
 * stdio服务器启动器
 * 负责为stdio模式的客户端创建独立的服务器实例
 */
export class StdioServerLauncher {
  private webServerManager: WebServerManager;
  private activeServers: Map<string, MCPServer> = new Map();
  private config: Config;
  private clientIdentifier: ClientIdentifier;

  constructor(config: Config) {
    this.config = config;
    this.webServerManager = new WebServerManager(config);
    this.clientIdentifier = ClientIdentifier.getInstance();
  }

  /**
   * 为当前客户端启动服务器
   */
  async launchForClient(): Promise<MCPServer> {
    // 生成客户端ID
    const clientId = this.clientIdentifier.generateClientId();
    const shortId = this.clientIdentifier.generateShortId();

    logger.debug(`[stdio-${shortId}] 开始为客户端启动服务器...`);

    // 检查是否已存在服务器实例
    if (this.activeServers.has(clientId)) {
      const existing = this.activeServers.get(clientId)!;
      logger.warn(`[stdio-${shortId}] 客户端服务器实例已存在`);
      return existing;
    }

    try {
      // 创建独立的WebServer实例
      logger.debug(`[stdio-${shortId}] 创建独立WebServer实例...`);
      const webServer = await this.webServerManager.createInstance(clientId);

      // 创建MCPServer实例
      logger.debug(`[stdio-${shortId}] 创建MCPServer实例...`);
      const mcpServer = new MCPServer(this.config, webServer);

      // 启动服务器
      logger.debug(`[stdio-${shortId}] 启动服务器...`);
      await mcpServer.start();

      // 存储服务器映射
      this.activeServers.set(clientId, mcpServer);

      const status = mcpServer.getStatus();
      logger.info(`[stdio-${shortId}] ✅ 服务器启动成功!`);
      logger.info(`[stdio-${shortId}] 📊 反馈收集服务: http://localhost:${status.webPort}`);
      logger.info(`[stdio-${shortId}] 🔧 Toolbar服务: http://localhost:${status.toolbarPort}`);

      // 设置进程退出时的清理
      this.setupCleanupHandlers(clientId, shortId);

      return mcpServer;

    } catch (error) {
      logger.error(`[stdio-${shortId}] 服务器启动失败:`, error);
      
      // 清理失败的实例
      await this.cleanupClient(clientId).catch(cleanupError => {
        logger.warn(`[stdio-${shortId}] 清理失败实例时出错:`, cleanupError);
      });

      throw new MCPError(
        `Failed to launch server for stdio client ${shortId}`,
        'STDIO_SERVER_LAUNCH_ERROR',
        { clientId, error }
      );
    }
  }

  /**
   * 设置清理处理器
   */
  private setupCleanupHandlers(clientId: string, shortId: string): void {
    // SIGINT处理器
    process.on('SIGINT', async () => {
      logger.info(`[stdio-${shortId}] 收到SIGINT信号，正在关闭服务器...`);
      await this.cleanupClient(clientId);
      process.exit(0);
    });

    // SIGTERM处理器
    process.on('SIGTERM', async () => {
      logger.info(`[stdio-${shortId}] 收到SIGTERM信号，正在关闭服务器...`);
      await this.cleanupClient(clientId);
      process.exit(0);
    });

    // 进程退出处理器
    process.on('exit', () => {
      logger.info(`[stdio-${shortId}] 进程退出，清理资源...`);
      // 注意：exit事件中不能使用异步操作
    });

    // 未捕获异常处理器
    process.on('uncaughtException', async (error) => {
      logger.error(`[stdio-${shortId}] 未捕获异常:`, error);
      await this.cleanupClient(clientId);
      process.exit(1);
    });

    // 未处理的Promise拒绝
    process.on('unhandledRejection', async (reason, promise) => {
      logger.error(`[stdio-${shortId}] 未处理的Promise拒绝:`, reason);
      await this.cleanupClient(clientId);
      process.exit(1);
    });
  }

  /**
   * 清理指定客户端的资源
   */
  async cleanupClient(clientId: string): Promise<void> {
    const shortId = clientId.split('_').pop()?.substr(0, 8) || 'unknown';
    
    try {
      logger.info(`[stdio-${shortId}] 开始清理客户端资源...`);

      // 停止MCP服务器
      const mcpServer = this.activeServers.get(clientId);
      if (mcpServer) {
        logger.info(`[stdio-${shortId}] 停止MCP服务器...`);
        await mcpServer.stop();
        this.activeServers.delete(clientId);
      }

      // 销毁WebServer实例
      logger.info(`[stdio-${shortId}] 销毁WebServer实例...`);
      await this.webServerManager.destroyInstance(clientId);

      logger.info(`[stdio-${shortId}] ✅ 客户端资源清理完成`);

    } catch (error) {
      logger.error(`[stdio-${shortId}] 清理客户端资源失败:`, error);
      throw error;
    }
  }

  /**
   * 清理所有客户端资源
   */
  async cleanup(): Promise<void> {
    logger.info('开始清理所有stdio客户端资源...');

    const cleanupPromises: Promise<void>[] = [];

    for (const [clientId] of this.activeServers) {
      cleanupPromises.push(
        this.cleanupClient(clientId).catch(error => {
          const shortId = clientId.split('_').pop()?.substr(0, 8) || 'unknown';
          logger.warn(`[stdio-${shortId}] 清理失败:`, error);
        })
      );
    }

    await Promise.all(cleanupPromises);

    // 清理WebServer管理器
    await this.webServerManager.cleanup();

    logger.info('✅ 所有stdio客户端资源清理完成');
  }

  /**
   * 获取活跃服务器统计信息
   */
  getStats(): {
    totalServers: number;
    activeServers: number;
    webServerStats: any;
         servers: Array<{
       clientId: string;
       shortId: string;
       running: boolean;
       webPort?: number;
       toolbarPort?: number;
     }>;
   } {
     const servers: Array<{
       clientId: string;
       shortId: string;
       running: boolean;
       webPort?: number;
       toolbarPort?: number;
     }> = [];

     let activeCount = 0;

     for (const [clientId, mcpServer] of this.activeServers) {
       const status = mcpServer.getStatus();
       const shortId = clientId.split('_').pop()?.substr(0, 8) || 'unknown';

       if (status.running) {
         activeCount++;
       }

       const serverInfo: {
         clientId: string;
         shortId: string;
         running: boolean;
         webPort?: number;
         toolbarPort?: number;
       } = {
         clientId,
         shortId,
         running: status.running
       };

       if (status.webPort) {
         serverInfo.webPort = status.webPort;
       }

       if (status.toolbarPort) {
         serverInfo.toolbarPort = status.toolbarPort;
       }

       servers.push(serverInfo);
     }

    return {
      totalServers: this.activeServers.size,
      activeServers: activeCount,
      webServerStats: this.webServerManager.getStats(),
      servers
    };
  }

  /**
   * 检查是否有活跃的服务器
   */
  hasActiveServers(): boolean {
    for (const mcpServer of this.activeServers.values()) {
      if (mcpServer.getStatus().running) {
        return true;
      }
    }
    return false;
  }

  /**
   * 验证stdio模式环境
   */
  validateStdioEnvironment(): void {
    const clientEnv = this.clientIdentifier.getClientEnvironment();

    if (!clientEnv.isStdio) {
      throw new MCPError(
        'Not in stdio mode environment',
        'INVALID_STDIO_ENVIRONMENT',
        clientEnv
      );
    }

    if (this.config.transportMode !== TransportMode.STDIO) {
      throw new MCPError(
        `Transport mode is not stdio: ${this.config.transportMode}`,
        'INVALID_TRANSPORT_MODE',
        { 
          expected: TransportMode.STDIO,
          actual: this.config.transportMode
        }
      );
    }

    logger.debug('stdio环境验证通过', clientEnv);
  }
} 