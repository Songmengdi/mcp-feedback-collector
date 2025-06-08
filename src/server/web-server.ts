/**
 * MCP Feedback Collector - Web服务器实现
 */

import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { VERSION } from '../index.js';

import { Config, FeedbackData, MCPError } from '../types/index.js';
import { ImageProcessor } from '../utils/image-processor.js';
import { logger } from '../utils/logger.js';
import { performanceMonitor } from '../utils/performance-monitor.js';
import { PortManager } from '../utils/port-manager.js';
import { SessionData, SessionStorage } from '../utils/session-storage.js';

/**
 * Web服务器类
 */
export class WebServer {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private config: Config;
  private port: number = 0;
  private isServerRunning = false;
  private portManager: PortManager;
  private imageProcessor: ImageProcessor;
  private sessionStorage: SessionStorage;


  constructor(config: Config) {
    this.config = config;
    this.portManager = new PortManager();
    this.imageProcessor = new ImageProcessor({
      maxFileSize: config.maxFileSize,
      maxWidth: 2048,
      maxHeight: 2048
    });
    this.sessionStorage = new SessionStorage();

    // 创建Express应用
    this.app = express();
    
    // 创建HTTP服务器
    this.server = createServer(this.app);
    
    // 创建Socket.IO服务器
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: config.corsOrigin,
        methods: ['GET', 'POST']
      }
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocketHandlers();
  }

  /**
   * 设置中间件
   */
  private setupMiddleware(): void {
    // 安全中间件
    this.app.use(helmet({
      contentSecurityPolicy: false // 允许内联脚本
    }));
    
    // 压缩中间件
    this.app.use(compression());
    
    // CORS中间件
    this.app.use(cors({
      origin: this.config.corsOrigin,
      credentials: true
    }));
    
    // JSON解析中间件
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '50mb' }));
    
    // 请求日志和性能监控中间件
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        const success = res.statusCode < 400;

        // 记录请求日志
        logger.request(req.method, req.url, res.statusCode, duration);

        // 记录性能指标
        performanceMonitor.recordRequest(duration, success);

        // 记录慢请求
        if (duration > 1000) {
          logger.warn(`慢请求: ${req.method} ${req.path} - ${duration}ms`);
        }
      });
      next();
    });
  }

  /**
   * 设置路由
   */
  private setupRoutes(): void {
    // 获取当前文件的目录路径（ES模块兼容）
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const staticPath = path.resolve(__dirname, '..');

    // 静态文件服务 - 使用绝对路径
    this.app.use(express.static(staticPath));

    // 主页路由
    this.app.get('/', (req, res) => {
      res.sendFile('index.html', { root: staticPath });
    });



    // 测试会话创建路由
    this.app.post('/api/test-session', (req, res) => {
      const { work_summary, timeout_seconds = 300 } = req.body;

      if (!work_summary) {
        res.status(400).json({ error: '缺少work_summary参数' });
        return;
      }

      const sessionId = this.generateSessionId();

      // 创建测试会话
      const session: SessionData = {
        workSummary: work_summary,
        feedback: [],
        startTime: Date.now(),
        timeout: timeout_seconds * 1000
      };

      this.sessionStorage.createSession(sessionId, session);

      // 记录会话创建
      performanceMonitor.recordSessionCreated();

      logger.info(`创建测试会话: ${sessionId}`);

      res.json({
        success: true,
        session_id: sessionId,
        feedback_url: this.generateFeedbackUrl(sessionId)
      });
    });

    // 版本信息API
    this.app.get('/api/version', (req, res) => {
      res.json({
        version: VERSION,
        timestamp: new Date().toISOString()
      });
    });

    // 健康检查路由
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: VERSION,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        active_sessions: this.sessionStorage.getSessionCount()
      });
    });

    // 性能监控路由
    this.app.get('/api/metrics', (req, res) => {
      const metrics = performanceMonitor.getMetrics();
      res.json(metrics);
    });

    // 性能报告路由
    this.app.get('/api/performance-report', (req, res) => {
      const report = performanceMonitor.getFormattedReport();
      res.type('text/plain').send(report);
    });

    // Toolbar 专用路由
    // Ping端点 - 标识为反馈收集服务
    this.app.get('/ping/stagewise', (req, res) => {
      logger.info('Ping request received (feedback collector)');
      res.send('mcp-feedback-collector');
    });

    // 接收来自Toolbar的prompt
    this.app.post('/api/receive-prompt', (req, res) => {
      try {
        const { prompt, sessionId, model, files, images, mode, metadata } = req.body;
        
        if (!prompt) {
          res.status(400).json({ error: 'Prompt is required' });
          return;
        }

        logger.info(`[WebServer] 接收到来自Toolbar的prompt: ${prompt.substring(0, 100)}...`);
        logger.info(`[WebServer] 会话ID: ${sessionId}, 来源: ${metadata?.source || 'unknown'}`);

        // 暂存prompt到SessionStorage
        this.sessionStorage.storePrompt(sessionId, {
          prompt,
          model,
          files,
          images,
          mode,
          metadata,
          timestamp: Date.now()
        });

        // 通过Socket.IO广播prompt到所有连接的客户端
        this.io.emit('prompt_received', {
          sessionId,
          prompt,
          model,
          files,
          images,
          mode,
          metadata,
          timestamp: Date.now()
        });

        logger.info(`[WebServer] Prompt已暂存并广播到前端客户端`);

        res.json({
          success: true,
          message: 'Prompt received and broadcasted',
          sessionId,
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error('[WebServer] 处理prompt失败:', error);
        res.status(500).json({
          error: 'Failed to process prompt',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 获取暂存的prompt
    this.app.get('/api/get-prompt/:sessionId', (req, res) => {
      try {
        const { sessionId } = req.params;
        const promptData = this.sessionStorage.getPrompt(sessionId);

        if (promptData) {
          logger.info(`[WebServer] 返回暂存的prompt: ${sessionId}`);
          res.json({
            success: true,
            data: promptData
          });
        } else {
          res.json({
            success: false,
            message: 'No prompt found for this session'
          });
        }

      } catch (error) {
        logger.error('[WebServer] 获取prompt失败:', error);
        res.status(500).json({
          error: 'Failed to get prompt',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 错误处理中间件
    this.app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
      logger.error('Express错误:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error.message
      });
    });
  }

  /**
   * 设置Socket.IO事件处理
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.socket('connect', socket.id);
      logger.info(`✅ 新的WebSocket连接: ${socket.id}`);

      // 记录WebSocket连接
      performanceMonitor.recordWebSocketConnection();

      // 测试消息处理
      socket.on('test_message', (data: any) => {
        logger.socket('test_message', socket.id, data);
        socket.emit('test_response', { message: 'Test message received!', timestamp: Date.now() });
      });

      // 处理会话请求（固定URL模式）
      socket.on('request_session', () => {
        logger.socket('request_session', socket.id);

        // 查找最新的活跃会话
        const activeSessions = this.sessionStorage.getAllSessions();
        let latestSession: { sessionId: string; session: any } | null = null;

        for (const [sessionId, session] of activeSessions) {
          if (!latestSession || session.startTime > latestSession.session.startTime) {
            latestSession = { sessionId, session };
          }
        }

        if (latestSession) {
          // 有活跃会话，分配给客户端
          logger.info(`为客户端 ${socket.id} 分配会话: ${latestSession.sessionId}`);
          socket.emit('session_assigned', {
            session_id: latestSession.sessionId,
            work_summary: latestSession.session.workSummary
          });
        } else {
          // 无活跃会话
          logger.info(`客户端 ${socket.id} 请求会话，但无活跃会话`);
          socket.emit('no_active_session', {
            message: '当前无活跃的反馈会话'
          });
        }
      });

      // 处理最新工作汇报请求
      socket.on('request_latest_summary', () => {
        logger.socket('request_latest_summary', socket.id);

        // 查找最新的活跃会话
        const activeSessions = this.sessionStorage.getAllSessions();
        let latestSession: { sessionId: string; session: any } | null = null;

        for (const [sessionId, session] of activeSessions) {
          if (!latestSession || session.startTime > latestSession.session.startTime) {
            latestSession = { sessionId, session };
          }
        }

        if (latestSession && latestSession.session.workSummary) {
          // 找到最新的工作汇报
          logger.info(`为客户端 ${socket.id} 返回最新工作汇报`);
          socket.emit('latest_summary_response', {
            success: true,
            work_summary: latestSession.session.workSummary,
            session_id: latestSession.sessionId,
            timestamp: latestSession.session.startTime
          });
        } else {
          // 没有找到工作汇报
          logger.info(`客户端 ${socket.id} 请求最新工作汇报，但未找到`);
          socket.emit('latest_summary_response', {
            success: false,
            message: '暂无最新工作汇报，请等待AI调用collect_feedback工具函数'
          });
        }
      });

      // 获取工作汇报数据
      socket.on('get_work_summary', (data: { feedback_session_id: string }) => {
        logger.socket('get_work_summary', socket.id, data);

        const session = this.sessionStorage.getSession(data.feedback_session_id);
        if (session) {
          socket.emit('work_summary_data', {
            work_summary: session.workSummary
          });
        } else {
          socket.emit('feedback_error', {
            error: '会话不存在或已过期'
          });
        }
      });

      // 提交反馈
      socket.on('submit_feedback', async (data: FeedbackData) => {
        logger.socket('submit_feedback', socket.id, {
          sessionId: data.sessionId,
          textLength: data.text?.length || 0,
          imageCount: data.images?.length || 0
        });

        await this.handleFeedbackSubmission(socket, data);
      });

      // 断开连接
      socket.on('disconnect', (reason) => {
        logger.socket('disconnect', socket.id, { reason });
        logger.info(`❌ WebSocket连接断开: ${socket.id}, 原因: ${reason}`);

        // 记录WebSocket断开连接
        performanceMonitor.recordWebSocketDisconnection();
      });
    });
  }

  /**
   * 处理反馈提交
   */
  private async handleFeedbackSubmission(socket: any, feedbackData: FeedbackData): Promise<void> {
    const session = this.sessionStorage.getSession(feedbackData.sessionId);

    if (!session) {
      socket.emit('feedback_error', {
        error: '会话不存在或已过期'
      });
      return;
    }

    try {
      // 验证反馈数据
      // 需要添加：记录收到的反馈内容
      logger.info(`收到用户反馈 - 会话: ${feedbackData.sessionId}`);
      logger.info(`反馈文字内容: ${feedbackData.text?.slice(0, 100) || '无文字内容'}`);
      if (!feedbackData.text && (!feedbackData.images || feedbackData.images.length === 0)) {
        socket.emit('feedback_error', {
          error: '请提供文字反馈或上传图片'
        });
        return;
      }

      // 验证图片数据（前端已完成压缩）
      let processedFeedback = { ...feedbackData };
      if (feedbackData.images && feedbackData.images.length > 0) {
        logger.info(`接收到 ${feedbackData.images.length} 张图片（前端已压缩）...`);

        try {
          // 只做基本验证，不再进行压缩处理
          for (const image of feedbackData.images) {
            // 验证必要字段
            if (!image.name || !image.data || !image.type) {
              throw new Error('图片数据不完整');
            }
            
            // 验证格式
            if (!this.imageProcessor.validateImageFormat(image.name, image.type)) {
              throw new Error(`不支持的图片格式: ${image.type}`);
            }
            
            // 验证大小（前端压缩后应该在合理范围内）
            if (!this.imageProcessor.validateImageSize(image.size)) {
              throw new Error(`图片大小超出限制: ${image.size}`);
            }
          }

          const stats = this.imageProcessor.getImageStats(feedbackData.images);
          logger.info(`图片验证完成: ${stats.totalCount} 张图片, 总大小: ${(stats.totalSize / 1024 / 1024).toFixed(2)}MB`);

        } catch (error) {
          logger.error('图片验证失败:', error);
          socket.emit('feedback_error', {
            error: `图片验证失败: ${error instanceof Error ? error.message : '未知错误'}`
          });
          return;
        }
      }

      // 添加反馈到会话
      session.feedback.push(processedFeedback);
      this.sessionStorage.updateSession(feedbackData.sessionId, { feedback: session.feedback });

      // 需要添加：记录处理后的反馈数据和会话状态
      logger.info(`添加反馈到会话 - 会话ID: ${feedbackData.sessionId}`);
      logger.info(`当前会话反馈总数: ${session.feedback.length}`);

      // 通知提交成功
      socket.emit('feedback_submitted', {
        success: true,
        message: '反馈提交成功'
      });

      // 完成反馈收集
      if (session.resolve) {
        // 需要添加：记录反馈收集完成的详细信息
        logger.info(`反馈收集完成 - 会话: ${feedbackData.sessionId}, 总反馈数: ${session.feedback.length}`);
        session.resolve(session.feedback);
        this.sessionStorage.deleteSession(feedbackData.sessionId);
      }

    } catch (error) {
      logger.error('处理反馈提交时出错:', error);
      socket.emit('feedback_error', {
        error: '服务器处理错误，请稍后重试'
      });
    }
  }

  /**
   * 收集用户反馈
   */
  async collectFeedback(workSummary: string, timeoutSeconds: number): Promise<FeedbackData[]> {
    const sessionId = this.generateSessionId();
    
    logger.info(`创建反馈会话: ${sessionId}, 超时: ${timeoutSeconds}秒`);
    
    return new Promise((resolve, reject) => {
      // 创建会话
      const session: SessionData = {
        workSummary,
        feedback: [],
        startTime: Date.now(),
        timeout: timeoutSeconds * 1000,
        resolve,
        reject
      };

      this.sessionStorage.createSession(sessionId, session);

      // 立即广播工作汇报到所有连接的客户端
      this.io.emit('work_summary_broadcast', {
        session_id: sessionId,
        work_summary: workSummary,
        timestamp: Date.now()
      });
      
      logger.info(`工作汇报已广播到所有客户端: ${sessionId}`);

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.sessionStorage.deleteSession(sessionId);
        reject(new MCPError(
          `Feedback collection timeout after ${timeoutSeconds} seconds`,
          'FEEDBACK_TIMEOUT'
        ));
      }, timeoutSeconds * 1000);

      // 打开浏览器
      this.openFeedbackPage(sessionId).catch(error => {
        logger.error('打开反馈页面失败:', error);
        clearTimeout(timeoutId);
        this.sessionStorage.deleteSession(sessionId);
        reject(error);
      });
    });
  }

  /**
   * 生成反馈页面URL
   */
  private generateFeedbackUrl(sessionId: string): string {
    // 如果启用了固定URL模式，返回根路径
    if (this.config.useFixedUrl) {
      // 优先使用配置的服务器基础URL
      if (this.config.serverBaseUrl) {
        return this.config.serverBaseUrl;
      }
      // 使用配置的主机名
      const host = this.config.serverHost || 'localhost';
      return `http://${host}:${this.port}`;
    }

    // 传统模式：包含会话ID参数
    if (this.config.serverBaseUrl) {
      return `${this.config.serverBaseUrl}/?mode=feedback&session=${sessionId}`;
    }
    const host = this.config.serverHost || 'localhost';
    return `http://${host}:${this.port}/?mode=feedback&session=${sessionId}`;
  }

  /**
   * 打开反馈页面
   */
  private async openFeedbackPage(sessionId: string): Promise<void> {
    const url = this.generateFeedbackUrl(sessionId);
    logger.info(`打开反馈页面: ${url}`);

    try {
      const open = await import('open');
      // 获取平台信息
      const platform = process.platform;
      logger.debug(`当前平台: ${platform}`);
      
      // 在Linux上使用更多选项
      if (platform === 'linux') {
        logger.debug('检测到Linux平台，使用额外选项');
        try {
          // 尝试使用额外的选项打开
          await open.default(url, {
            wait: false,
            app: {
              name: open.apps.browser,
              arguments: ['--new-window']
            }
          });
          logger.info('浏览器已打开反馈页面 (使用browser选项)');
        } catch (linuxError) {
          logger.warn('使用browser选项打开浏览器失败，尝试默认方式:', linuxError);
          // 回退到默认方式
          await open.default(url);
          logger.info('浏览器已打开反馈页面 (默认方式)');
        }
      } else {
        // 其他平台使用默认方式
        await open.default(url);
        logger.info('浏览器已打开反馈页面');
      }
    } catch (error) {
      logger.warn('无法自动打开浏览器:', error);
      logger.info(`请手动打开浏览器访问: ${url}`);
    }
  }

  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 启动Web服务器
   */
  async start(): Promise<void> {
    if (this.isServerRunning) {
      logger.warn('Web服务器已在运行中');
      return;
    }

    try {
      // 根据配置选择端口策略
      if (this.config.forcePort) {
        // 强制端口模式
        logger.info(`强制端口模式: 尝试使用端口 ${this.config.webPort}`);

        // 根据配置决定是否清理端口
        if (this.config.cleanupPortOnStart) {
          logger.info(`启动时端口清理已启用，清理端口 ${this.config.webPort}`);
          await this.portManager.cleanupPort(this.config.webPort);
        }

        this.port = await this.portManager.forcePort(
          this.config.webPort,
          this.config.killProcessOnPortConflict || false
        );
      } else {
        // 传统模式：查找可用端口
        // 如果启用了端口清理且指定了首选端口，先尝试清理
        if (this.config.cleanupPortOnStart && this.config.webPort) {
          logger.info(`启动时端口清理已启用，尝试清理首选端口 ${this.config.webPort}`);
          await this.portManager.cleanupPort(this.config.webPort);
        }

        this.port = await this.portManager.findAvailablePort(this.config.webPort);
      }

      // 启动服务器前再次确认端口可用
      logger.info(`准备在端口 ${this.port} 启动服务器...`);

      // 启动服务器
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server start timeout'));
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

      this.isServerRunning = true;

      // 根据配置显示不同的启动信息
      if (this.config.forcePort) {
        logger.info(`✅ Web服务器启动成功 (强制端口): http://localhost:${this.port}`);
      } else {
        logger.info(`✅ Web服务器启动成功: http://localhost:${this.port}`);
      }

      if (this.config.useFixedUrl) {
        logger.info(`🔗 固定URL模式已启用，访问地址: http://localhost:${this.port}`);
      }

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
   * 停止Web服务器
   */
  async stop(): Promise<void> {
    if (!this.isServerRunning) {
      return;
    }

    const currentPort = this.port;
    logger.info(`正在停止Web服务器 (端口: ${currentPort})...`);

    try {
      // 清理所有活跃会话
      this.sessionStorage.clear();
      this.sessionStorage.stopCleanupTimer();

      // 关闭所有WebSocket连接
      this.io.disconnectSockets(true);

      // 关闭Socket.IO
      this.io.close();

      // 关闭HTTP服务器
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Server close timeout'));
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
      logger.info(`✅ Web服务器已停止 (端口: ${currentPort})`);

      // 等待端口完全释放
      logger.info(`等待端口 ${currentPort} 完全释放...`);
      try {
        await this.portManager.waitForPortRelease(currentPort, 3000);
        logger.info(`✅ 端口 ${currentPort} 已完全释放`);
      } catch (error) {
        logger.warn(`端口 ${currentPort} 释放超时，但服务器已停止`);
      }

    } catch (error) {
      logger.error('停止Web服务器时出错:', error);
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


}
