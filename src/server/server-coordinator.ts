import { Config } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { PortManager } from '../utils/port-manager.js';
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
  startTime?: number;
  uptime?: number;
}

/**
 * 服务协调器类
 * 管理WebServer服务
 */
export class ServerCoordinator {
  private webServer: WebServer;
  private portManager: PortManager;
  private config: Config;
  private isRunning = false;
  private startTime?: number;

  constructor(config: Config) {
    this.config = config;
    this.portManager = new PortManager();
    
    // 创建服务器实例
    this.webServer = new WebServer(config);
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('[Coordinator] 服务器已在运行中');
      return;
    }

    try {
      logger.info('[Coordinator] 🚀 开始启动服务器...');
      this.startTime = Date.now();

      // 启动Web服务器
      logger.info('[Coordinator] 📡 启动Web服务器...');
      await this.startWebServer();

      this.isRunning = true;
      
      // 显示启动成功信息
      const status = this.getStatus();
      logger.info('[Coordinator] ✅ 服务器启动成功!');
      logger.info(`[Coordinator] 📊 反馈收集服务: http://localhost:${status.webServer.port}`);
      
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
   * 停止所有服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('[Coordinator] 🛑 开始停止服务器...');

    try {
      // 停止Web服务器
      if (this.webServer.isRunning()) {
        await this.stopWebServer();
      }

      this.isRunning = false;
      delete this.startTime;
      
      logger.info('[Coordinator] ✅ 服务器已停止');
      
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
   * 清理资源（启动失败时使用）
   */
  private async cleanup(): Promise<void> {
    logger.info('[Coordinator] 🧹 清理资源...');
    
    if (this.webServer.isRunning()) {
      await this.webServer.stop().catch(error => 
        logger.warn('[Coordinator] Web服务器清理失败:', error)
      );
    }

    logger.info('[Coordinator] 🧹 资源清理完成');
  }

  /**
   * 获取综合状态
   */
  getStatus(): ServerCoordinatorStatus {
    return {
      running: this.isRunning,
      webServer: {
        running: this.webServer.isRunning(),
        ...(this.webServer.isRunning() && { port: this.webServer.getPort() })
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
   * 重启服务器
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
    details: any;
  }> {
    const status = this.getStatus();
    
    const webServerHealth = status.webServer.running ? 'healthy' : 'unhealthy';
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (webServerHealth === 'healthy') {
      overall = 'healthy';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      webServer: webServerHealth,
      details: {
        status,
        timestamp: new Date().toISOString()
      }
    };
  }
} 