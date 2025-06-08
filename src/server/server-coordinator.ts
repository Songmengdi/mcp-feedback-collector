import { Config } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { PortManager } from '../utils/port-manager.js';
import { ToolbarServer } from './toolbar-server.js';
import { WebServer } from './web-server.js';

/**
 * 服务协调器接口
 */
export interface ServerCoordinatorStatus {
  running: boolean;
  webServer: {
    running: boolean;
    port?: number;
  };
  toolbarServer: {
    running: boolean;
    port?: number;
    srpcConnected?: boolean;
    registeredMethods?: string[];
  };
  startTime?: number;
  uptime?: number;
}

/**
 * 服务协调器类
 * 统一管理WebServer和ToolbarServer
 */
export class ServerCoordinator {
  private webServer: WebServer;
  private toolbarServer: ToolbarServer;
  private portManager: PortManager;
  private config: Config;
  private isRunning = false;
  private startTime?: number;

  constructor(config: Config) {
    this.config = config;
    this.portManager = new PortManager();
    
    // 创建服务器实例
    this.webServer = new WebServer(config);
    this.toolbarServer = new ToolbarServer();
  }

  /**
   * 启动所有服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Coordinator] 服务器已在运行中');
      return;
    }

    try {
      logger.info('[Coordinator] 🚀 开始启动服务器...');
      this.startTime = Date.now();

      // 并行启动两个服务器
      logger.info('[Coordinator] 📡 并行启动Web服务器和Toolbar服务器...');
      
      const startPromises = [
        this.startWebServer(),
        this.startToolbarServer()
      ];

      await Promise.all(startPromises);

      this.isRunning = true;
      
      // 显示启动成功信息
      const status = this.getStatus();
      logger.info('[Coordinator] ✅ 所有服务器启动成功!');
      logger.info(`[Coordinator] 📊 反馈收集服务: http://localhost:${status.webServer.port}`);
      logger.info(`[Coordinator] 🔧 Toolbar服务: http://localhost:${status.toolbarServer.port}`);
      logger.info(`[Coordinator] 📡 WebSocket端点: ws://localhost:${status.toolbarServer.port}`);
      
    } catch (error) {
      logger.error('[Coordinator] ❌ 服务器启动失败:', error);
      
      // 启动失败时尝试清理已启动的服务器
      await this.cleanup();
      
      throw new Error(`Failed to start servers: ${error}`);
    }
  }

  /**
   * 启动Web服务器
   */
  private async startWebServer(): Promise<void> {
    try {
      logger.info('[Coordinator] 🌐 启动Web服务器...');
      await this.webServer.start();
      logger.info(`[Coordinator] ✅ Web服务器启动成功: ${this.webServer.getPort()}`);
    } catch (error) {
      logger.error('[Coordinator] ❌ Web服务器启动失败:', error);
      throw error;
    }
  }

