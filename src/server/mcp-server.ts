/**
 * MCP Feedback Collector - MCP服务器实现
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolResult, ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'crypto';
import express from 'express';
import { z } from 'zod';
import { CollectFeedbackParams, Config, FeedbackData, ImageData, MCPError, TransportMode } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { ToolbarServer } from './toolbar-server.js';
import { WebServer } from './web-server.js';

/**
 * MCP服务器类
 */
export class MCPServer {
  private mcpServer: McpServer;
  private webServer: WebServer;
  private toolbarServer: ToolbarServer;
  private config: Config;
  private isRunning = false;
  
  // HTTP传输相关
  private httpApp?: express.Application;
  private httpServer?: any;
  private transports: Record<string, StreamableHTTPServerTransport | SSEServerTransport> = {};

  constructor(config: Config) {
    this.config = config;

    // 创建MCP服务器实例
    this.mcpServer = new McpServer({
      name: 'mcp-feedback-collector',
      version: '2.0.8'
    }, {
      capabilities: {
        tools: {}
      }
    });

    // 设置初始化完成回调
    this.mcpServer.server.oninitialized = () => {
      logger.info('✅ MCP初始化完成');
    };

    // 创建Web服务器实例
    this.webServer = new WebServer(config);

    // 创建Toolbar服务器实例
    this.toolbarServer = new ToolbarServer();

    // 注册MCP工具函数
    this.registerTools();
  }

  /**
   * 注册MCP工具函数
   */
  private registerTools(): void {
    // 注册collect_feedback工具 - 使用新的registerTool方法
    this.mcpServer.registerTool(
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

    if (logger.getLevel() !== 'silent') {
      logger.info('MCP工具函数注册完成');
    }
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

    // StreamableHTTP端点
    this.httpApp.all('/mcp', async (req, res) => {
      await this.handleStreamableHttpRequest(req, res);
    });

    // SSE端点（向后兼容）
    if (this.config.enableSSEFallback) {
      this.httpApp.get('/sse', async (req, res) => {
        await this.handleSSEConnection(req, res);
      });

      this.httpApp.post('/messages', async (req, res) => {
        await this.handleSSEMessage(req, res);
      });
    }

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
   * 处理StreamableHTTP请求
   */
  private async handleStreamableHttpRequest(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      let transport: StreamableHTTPServerTransport;

      // 检查是否为初始化请求
      if (!sessionId && this.isInitializeRequest(req.body)) {
        // 创建新的传输
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            this.transports[newSessionId] = transport;
            logger.debug(`StreamableHTTP会话已初始化: ${newSessionId}`);
          }
        });

        // 设置传输事件处理
        transport.onclose = () => {
          if (transport['sessionId']) {
            delete this.transports[transport['sessionId']];
            logger.debug(`StreamableHTTP会话已关闭: ${transport['sessionId']}`);
          }
        };

        transport.onerror = (error: Error) => {
          logger.error('StreamableHTTP传输错误:', error);
        };

        // 连接到MCP服务器
        await this.mcpServer.connect(transport as any);
      } else if (sessionId && this.transports[sessionId]) {
        // 重用现有传输
        transport = this.transports[sessionId] as StreamableHTTPServerTransport;
      } else {
        // 无效请求
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: Invalid session ID or method'
          },
          id: null
        });
        return;
      }

      // 处理请求
      await transport.handleRequest(req, res, req.body);

    } catch (error) {
      logger.error('StreamableHTTP请求处理失败:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal server error'
          },
          id: null
        });
      }
    }
  }

  /**
   * 处理SSE连接（向后兼容）
   */
  private async handleSSEConnection(req: express.Request, res: express.Response): Promise<void> {
    try {
      const transport = new SSEServerTransport('/messages', res);
      const sessionId = (transport as any).sessionId;
      this.transports[sessionId] = transport;

      // 设置传输事件处理
      res.on('close', () => {
        delete this.transports[sessionId];
        logger.debug(`SSE会话已关闭: ${sessionId}`);
      });

      transport.onerror = (error: Error) => {
        logger.error('SSE传输错误:', error);
      };

      // 连接到MCP服务器
      await this.mcpServer.connect(transport as any);
      logger.debug(`SSE会话已建立: ${sessionId}`);

    } catch (error) {
      logger.error('SSE连接处理失败:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  }

  /**
   * 处理SSE消息（向后兼容）
   */
  private async handleSSEMessage(req: express.Request, res: express.Response): Promise<void> {
    const sessionId = req.query['sessionId'] as string;

    if (!sessionId || !this.transports[sessionId]) {
      res.status(400).send('Invalid session ID');
      return;
    }

    try {
      const transport = this.transports[sessionId] as SSEServerTransport;
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logger.error('SSE消息处理失败:', error);
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
    }
  }

  /**
   * 检查是否为初始化请求
   */
  private isInitializeRequest(body: any): boolean {
    if (Array.isArray(body)) {
      return body.some(request => request.method === 'initialize');
    }
    return body && body.method === 'initialize';
  }

  /**
   * 实现collect_feedback功能
   */
  private async collectFeedback(params: CollectFeedbackParams): Promise<CallToolResult> {
    const { work_summary } = params;
    const timeout_seconds = this.config.dialogTimeout;

    logger.info(`开始收集反馈，工作汇报长度: ${work_summary.length}字符，超时: ${timeout_seconds}秒`);

    try {
      // 启动Web服务器（如果未运行）
      if (!this.webServer.isRunning()) {
        await this.webServer.start();
      }

      // 收集用户反馈
      const feedback = await this.webServer.collectFeedback(work_summary, timeout_seconds);

      logger.info(`反馈收集完成，收到 ${feedback.length} 条反馈`);

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
      
      // 根据配置选择传输模式（默认使用streamable_http）
      const transportMode = this.config.transportMode || TransportMode.STREAMABLE_HTTP;
      logger.info(`使用传输模式: ${transportMode}`);
      
      switch (transportMode) {
        case TransportMode.STREAMABLE_HTTP:
        case TransportMode.SSE:
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

    await this.mcpServer.connect(transport);
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
      
      // 关闭MCP服务器
      if (this.mcpServer) {
        await this.mcpServer.close();
      }
      
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
   * 获取服务器状态
   */
  getStatus(): { 
    running: boolean; 
    webPort?: number | undefined;
    toolbarPort?: number | undefined;
    toolbarStatus?: any;
  } {
    return {
      running: this.isRunning,
      webPort: this.webServer.isRunning() ? this.webServer.getPort() : undefined,
      toolbarPort: this.toolbarServer.isRunning() ? this.toolbarServer.getPort() : undefined,
      toolbarStatus: this.toolbarServer.getToolbarStatus()
    };
  }
}
