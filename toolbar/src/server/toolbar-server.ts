import cors from 'cors';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createSRPCBridge, SRPCWebSocketBridge, ToolbarRPCHandler } from '../toolbar/index.js';
import { PromptBroadcastData, WebSocketClient } from '../toolbar/types/index.js';
import { logger } from '../utils/logger.js';
import { SimplePortManager } from '../utils/port-manager.js';

/**
 * 独立的Toolbar服务器类
 * 提供SRPC WebSocket通信、WebSocket广播和Toolbar相关API
 */
export class ToolbarServer {
  private app: express.Application;
  private server: any;
  private port: number = 5748;
  private isServerRunning = false;
  private portManager: SimplePortManager;
  private srpcBridge: SRPCWebSocketBridge | null = null;
  private toolbarRPCHandler: ToolbarRPCHandler | null = null;
  
  // WebSocket广播相关 - 独立服务器
  private broadcastApp: express.Application;
  private broadcastServer: any;
  private broadcastPort: number = 15749;
  private broadcastWss: WebSocketServer | null = null;
  private clients: Map<string, WebSocketClient> = new Map();
  private latestPrompt: PromptBroadcastData | null = null;

  constructor() {
    this.portManager = new SimplePortManager();

    // 创建SRPC服务的Express应用
    this.app = express();
    this.server = createServer(this.app);

    // 创建广播服务的Express应用
    this.broadcastApp = express();
    this.broadcastServer = createServer(this.broadcastApp);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupBroadcastRoutes();
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
        logger.request(req.method, req.url, res.statusCode, duration);
      });
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 静态文件服务 - 提供frontend目录下的文件
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const frontendPath = path.join(__dirname, '../frontend');
    this.app.use(express.static(frontendPath));
    
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
        service: 'standalone-toolbar-service',
        port: this.port,
        srpcConnected: this.srpcBridge?.isConnected() || false,
        broadcastClients: this.clients.size,
        version: '1.0.0'
      });
    });

    // Toolbar状态API
    this.app.get('/api/toolbar/status', (req, res) => {
      const toolbarStatus = {
        enabled: true,
        srpcConnected: this.srpcBridge?.isConnected() || false,
        registeredMethods: this.srpcBridge?.getRegisteredMethods() || [],
        service: 'standalone-toolbar-service',
        timestamp: new Date().toISOString(),
        port: this.port,
        uptime: process.uptime(),
        broadcastClients: this.clients.size,
        latestPromptTime: this.latestPrompt?.timestamp
      };
      
      logger.info('[Toolbar] Status requested:', toolbarStatus);
      res.json(toolbarStatus);
    });

    // 获取最新prompt
    this.app.get('/api/latest-prompt', (req, res) => {
      if (this.latestPrompt) {
        res.json({
          success: true,
          data: this.latestPrompt
        });
      } else {
        res.json({
          success: false,
          message: 'No prompt available'
        });
      }
    });

    // WebSocket客户端列表
    this.app.get('/api/clients', (req, res) => {
      const clientList = Array.from(this.clients.values()).map(client => ({
        id: client.id,
        connected: client.connected,
        lastActivity: client.lastActivity
      }));
      
      res.json({
        success: true,
        data: {
          clients: clientList,
          total: clientList.length
        }
      });
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
   * 设置广播服务器路由
   */
  private setupBroadcastRoutes(): void {
    // CORS中间件
    this.broadcastApp.use(cors({
      origin: '*',
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
    }));
    
    // JSON解析中间件
    this.broadcastApp.use(express.json());

    // 健康检查端点
    this.broadcastApp.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        service: 'standalone-toolbar-broadcast-service',
        port: this.broadcastPort,
        clients: this.clients.size,
        version: '1.0.0'
      });
    });

    // 广播状态API
    this.broadcastApp.get('/api/broadcast/status', (req, res) => {
      const broadcastStatus = {
        enabled: true,
        clients: this.clients.size,
        service: 'standalone-toolbar-broadcast-service',
        timestamp: new Date().toISOString(),
        port: this.broadcastPort,
        uptime: process.uptime(),
        latestPromptTime: this.latestPrompt?.timestamp
      };
      
      logger.info('[Toolbar Broadcast] Status requested:', broadcastStatus);
      res.json(broadcastStatus);
    });

    // 404处理
    this.broadcastApp.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // 错误处理
    this.broadcastApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('[Toolbar Broadcast] Server error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * 设置WebSocket广播服务器
   */
  private setupWebSocketBroadcast(): void {
    // 创建WebSocket服务器用于广播，使用独立的HTTP服务器
    this.broadcastWss = new WebSocketServer({ 
      server: this.broadcastServer,
      path: '/broadcast'
    });

    this.broadcastWss.on('connection', (ws, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const client: WebSocketClient = {
        id: clientId,
        ws: ws,
        connected: true,
        lastActivity: new Date()
      };

      this.clients.set(clientId, client);
      logger.info(`[Toolbar Broadcast] WebSocket client connected: ${clientId}, total clients: ${this.clients.size}`);

      // 如果有最新的prompt，立即发送给新连接的客户端
      if (this.latestPrompt) {
        this.sendToClient(client, 'prompt_received', this.latestPrompt);
      }

      // 发送欢迎消息
      this.sendToClient(client, 'welcome', {
        clientId,
        service: 'standalone-toolbar-broadcast-service',
        version: '1.0.0',
        timestamp: Date.now()
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          logger.socket('message_received', clientId, message);
          client.lastActivity = new Date();
          
          // 处理客户端消息（如心跳等）
          if (message.type === 'ping') {
            this.sendToClient(client, 'pong', { timestamp: Date.now() });
          }
        } catch (error) {
          logger.error(`[Toolbar Broadcast] Error parsing message from client ${clientId}:`, error);
        }
      });

      ws.on('close', () => {
        client.connected = false;
        this.clients.delete(clientId);
        logger.info(`[Toolbar Broadcast] WebSocket client disconnected: ${clientId}, remaining clients: ${this.clients.size}`);
      });

      ws.on('error', (error) => {
        logger.error(`[Toolbar Broadcast] WebSocket error for client ${clientId}:`, error);
        client.connected = false;
        this.clients.delete(clientId);
      });
    });

    logger.info('[Toolbar Broadcast] WebSocket broadcast server initialized');
  }

  /**
   * 发送消息给特定客户端
   */
  private sendToClient(client: WebSocketClient, event: string, data: any): void {
    if (client.connected && client.ws.readyState === client.ws.OPEN) {
      try {
        const message = JSON.stringify({ event, data, timestamp: Date.now() });
        client.ws.send(message);
        logger.socket('message_sent', client.id, { event, dataSize: JSON.stringify(data).length });
      } catch (error) {
        logger.error(`[Toolbar] Error sending message to client ${client.id}:`, error);
        client.connected = false;
        this.clients.delete(client.id);
      }
    }
  }

  /**
   * 广播消息到所有连接的客户端
   */
  private broadcastToAllClients(event: string, data: any): void {
    const connectedClients = Array.from(this.clients.values()).filter(client => client.connected);
    
    logger.info(`[Toolbar] Broadcasting ${event} to ${connectedClients.length} clients`);
    
    connectedClients.forEach(client => {
      this.sendToClient(client, event, data);
    });

    // 清理断开的连接
    this.cleanupDisconnectedClients();
  }

  /**
   * 清理断开的客户端连接
   */
  private cleanupDisconnectedClients(): void {
    const disconnectedClients: string[] = [];
    
    this.clients.forEach((client, clientId) => {
      if (!client.connected || client.ws.readyState !== client.ws.OPEN) {
        disconnectedClients.push(clientId);
      }
    });

    disconnectedClients.forEach(clientId => {
      this.clients.delete(clientId);
      logger.debug(`[Toolbar] Cleaned up disconnected client: ${clientId}`);
    });
  }

  /**
   * 广播prompt到所有WebService客户端
   */
  private async broadcastPromptToClients(promptData: PromptBroadcastData): Promise<any> {
    // 存储最新的prompt
    this.latestPrompt = {
      ...promptData,
      timestamp: Date.now()
    };

    // 广播到所有连接的客户端
    this.broadcastToAllClients('prompt_received', this.latestPrompt);

    logger.toolbar('prompt_broadcasted', { 
      sessionId: promptData.sessionId, 
      clientCount: this.clients.size,
      promptLength: promptData.prompt.length 
    });

    return {
      success: true,
      clientCount: this.clients.size,
      timestamp: this.latestPrompt.timestamp,
      sessionId: promptData.sessionId
    };
  }

  /**
   * 设置SRPC相关处理
   */
  private setupSRPCHandlers(): void {
    try {
      // 创建 SRPC WebSocket 桥接器
      this.srpcBridge = createSRPCBridge(this.server);
      
      if (this.srpcBridge) {
        // 创建 Toolbar RPC 处理器，传递广播回调函数
        this.toolbarRPCHandler = new ToolbarRPCHandler(
          this.srpcBridge,
          this.broadcastPromptToClients.bind(this)
        );
        
        logger.debug('[Toolbar] SRPC WebSocket 桥接器初始化成功');
        logger.debug('[Toolbar] Toolbar RPC 处理器初始化成功');
        
        // 记录已注册的方法
        const registeredMethods = this.srpcBridge.getRegisteredMethods();
        logger.debug(`[Toolbar] 已注册的 RPC 方法: ${registeredMethods.join(', ')}`);
      }
      
    } catch (error) {
      logger.error('[Toolbar] SRPC 初始化失败:', error);
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
      // 检查所有端口可用性
      logger.debug('[Toolbar] 检查所有端口可用性...');
      const portStatus = await this.portManager.checkAllPorts();
      
      if (!portStatus.allAvailable) {
        const errors = [];
        if (!portStatus.toolbarPort) {
          errors.push(`SRPC端口 ${this.port} 不可用`);
        }
        if (!portStatus.broadcastPort) {
          errors.push(`广播端口 ${this.broadcastPort} 不可用`);
        }
        throw new Error(`端口检查失败: ${errors.join(', ')}`);
      }

      // 确认SRPC端口
      this.port = await this.portManager.getToolbarPort();
      logger.debug(`[Toolbar] 准备在端口 ${this.port} 启动SRPC服务器...`);

      // 启动SRPC服务器
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('SRPC server start timeout'));
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

      // SRPC服务器启动成功后初始化SRPC处理器
      this.setupSRPCHandlers();

      logger.info(`[Toolbar] SRPC服务器启动成功: http://localhost:${this.port}`);
      logger.info(`[Toolbar]SRPC WebSocket端点: ws://localhost:${this.port}`);

      // 确认广播端口
      this.broadcastPort = await this.portManager.getBroadcastPort();
      logger.debug(`[Toolbar] 准备在端口 ${this.broadcastPort} 启动广播服务器...`);
      
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Broadcast server start timeout'));
        }, 10000);

        this.broadcastServer.listen(this.broadcastPort, (error?: Error) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // 广播服务器启动成功后初始化WebSocket广播
      this.setupWebSocketBroadcast();

      this.isServerRunning = true;

      logger.info(`[Toolbar]广播服务器启动成功: http://localhost:${this.broadcastPort}`);
      logger.info(`[Toolbar]广播WebSocket端点: ws://localhost:${this.broadcastPort}/broadcast`);
      logger.info(`[Toolbar]Ping端点: http://localhost:${this.port}/ping/stagewise`);
      logger.info(`[Toolbar]健康检查: http://localhost:${this.port}/health`);
      logger.info(`[Toolbar]广播健康检查: http://localhost:${this.broadcastPort}/health`);

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
    const currentBroadcastPort = this.broadcastPort;
    logger.debug(`[Toolbar] 正在停止服务器 (SRPC端口: ${currentPort}, 广播端口: ${currentBroadcastPort})...`);

    try {
      // 关闭WebSocket广播服务器
      if (this.broadcastWss) {
        this.broadcastWss.close();
        this.broadcastWss = null;
      }

      // 关闭所有客户端连接
      this.clients.forEach(client => {
        if (client.connected) {
          client.ws.close();
        }
      });
      this.clients.clear();

      // 关闭SRPC桥接器
      if (this.srpcBridge) {
        this.srpcBridge.close();
        this.srpcBridge = null;
      }

      // 关闭广播HTTP服务器
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Broadcast server close timeout'));
        }, 5000);

        this.broadcastServer.close((error?: Error) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });

      // 关闭SRPC HTTP服务器
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('SRPC server close timeout'));
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
      logger.info(`[Toolbar] 独立Toolbar服务器已停止 (SRPC端口: ${currentPort}, 广播端口: ${currentBroadcastPort})`);

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
      running: this.isServerRunning,
      broadcastClients: this.clients.size,
      service: 'standalone-toolbar-service',
      version: '1.0.0'
    };
  }
}