  /**
   * 启动Toolbar服务器
   */
  private async startToolbarServer(): Promise<void> {
    try {
      logger.info('[Coordinator] 🔧 启动Toolbar服务器...');
      await this.toolbarServer.start();
      logger.info(`[Coordinator] ✅ Toolbar服务器启动成功: ${this.toolbarServer.getPort()}`);
    } catch (error) {
      logger.error('[Coordinator] ❌ Toolbar服务器启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止所有服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('[Coordinator] 🛑 开始停止服务器...');

    try {
      // 并行停止两个服务器
      const stopPromises = [];
      
      if (this.webServer.isRunning()) {
        stopPromises.push(this.stopWebServer());
      }
      
      if (this.toolbarServer.isRunning()) {
        stopPromises.push(this.stopToolbarServer());
      }

      await Promise.all(stopPromises);

             this.isRunning = false;
       delete this.startTime;
      
      logger.info('[Coordinator] ✅ 所有服务器已停止');
      
    } catch (error) {
      logger.error('[Coordinator] ❌ 停止服务器时出错:', error);
      throw error;
    }
  }

  /**
   * 停止Web服务器
   */
  private async stopWebServer(): Promise<void> {
    try {
      logger.info('[Coordinator] 🌐 停止Web服务器...');
      await this.webServer.stop();
      logger.info('[Coordinator] ✅ Web服务器已停止');
    } catch (error) {
      logger.error('[Coordinator] ❌ 停止Web服务器失败:', error);
      throw error;
    }
  }

  /**
   * 停止Toolbar服务器
   */
  private async stopToolbarServer(): Promise<void> {
    try {
      logger.info('[Coordinator] 🔧 停止Toolbar服务器...');
      await this.toolbarServer.stop();
      logger.info('[Coordinator] ✅ Toolbar服务器已停止');
    } catch (error) {
      logger.error('[Coordinator] ❌ 停止Toolbar服务器失败:', error);
      throw error;
    }
  }

  /**
   * 清理资源（启动失败时使用）
   */
  private async cleanup(): Promise<void> {
    logger.info('[Coordinator] 🧹 清理资源...');
    
    const cleanupPromises = [];
    
    if (this.webServer.isRunning()) {
      cleanupPromises.push(
        this.webServer.stop().catch(error => 
          logger.warn('[Coordinator] Web服务器清理失败:', error)
        )
      );
    }
    
    if (this.toolbarServer.isRunning()) {
      cleanupPromises.push(
        this.toolbarServer.stop().catch(error => 
          logger.warn('[Coordinator] Toolbar服务器清理失败:', error)
        )
      );
    }

    await Promise.all(cleanupPromises);
    logger.info('[Coordinator] 🧹 资源清理完成');
  }

  /**
   * 获取综合状态
   */
  getStatus(): ServerCoordinatorStatus {
    const toolbarStatus = this.toolbarServer.getToolbarStatus();
    
    return {
      running: this.isRunning,
      webServer: {
        running: this.webServer.isRunning(),
        ...(this.webServer.isRunning() && { port: this.webServer.getPort() })
      },
      toolbarServer: {
        running: this.toolbarServer.isRunning(),
        ...(this.toolbarServer.isRunning() && { port: this.toolbarServer.getPort() }),
        ...(toolbarStatus.connected !== undefined && { srpcConnected: toolbarStatus.connected }),
        ...(toolbarStatus.registeredMethods && { registeredMethods: toolbarStatus.registeredMethods })
      },
      ...(this.startTime && { startTime: this.startTime }),
      ...(this.startTime && { uptime: Date.now() - this.startTime })
    };
  }

  /**
   * 发现所有相关服务
   */
  async discoverServices(): Promise<{
    toolbarServices: Array<{ port: number; service: string; status: string }>;
    portConfig: any;
  }> {
    logger.info('[Coordinator] 🔍 发现服务...');
    
    const [toolbarServices, portConfig] = await Promise.all([
      this.portManager.detectToolbarServices(),
      Promise.resolve(this.portManager.getToolbarPortConfig())
    ]);

    return {
      toolbarServices,
      portConfig
    };
  }

  /**
   * 检查服务器是否运行
   */
  isCoordinatorRunning(): boolean {
    return this.isRunning;
  }

  /**
   * 获取Web服务器实例
   */
  getWebServer(): WebServer {
    return this.webServer;
  }

  /**
   * 获取Toolbar服务器实例
   */
  getToolbarServer(): ToolbarServer {
    return this.toolbarServer;
  }

  /**
   * 重启所有服务器
   */
  async restart(): Promise<void> {
    logger.info('[Coordinator] 🔄 重启服务器...');
    
    await this.stop();
    
    // 等待一段时间确保端口完全释放
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.start();
    
    logger.info('[Coordinator] ✅ 服务器重启完成');
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    overall: 'healthy' | 'degraded' | 'unhealthy';
    webServer: 'healthy' | 'unhealthy';
    toolbarServer: 'healthy' | 'unhealthy';
    details: any;
  }> {
    const status = this.getStatus();
    
    const webServerHealth = status.webServer.running ? 'healthy' : 'unhealthy';
    const toolbarServerHealth = status.toolbarServer.running ? 'healthy' : 'unhealthy';
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (webServerHealth === 'healthy' && toolbarServerHealth === 'healthy') {
      overall = 'healthy';
    } else if (webServerHealth === 'healthy' || toolbarServerHealth === 'healthy') {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      webServer: webServerHealth,
      toolbarServer: toolbarServerHealth,
      details: status
    };
  }
} 