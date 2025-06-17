/**
 * MCP Feedback Collector - MCP服务器实现
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolResult, ImageContent, TextContent, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import express from 'express';
import { z } from 'zod';
import { CollectFeedbackParams, Config, FeedbackData, ImageData, MCPError, TransportMode } from '../types/index.js';
import { ClientIdentifier } from '../utils/client-identifier.js';
import { logger } from '../utils/logger.js';
import { PromptManager } from '../utils/prompt-manager.js';
import { ToolbarServer } from './toolbar-server.js';
import { WebServer } from './web-server.js';

/**
 * MCP服务器类
 */
export class MCPServer {
  private webServer: WebServer;
  private toolbarServer: ToolbarServer;
  private config: Config;
  private isRunning = false;
  private clientIdentifier: ClientIdentifier;
  private promptManager: PromptManager;
  
  // HTTP传输相关
  private httpApp?: express.Application;
  private httpServer?: any;
  private transports: Record<string, StreamableHTTPServerTransport> = {};

  constructor(config: Config, webServer?: WebServer) {
    this.config = config;
    this.clientIdentifier = ClientIdentifier.getInstance();
    this.promptManager = new PromptManager();

    if (webServer) {
      // 使用传入的WebServer实例（用于stdio模式的多客户端支持）
      this.webServer = webServer;
      logger.debug(`使用传入的WebServer实例，客户端ID: ${this.clientIdentifier.getClientId()}`);
    } else {
      // 创建新的WebServer实例（保持向后兼容）
      this.webServer = new WebServer(config);
      logger.debug('创建新的WebServer实例');
    }

    // 创建Toolbar服务器实例
    this.toolbarServer = new ToolbarServer();
  }

