import cors from 'cors';
import express from 'express';
import * as http from 'http';
import { createServer } from 'http';
import { createSRPCBridge, SRPCWebSocketBridge, ToolbarRPCHandler } from '../toolbar/index.js';
import { logger } from '../utils/logger.js';
import { PortManager } from '../utils/port-manager.js';

/**
 * Toolbar专用服务器类
 * 提供SRPC WebSocket通信和Toolbar相关API
 */
export class ToolbarServer {
  private app: express.Application;
  private server: any;
  private port: number = 0;
  private isServerRunning = false;
  private portManager: PortManager;
  private srpcBridge: SRPCWebSocketBridge | null = null;
  private toolbarRPCHandler: ToolbarRPCHandler | null = null;

  constructor() {
    this.portManager = new PortManager();

    // 创建Express应用
    this.app = express();
    
    // 创建HTTP服务器
    this.server = createServer(this.app);

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // CORS中间件
    this.app.use(cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
    }));
    
    // JSON解析中间件
    this.app.use(express.json());

    // 请求日志中间件
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`[Toolbar] ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`);
      });
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // Ping端点 - 工具栏用于发现服务
    this.app.get('/ping/stagewise', (req, res) => {
      logger.info('[Toolbar] Ping request received');
      res.send('stagewise');
    });

    // 健康检查端点
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'toolbar-server',
        port: this.port,
        srpcConnected: this.srpcBridge?.isConnected() || false
      });
    });

    // Toolbar状态API
    this.app.get('/api/toolbar/status', (req, res) => {
      const toolbarStatus = {
        enabled: true,
        srpcConnected: this.srpcBridge?.isConnected() || false,
        registeredMethods: this.srpcBridge?.getRegisteredMethods() || [],
        service: 'toolbar-server',
        timestamp: new Date().toISOString(),
        port: this.port,
        uptime: process.uptime()
      };
      
      logger.info('[Toolbar] Status requested:', toolbarStatus);
      res.json(toolbarStatus);
    });

    // 简单的prompt端点（备用）
    this.app.post('/prompt', (req, res) => {
      logger.info('[Toolbar] Received prompt:', req.body);
      res.json({ 
        success: true, 
        message: 'Prompt received',
        data: req.body 
      });
    });

    // 跨服务prompt转发端点
    this.app.post('/api/send-prompt', async (req, res) => {
      try {
        const { prompt, sessionId, model, files, images, mode, metadata } = req.body;
        
        if (!prompt) {
          res.status(400).json({ error: 'Prompt is required' });
          return;
        }

        logger.info(`[Toolbar] 接收到prompt转发请求: ${prompt.substring(0, 100)}...`);

        // 转发prompt到WebServer
        const result = await this.forwardPromptToWebServer({
          prompt,
          sessionId: sessionId || `toolbar_${Date.now()}`,
          model,
          files,
          images,
          mode,
          metadata: {
            ...metadata,
            source: 'toolbar',
            timestamp: Date.now(),
            toolbarPort: this.port
          }
        });

        res.json({
          success: true,
          message: 'Prompt forwarded successfully',
          result
        });

      } catch (error) {
        logger.error('[Toolbar] Prompt转发失败:', error);
        res.status(500).json({
          error: 'Failed to forward prompt',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 404处理
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // 错误处理
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('[Toolbar] Server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * 设置SRPC相关处理
   */
  private setupSRPCHandlers(): void {
    try {
      // 创建 SRPC WebSocket 桥接器
      this.srpcBridge = createSRPCBridge(this.server);
      
      if (this.srpcBridge) {
        // 创建 Toolbar RPC 处理器，传递prompt转发函数
        this.toolbarRPCHandler = new ToolbarRPCHandler(
          this.srpcBridge,
          this.forwardPromptToWebServer.bind(this)
        );
        
        logger.info('[Toolbar] ✅ SRPC WebSocket 桥接器初始化成功');
        logger.info('[Toolbar] ✅ Toolbar RPC 处理器初始化成功');
        
        // 记录已注册的方法
        const registeredMethods = this.srpcBridge.getRegisteredMethods();
        logger.info(`[Toolbar] 📋 已注册的 RPC 方法: ${registeredMethods.join(', ')}`);
      }
      
    } catch (error) {
      logger.error('[Toolbar] ❌ SRPC 初始化失败:', error);
      // 不抛出错误，允许服务器继续运行
    }
  }

  /**
   * 启动Toolbar服务器
   */
  async start(): Promise<void> {
    if (this.isServerRunning) {
      logger.warn('[Toolbar] 服务器已在运行中');
      return;
    }

    try {
      // 优先尝试使用端口5749，如果被占用则从5746开始查找
      this.port = await this.portManager.findToolbarPort(5749);

      logger.info(`[Toolbar] 准备在端口 ${this.port} 启动服务器...`);

      // 启动服务器
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Toolbar server start timeout'));
        }, 10000);

        this.server.listen(this.port, (error?: Error) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // 服务器启动成功后初始化SRPC
      this.setupSRPCHandlers();

      this.isServerRunning = true;

      logger.info(`[Toolbar] ✅ Toolbar服务器启动成功: http://localhost:${this.port}`);
      logger.info(`[Toolbar] 📡 WebSocket端点: ws://localhost:${this.port}`);
      logger.info(`[Toolbar] 🔍 Ping端点: http://localhost:${this.port}/ping/stagewise`);
      logger.info(`[Toolbar] ❤️  健康检查: http://localhost:${this.port}/health`);
      logger.info(`[Toolbar] 📝 Prompt端点: http://localhost:${this.port}/prompt`);

    } catch (error) {
      logger.error('[Toolbar] 服务器启动失败:', error);
      throw new Error(`Failed to start toolbar server: ${error}`);
    }
  }

  /**
   * 停止Toolbar服务器
   */
  async stop(): Promise<void> {
    if (!this.isServerRunning) {
      return;
    }

    const currentPort = this.port;
    logger.info(`[Toolbar] 正在停止服务器 (端口: ${currentPort})...`);

    try {
      // 关闭SRPC桥接器
      if (this.srpcBridge) {
        this.srpcBridge.close();
        this.srpcBridge = null;
      }

      // 关闭HTTP服务器
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Toolbar server close timeout'));
        }, 5000);

        this.server.close((error?: Error) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      this.isServerRunning = false;
      logger.info(`[Toolbar] ✅ Toolbar服务器已停止 (端口: ${currentPort})`);

    } catch (error) {
      logger.error('[Toolbar] 停止服务器时出错:', error);
      throw error;
    }
  }

  /**
   * 检查服务器是否运行
   */
  isRunning(): boolean {
    return this.isServerRunning;
  }

  /**
   * 获取服务器端口
   */
  getPort(): number {
    return this.port;
  }

  /**
   * 获取 Toolbar 状态
   */
  getToolbarStatus() {
    return {
      enabled: this.srpcBridge !== null,
      connected: this.srpcBridge?.isConnected() || false,
      registeredMethods: this.srpcBridge?.getRegisteredMethods() || [],
      rpcHandlerActive: this.toolbarRPCHandler !== null,
      port: this.port,
      running: this.isServerRunning
    };
  }

  /**
   * 转发prompt到WebServer
   */
  private async forwardPromptToWebServer(promptData: {
    prompt: string;
    sessionId: string;
    model?: string;
    files?: any[];
    images?: any[];
    mode?: string;
    metadata?: any;
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      // 获取WebServer的端口（通常是3000或从环境变量获取）
      const webServerPort = process.env['MCP_WEB_PORT'] || '5000';
      const webServerHost = process.env['WEB_SERVER_HOST'] || 'localhost';
      
      const postData = JSON.stringify(promptData);
      
      const options = {
        hostname: webServerHost,
        port: webServerPort,
        path: '/api/receive-prompt',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'ToolbarServer/1.0'
        },
        timeout: 10000 // 10秒超时
      };

      logger.info(`[Toolbar] 正在转发prompt到WebServer: http://${webServerHost}:${webServerPort}/api/receive-prompt`);

      const req = http.request(options, (res) => {
        let responseData = '';

        res.on('data', (chunk) => {
          responseData += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              const result = responseData ? JSON.parse(responseData) : {};
              logger.info(`[Toolbar] Prompt转发成功: ${res.statusCode}`);
              resolve(result);
            } else {
              logger.error(`[Toolbar] Prompt转发失败: HTTP ${res.statusCode} - ${responseData}`);
              reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
            }
          } catch (error) {
            logger.error('[Toolbar] 解析WebServer响应失败:', error);
            reject(new Error(`Failed to parse response: ${error}`));
          }
        });
      });

      req.on('error', (error) => {
        logger.error('[Toolbar] 请求WebServer失败:', error);
        reject(new Error(`Request failed: ${error.message}`));
      });

      req.on('timeout', () => {
        logger.error('[Toolbar] 请求WebServer超时');
        req.destroy();
        reject(new Error('Request timeout'));
      });

      // 发送数据
      req.write(postData);
      req.end();
    });
  }
} 