#!/usr/bin/env node

import { ToolbarServer } from './server/toolbar-server.js';
import { logger } from './utils/logger.js';

/**
 * 独立Toolbar服务的主服务类
 */
class StandaloneToolbarService {
  private toolbarServer: ToolbarServer;

  constructor() {
    this.toolbarServer = new ToolbarServer();
    this.setupProcessHandlers();
  }

  /**
   * 设置进程信号处理
   */
  private setupProcessHandlers(): void {
    // 优雅关闭处理
    process.on('SIGINT', () => {
      logger.info('[Main] 接收到 SIGINT 信号，开始优雅关闭...');
      this.stop().then(() => {
        process.exit(0);
      }).catch((error) => {
        logger.error('[Main] 优雅关闭失败:', error);
        process.exit(1);
      });
    });

    process.on('SIGTERM', () => {
      logger.info('[Main] 接收到 SIGTERM 信号，开始优雅关闭...');
      this.stop().then(() => {
        process.exit(0);
      }).catch((error) => {
        logger.error('[Main] 优雅关闭失败:', error);
        process.exit(1);
      });
    });

    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      logger.error('[Main] 未捕获的异常:', error);
      this.stop().then(() => {
        process.exit(1);
      }).catch(() => {
        process.exit(1);
      });
    });

    // 未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('[Main] 未处理的Promise拒绝:', reason);
      logger.error('[Main] Promise:', promise);
    });
  }

  /**
   * 启动独立Toolbar服务
   */
  async start(): Promise<void> {
    try {
      logger.info('[Main]启动独立Toolbar服务...');
      
      // 启动Toolbar服务器
      await this.toolbarServer.start();
      
      const status = this.toolbarServer.getToolbarStatus();
      
      logger.info('[Main]独立Toolbar服务启动成功!');
      logger.info(`[Main]服务端口: ${status.port}`);
      logger.info(`[Main]SRPC连接: ${status.connected ? '已连接' : '等待连接'}`);
      logger.info(`[Main]广播客户端: ${status.broadcastClients} 个`);
      logger.info(`[Main]已注册RPC方法: ${status.registeredMethods.join(', ')}`);
      logger.info('[Main]Stagewise工具栏可以连接到 ws://localhost:5748');
      logger.info('[Main]WebService可以连接到 ws://localhost:5748/broadcast');
      
    } catch (error) {
      logger.error('[Main] 启动独立Toolbar服务失败:', error);
      throw error;
    }
  }

  /**
   * 停止独立Toolbar服务
   */
  async stop(): Promise<void> {
    try {
      logger.info('[Main] 停止独立Toolbar服务...');
      
      if (this.toolbarServer.isRunning()) {
        await this.toolbarServer.stop();
      }
      
      logger.info('[Main] 独立Toolbar服务已停止');
      
    } catch (error) {
      logger.error('[Main] 停止独立Toolbar服务失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus() {
    return {
      running: this.toolbarServer.isRunning(),
      port: this.toolbarServer.getPort(),
      toolbar: this.toolbarServer.getToolbarStatus(),
      service: 'standalone-toolbar-service',
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      pid: process.pid
    };
  }
}

/**
 * 主函数 - 程序入口点
 */
async function main(): Promise<void> {
  try {
    // 设置日志级别
    logger.setLevel('info');
    
    logger.info('[Main]独立Toolbar服务 v1.0.0 启动中...');
    logger.info('[Main]进程ID:', process.pid);
    logger.info('[Main]Node.js版本:', process.version);
    
    // 创建并启动服务
    const service = new StandaloneToolbarService();
    await service.start();
    
    // 保持进程运行
    logger.info('[Main]服务正在运行，按 Ctrl+C 停止...');
    
    // 定期输出状态信息（可选）
    setInterval(() => {
      const status = service.getStatus();
      logger.debug(`[Main] 状态检查 - 运行: ${status.running}, 客户端: ${status.toolbar.broadcastClients}, 内存: ${Math.round(status.memory.heapUsed / 1024 / 1024)}MB`);
    }, 60000); // 每分钟输出一次状态
    
  } catch (error) {
    logger.error('[Main] 启动失败:', error);
    process.exit(1);
  }
}

// 启动应用
main().catch((error) => {
  logger.error('[Main] 主函数执行失败:', error);
  process.exit(1);
}); 