  /**
   * 创建MCP服务器实例
   */
  private createMcpServerInstance(): McpServer {
    const server = new McpServer({
      name: 'mcp-feedback-collector',
      version: '2.0.8'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // 注册collect_feedback工具
    server.registerTool(
      'collect_feedback',
      {
        description: 'Collect feedback from users about AI work summary. This tool opens a web interface for users to provide feedback on the AI\'s work.',
        inputSchema: {
          work_summary: z.string().describe('AI工作汇报内容，描述AI完成的工作和结果')
        }
      },
      async (args: { work_summary: string }): Promise<CallToolResult> => {
        const params: CollectFeedbackParams = {
          work_summary: args.work_summary
        };

        logger.mcp('collect_feedback', params);

        try {
          const result = await this.collectFeedback(params);
          logger.mcp('collect_feedback', params, result);
          return result;
        } catch (error) {
          logger.error('collect_feedback工具调用失败:', error);

          if (error instanceof MCPError) {
            throw error;
          }

          throw new MCPError(
            'Failed to collect feedback',
            'COLLECT_FEEDBACK_ERROR',
            error
          );
        }
      }
    );

    return server;
  }

  /**
   * 初始化HTTP传输模式
   */
  private async initializeHttpTransport(): Promise<void> {
    if (!this.config.mcpPort) {
      throw new MCPError('MCP HTTP port not configured', 'HTTP_PORT_NOT_CONFIGURED');
    }

    this.httpApp = express();
    this.httpApp.use(express.json());

    // 设置CORS
    this.httpApp.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', this.config.corsOrigin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, mcp-session-id');
      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
        return;
      }
      next();
    });

    // StreamableHTTP端点 - 按官方文档标准
    this.httpApp.post('/mcp', async (req, res) => {
      await this.handlePostRequest(req, res);
    });
    
    this.httpApp.get('/mcp', async (req, res) => {
      await this.handleGetRequest(req, res);
    });
    
    this.httpApp.delete('/mcp', async (req, res) => {
      await this.handleDeleteRequest(req, res);
    });

    // MCP会话调试端点
    this.httpApp.get('/api/mcp-debug', (req, res) => {
      const transportIds = Object.keys(this.transports);
      const webServerStats = this.webServer.getSessionMappingStats();
      
      res.json({
        timestamp: new Date().toISOString(),
        activeMcpTransports: transportIds,
        totalMcpTransports: transportIds.length,
        webServerMappings: webServerStats.socketMcpMappings,
        sessionStorageStats: webServerStats.sessionStorageStats
      });
    });

    // 启动HTTP服务器
    return new Promise((resolve, reject) => {
      this.httpServer = this.httpApp!.listen(this.config.mcpPort, () => {
        logger.info(`✅ MCP HTTP服务器启动成功，端口: ${this.config.mcpPort}`);
        resolve();
      });

      this.httpServer.on('error', (error: any) => {
        logger.error('MCP HTTP服务器启动失败:', error);
        reject(error);
      });
    });
  }

  /**
   * 处理POST请求 - 客户端到服务器通信
   */
  private async handlePostRequest(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    try {
      if (sessionId && this.transports[sessionId]) {
        // 重用现有传输
        transport = this.transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // 新的初始化请求
        console.log('new-sessionId', sessionId);
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            // 存储传输
            this.transports[sessionId] = transport;
          }
        });

        // 清理传输当关闭时
        transport.onclose = () => {
          if (transport.sessionId) {
            delete this.transports[transport.sessionId];
            // 清理关联的反馈会话
            this.webServer.cleanupMcpSession(transport.sessionId);
          }
        };

        const server = this.createMcpServerInstance();
        
        // 连接到MCP服务器
        await server.connect(transport as any);
      } else {
        // 无效请求
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }

      // 处理请求
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      logger.error('POST请求处理失败:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  }

  /**
   * 处理GET请求 - 服务器到客户端通知
   */
  private async handleGetRequest(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = this.transports[sessionId];
    console.log('sessionId', sessionId);
    await transport.handleRequest(req, res);
  }

  /**
   * 处理DELETE请求 - 会话终止
   */
  private async handleDeleteRequest(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    
    const transport = this.transports[sessionId];
    await transport.handleRequest(req, res);
  }





  /**
   * 实现collect_feedback功能
   */
  private async collectFeedback(params: CollectFeedbackParams): Promise<CallToolResult> {
    const { work_summary } = params;
    const timeout_seconds = this.config.dialogTimeout;

    // 简化会话ID获取 - 从活跃传输中获取第一个会话ID
    const activeSessionIds = Object.keys(this.transports);
    const mcpSessionId = activeSessionIds.length > 0 ? activeSessionIds[0] : undefined;
    
    logger.info(`开始收集反馈，工作汇报长度: ${work_summary.length}字符，超时: ${timeout_seconds}秒，MCP会话: ${mcpSessionId || 'unknown'}`);

    try {
      // 启动Web服务器（如果未运行）
      if (!this.webServer.isRunning()) {
        await this.webServer.start();
      }

      // 收集用户反馈，传递MCP会话ID
      const feedback = await this.webServer.collectFeedback(work_summary, timeout_seconds, mcpSessionId);

      logger.info(`反馈收集完成，收到 ${feedback.length} 条反馈，MCP会话: ${mcpSessionId || 'unknown'}`);

      // 格式化反馈数据为MCP内容（支持图片）
      const content = this.formatFeedbackForMCP(feedback);

      return {
        content,
        isError: false
      };

    } catch (error) {
      logger.error('反馈收集失败:', error);

      const errorMessage = error instanceof MCPError ? error.message : 'Failed to collect user feedback';

      return {
        content: [{
          type: 'text',
          text: `错误: ${errorMessage}`
        }],
        isError: true
      };
    }
  }

  /**
   * 将反馈数据格式化为MCP内容（支持图片显示）
   */
  private formatFeedbackForMCP(feedback: FeedbackData[]): (TextContent | ImageContent)[] {
    if (feedback.length === 0) {
      return [{
        type: 'text',
        text: '未收到用户反馈'
      }];
    }

    const content: (TextContent | ImageContent)[] = [];


    feedback.forEach((item, index) => {

      // 添加文字反馈
      if (item.text) {
        content.push({
          type: 'text',
          text: `${item.text}`
        });
      }

      // 添加图片（转换为base64格式）
      if (item.images && item.images.length > 0) {
        content.push({
          type: 'text',
          text: `图片数量: ${item.images.length}`
        });

        item.images.forEach((img: ImageData, imgIndex: number) => {
          // 添加图片信息
          content.push({
            type: 'text',
            text: `图片 ${imgIndex + 1}: ${img.name} (${img.type}, ${(img.size / 1024).toFixed(1)}KB)`
          });

          // 添加图片内容（Cursor格式）
          if (img.data) {
            // 确保是纯净的base64数据（移除data:image/...;base64,前缀）
            const base64Data = img.data.replace(/^data:image\/[^;]+;base64,/, '');

            content.push({
              type: 'image',
              data: base64Data, // 纯净的base64字符串
              mimeType: img.type
            });
          }
        });
      }

      // 添加时间戳
      content.push({
        type: 'text',
        text: `提交时间: ${new Date(item.timestamp).toLocaleString()}\n`
      });
    });

    return content;
  }

  /**
   * 将反馈数据格式化为文本（保留用于其他用途）
   */
  private formatFeedbackAsText(feedback: FeedbackData[]): string {
    if (feedback.length === 0) {
      return '未收到用户反馈';
    }

    const parts: string[] = [];
    parts.push(`收到 ${feedback.length} 条用户反馈：\n`);

    feedback.forEach((item, index) => {
      parts.push(`--- 反馈 ${index + 1} ---`);

      if (item.text) {
        parts.push(`文字反馈: ${item.text}`);
      }

      if (item.images && item.images.length > 0) {
        parts.push(`图片数量: ${item.images.length}`);
        item.images.forEach((img: ImageData, imgIndex: number) => {
          parts.push(`  图片 ${imgIndex + 1}: ${img.name} (${img.type}, ${(img.size / 1024).toFixed(1)}KB)`);
        });
      }

      parts.push(`提交时间: ${new Date(item.timestamp).toLocaleString()}`);
      parts.push('');
    });

    return parts.join('\n');
  }

  /**
   * 启动MCP服务器
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('MCP服务器已在运行中');
      return;
    }

    try {
      logger.info('正在启动MCP服务器...');
      
      // 并行启动Web服务器和Toolbar服务器
      await Promise.all([
        this.webServer.start(),
        this.toolbarServer.start()
      ]);
      
      // 根据配置选择传输模式（默认使用stdio）
      const transportMode = this.config.transportMode || TransportMode.STDIO;
      logger.info(`使用传输模式: ${transportMode}`);
      
      switch (transportMode) {
        case TransportMode.MCP:
          // 启动HTTP传输
          await this.initializeHttpTransport();
          logger.info(`✅ MCP服务器启动成功 (${transportMode}模式)`);
          break;
          
        case TransportMode.STDIO:
          // 启动stdio传输
          await this.startStdioTransport();
          logger.info('✅ MCP服务器启动成功 (stdio模式)');
          break;
          
        default:
          logger.error(`不支持的传输模式: ${transportMode}`);
          throw new MCPError(
            `Unsupported transport mode: ${transportMode}`,
            'UNSUPPORTED_TRANSPORT_MODE'
          );
      }
      
      this.isRunning = true;
      
    } catch (error) {
      logger.error('MCP服务器启动失败:', error);
      throw new MCPError(
        'Failed to start MCP server',
        'SERVER_START_ERROR',
        error
      );
    }
  }

  /**
   * 启动stdio传输
   */
  private async startStdioTransport(): Promise<void> {
    // 连接MCP传输
    const transport = new StdioServerTransport();

    // 设置传输错误处理
    transport.onerror = (error: Error) => {
      logger.error('MCP传输错误:', error);
    };

    transport.onclose = () => {
      logger.info('MCP传输连接已关闭');
      this.isRunning = false;
    };

    // 添加消息调试
    const originalOnMessage = transport.onmessage;
    transport.onmessage = (message) => {
      logger.debug('📥 收到MCP消息:', JSON.stringify(message, null, 2));
      if (originalOnMessage) {
        originalOnMessage(message);
      }
    };

    const originalSend = transport.send.bind(transport);
    transport.send = (message) => {
      logger.debug('📤 发送MCP消息:', JSON.stringify(message, null, 2));
      return originalSend(message);
    };

    const server = this.createMcpServerInstance();
    await server.connect(transport);
  }

  /**
   * 仅启动Web模式
   */
  async startWebOnly(): Promise<void> {
    try {
      logger.info('正在启动Web模式...');
      
      // 启动Web服务器和Toolbar服务器
      await Promise.all([
        this.webServer.start(),
        this.toolbarServer.start()
      ]);
      
      this.isRunning = true;
      logger.info('✅ Web服务器启动成功');
      
      // 保持进程运行
      process.stdin.resume();
      
    } catch (error) {
      logger.error('Web服务器启动失败:', error);
      throw new MCPError(
        'Failed to start web server',
        'WEB_SERVER_START_ERROR',
        error
      );
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      logger.info('正在停止服务器...');
      
      // 关闭所有活跃的传输连接
      for (const [sessionId, transport] of Object.entries(this.transports)) {
        try {
          if (transport && typeof transport.close === 'function') {
            await transport.close();
          }
          delete this.transports[sessionId];
          logger.debug(`已关闭传输会话: ${sessionId}`);
        } catch (error) {
          logger.warn(`关闭传输会话失败 ${sessionId}:`, error);
        }
      }
      
      // 关闭HTTP服务器
      if (this.httpServer) {
        await new Promise<void>((resolve, reject) => {
          this.httpServer.close((error: any) => {
            if (error) {
              logger.warn('HTTP服务器关闭时出现错误:', error);
              reject(error);
            } else {
              logger.debug('HTTP服务器已关闭');
              resolve();
            }
          });
        });
        this.httpServer = undefined;
        delete (this as any).httpApp;
      }
      
      // 并行停止Web服务器和Toolbar服务器
      await Promise.all([
        this.webServer.stop(),
        this.toolbarServer.stop()
      ]);
      
      // 关闭提示词管理器
      this.promptManager.close();
      
      // MCP服务器实例会随传输关闭自动清理
      
      this.isRunning = false;
      logger.info('✅ 服务器已停止');
      
    } catch (error) {
      logger.error('停止服务器时出错:', error);
      throw new MCPError(
        'Failed to stop server',
        'SERVER_STOP_ERROR',
        error
      );
    }
  }

  /**
   * 获取客户端ID
   */
  getClientId(): string {
    return this.clientIdentifier.generateClientId();
  }

  /**
   * 获取服务器状态
   */
  getStatus(): { 
    running: boolean; 
    webPort?: number;
    toolbarPort?: number;
    toolbarStatus?: any;
    clientId?: string;
  } {
    const result: { 
      running: boolean; 
      webPort?: number;
      toolbarPort?: number;
      toolbarStatus?: any;
      clientId?: string;
    } = {
      running: this.isRunning
    };

    if (this.webServer.isRunning()) {
      result.webPort = this.webServer.getPort();
    }

    if (this.toolbarServer.isRunning()) {
      result.toolbarPort = this.toolbarServer.getPort();
    }

    result.toolbarStatus = this.toolbarServer.getToolbarStatus();

    const clientId = this.clientIdentifier.getClientId();
    if (clientId) {
      result.clientId = clientId;
    }

    return result;
  }
}
