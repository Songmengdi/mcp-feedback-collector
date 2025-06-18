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

import { Config, FeedbackData, MCPError, SceneRequest, SceneModeRequest } from '../types/index.js';
import { ImageProcessor } from '../utils/image-processor.js';
import { logger } from '../utils/logger.js';
import { performanceMonitor } from '../utils/performance-monitor.js';
import { PortManager } from '../utils/port-manager.js';
import { PromptManager } from '../utils/prompt-manager.js';
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
  private promptManager: PromptManager;
  private socketMcpMapping = new Map<string, string>(); // socketId -> mcpSessionId


  constructor(config: Config, preAllocatedPort?: number) {
    this.config = config;
    this.portManager = new PortManager();
    this.imageProcessor = new ImageProcessor({
      maxFileSize: config.maxFileSize,
      maxWidth: 2048,
      maxHeight: 2048
    });
    this.sessionStorage = new SessionStorage();
    this.promptManager = new PromptManager();
    
    // 如果提供了预分配端口，直接使用
    if (preAllocatedPort) {
      this.port = preAllocatedPort;
    }

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

    // 会话状态监控路由（调试用）
    this.app.get('/api/session-debug', (req, res) => {
      const sessionMappings = this.getSessionMappingStats();
      const socketConnections = Array.from(this.io.sockets.sockets.keys());
      
      res.json({
        timestamp: new Date().toISOString(),
        socketMcpMappings: sessionMappings.socketMcpMappings,
        sessionStorageStats: sessionMappings.sessionStorageStats,
        activeSocketConnections: socketConnections,
        totalSockets: socketConnections.length,
        totalMappings: sessionMappings.socketMcpMappings.length
      });
    });

    // 会话匹配状态监控路由
    this.app.get('/api/session-matching-debug', (req, res) => {
      const socketMappings = Array.from(this.socketMcpMapping.entries());
      const activeSessions = this.sessionStorage.getAllSessions();
      
      const matchingStatus = socketMappings.map(([socketId, mcpSessionId]) => {
        const matchingSession = this.findSessionByMcpId(mcpSessionId);
        return {
          socketId,
          mcpSessionId,
          hasMatchingSession: !!matchingSession,
          matchingSessionId: matchingSession?.sessionId || null,
          sessionStartTime: matchingSession?.session.startTime || null
        };
      });
      
      const sessionList = Array.from(activeSessions.entries()).map(([sessionId, session]) => ({
        sessionId,
        mcpSessionId: session.mcpSessionId || null,
        startTime: session.startTime,
        hasWorkSummary: !!session.workSummary,
        feedbackCount: session.feedback?.length || 0
      }));
      
      res.json({
        timestamp: new Date().toISOString(),
        socketMappings: matchingStatus,
        activeSessions: sessionList,
        totalSockets: socketMappings.length,
        totalSessions: sessionList.length,
        matchedSockets: matchingStatus.filter(s => s.hasMatchingSession).length,
        unmatchedSockets: matchingStatus.filter(s => !s.hasMatchingSession).length
      });
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

    // 提示词管理API端点
    
    // 传统API接口已移除，统一使用场景化API (/api/scenes, /api/unified)

    // ================== 场景管理API端点 ==================

    // 获取所有场景
    this.app.get('/api/scenes', (req, res) => {
      try {
        const scenes = this.promptManager.getAllScenes();
        const convertedScenes = scenes.map(scene => this.convertSceneToFrontendFormat(scene));
        
        res.json({
          success: true,
          data: {
            scenes: convertedScenes,
            total: convertedScenes.length,
            defaultSceneId: scenes.find(s => s.is_default)?.id || (scenes.length > 0 ? scenes[0]?.id : '') || ''
          }
        });
      } catch (error) {
        logger.error('获取场景列表失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get scenes',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 导出场景配置
    this.app.get('/api/scenes/export', (req, res) => {
      try {
        const config = this.promptManager.exportSceneConfig();
        
        // 转换数据格式以匹配前端期望的SceneConfigExport格式
        const exportData = {
          version: '2.0',
          exported_at: new Date().toISOString(),
          config: {
            version: '2.0',
            exportedAt: Date.now(),
            scenes: config.scenes.map(scene => ({
              id: scene.id,
              name: scene.name,
              description: scene.description,
              icon: scene.icon,
              isDefault: scene.is_default,
              sortOrder: scene.sort_order,
              createdAt: scene.created_at,
              updatedAt: scene.updated_at
            })),
            modes: config.sceneModes.map(mode => ({
              id: mode.id,
              sceneId: mode.scene_id,
              name: mode.name,
              description: mode.description,
              shortcut: mode.shortcut,
              isDefault: mode.is_default,
              sortOrder: mode.sort_order,
              defaultFeedback: mode.default_feedback,
              createdAt: mode.created_at,
              updatedAt: mode.updated_at
            })),
            prompts: config.scenePrompts.map(prompt => ({
              sceneId: prompt.scene_id,
              modeId: prompt.mode_id,
              prompt: prompt.prompt
            }))
          }
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="scene-config-export-${Date.now()}.json"`);
        res.json(exportData);
      } catch (error) {
        logger.error('导出场景配置失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to export scene config',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 导入场景配置
    this.app.post('/api/scenes/import', (req, res) => {
      try {
        const { config } = req.body;

        if (!config || typeof config !== 'object') {
          res.status(400).json({
            success: false,
            error: 'Invalid import data',
            message: '导入数据格式无效：缺少config对象'
          });
          return;
        }

        // 验证导入数据的基本结构
        const validationErrors: string[] = [];
        
        if (!Array.isArray(config.scenes)) {
          validationErrors.push('缺少scenes数组');
        }
        
        if (!Array.isArray(config.modes)) {
          validationErrors.push('缺少modes数组');  
        }
        
        if (!Array.isArray(config.prompts)) {
          validationErrors.push('缺少prompts数组');
        }

        if (validationErrors.length > 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid import data structure',
            message: `导入数据结构无效: ${validationErrors.join(', ')}`
          });
          return;
        }

        // 转换前端格式到后端格式，并添加数据验证
        const backendConfig = {
          scenes: config.scenes.map((scene: any) => {
            if (!scene.id || !scene.name) {
              throw new Error(`场景数据不完整: ${JSON.stringify(scene)}`);
            }
            return {
              id: scene.id,
              name: scene.name,
              description: scene.description || '',
              icon: scene.icon,
              is_default: false, // 设置为非默认,防止和现有冲突
              sort_order: Number(scene.sortOrder) || 0,
              created_at: Number(scene.createdAt) || Date.now(),
              updated_at: Number(scene.updatedAt) || Date.now()
            };
          }),
          sceneModes: config.modes.map((mode: any) => {
            if (!mode.id || !mode.name || !mode.sceneId) {
              throw new Error(`模式数据不完整: ${JSON.stringify(mode)}`);
            }
            return {
              id: mode.id,
              scene_id: mode.sceneId,
              name: mode.name,
              description: mode.description || '',
              shortcut: mode.shortcut,
              is_default: Boolean(mode.isDefault),
              sort_order: Number(mode.sortOrder) || 0,
              default_feedback: mode.defaultFeedback,
              created_at: Number(mode.createdAt) || Date.now(),
              updated_at: Number(mode.updatedAt) || Date.now()
            };
          }),
          scenePrompts: config.prompts.map((prompt: any) => {
            if (!prompt.sceneId || !prompt.modeId || typeof prompt.prompt !== 'string') {
              throw new Error(`提示词数据不完整: ${JSON.stringify(prompt)}`);
            }
            return {
              scene_id: prompt.sceneId,
              mode_id: prompt.modeId,
              prompt: prompt.prompt,
              created_at: Date.now(),
              updated_at: Date.now()
            };
          })
        };

        const result = this.promptManager.importSceneConfig(backendConfig);

        res.json({
          success: true,
          message: `场景配置导入完成: 成功 ${result.success} 个, 失败 ${result.failed} 个`,
          result: {
            success: result.success,
            failed: result.failed,
            errors: result.errors
          }
        });
      } catch (error) {
        logger.error('导入场景配置失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to import scene config',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 获取场景详情
    this.app.get('/api/scenes/:sceneId', (req, res) => {
      try {
        const { sceneId } = req.params;
        const scene = this.promptManager.getSceneById(sceneId);
        const modes = this.promptManager.getSceneModes(sceneId);
        
        if (!scene) {
          res.status(404).json({
            success: false,
            error: 'Scene not found',
            message: `未找到场景: ${sceneId}`
          });
          return;
        }

        res.json({
          success: true,
          data: {
            scene: this.convertSceneToFrontendFormat(scene),
            modes: modes.map(mode => this.convertSceneModeToFrontendFormat(mode))
          }
        });
      } catch (error) {
        logger.error(`获取场景详情失败 (sceneId: ${req.params.sceneId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to get scene details',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 创建新场景
    this.app.post('/api/scenes', (req, res) => {
      try {
        const { name, description, icon, isDefault, sortOrder } = req.body;

        if (!name || typeof name !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid scene name',
            message: '场景名称不能为空'
          });
          return;
        }

        if (!description || typeof description !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid scene description',
            message: '场景描述不能为空'
          });
          return;
        }

        // 直接构建SceneRequest对象，保持前端数据格式
        const sceneRequest: SceneRequest = {
          name,
          description,
          icon: icon || '📁',
          isDefault: isDefault || false,
          sortOrder: sortOrder || 999
        };

        logger.debug('创建场景请求数据:', sceneRequest);
        const scene = this.promptManager.createScene(sceneRequest);

        res.json({
          success: true,
          message: `场景已创建: ${name}`,
          data: {
            scene: this.convertSceneToFrontendFormat(scene)
          }
        });
      } catch (error) {
        logger.error('创建场景失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create scene',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 更新场景
    this.app.put('/api/scenes/:sceneId', (req, res) => {
      try {
        const { sceneId } = req.params;
        const { name, description, isDefault, icon, sortOrder } = req.body;

        // 构建场景更新请求对象
        const sceneRequest: Partial<SceneRequest> = {};
        
        // 验证必要字段并添加到请求对象
        if (name !== undefined) {
          if (!name || typeof name !== 'string') {
            res.status(400).json({
              success: false,
              error: 'Invalid scene name',
              message: '场景名称不能为空'
            });
            return;
          }
          sceneRequest.name = name;
        }
        
        if (description !== undefined) {
          if (!description || typeof description !== 'string') {
            res.status(400).json({
              success: false,
              error: 'Invalid scene description',
              message: '场景描述不能为空'
            });
            return;
          }
          sceneRequest.description = description;
        }
        
        // 添加可选字段
        if (isDefault !== undefined) sceneRequest.isDefault = isDefault;
        if (icon !== undefined) sceneRequest.icon = icon;
        if (sortOrder !== undefined) sceneRequest.sortOrder = sortOrder;

        const scene = this.promptManager.updateScene(sceneId, sceneRequest);

        if (!scene) {
          res.status(404).json({
            success: false,
            error: 'Scene not found',
            message: `未找到场景: ${sceneId}`
          });
          return;
        }

        res.json({
          success: true,
          message: `场景已更新: ${name}`,
          data: {
            scene: this.convertSceneToFrontendFormat(scene)
          }
        });
      } catch (error) {
        logger.error(`更新场景失败 (sceneId: ${req.params.sceneId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to update scene',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 删除场景
    this.app.delete('/api/scenes/:sceneId', (req, res) => {
      try {
        const { sceneId } = req.params;
        const deleted = this.promptManager.deleteScene(sceneId);

        if (!deleted) {
          res.status(404).json({
            success: false,
            error: 'Scene not found',
            message: `未找到场景: ${sceneId}`
          });
          return;
        }

        res.json({
          success: true,
          message: `场景已删除: ${sceneId}`,
          deleted: true
        });
      } catch (error) {
        logger.error(`删除场景失败 (sceneId: ${req.params.sceneId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete scene',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 获取场景的所有模式
    this.app.get('/api/scenes/:sceneId/modes', (req, res) => {
      try {
        const { sceneId } = req.params;
        const modes = this.promptManager.getSceneModes(sceneId);

        res.json({
          success: true,
          data: {
            modes: modes.map(mode => this.convertSceneModeToFrontendFormat(mode)),
            total: modes.length
          }
        });
      } catch (error) {
        logger.error(`获取场景模式失败 (sceneId: ${req.params.sceneId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to get scene modes',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 为场景添加模式
    this.app.post('/api/scenes/:sceneId/modes', (req, res) => {
      try {
        const { sceneId } = req.params;
        const { name, description, shortcut, isDefault, sortOrder, defaultFeedback } = req.body;

        if (!name || typeof name !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid mode name',
            message: '模式名称不能为空'
          });
          return;
        }

        if (!description || typeof description !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid mode description',
            message: '模式描述不能为空'
          });
          return;
        }

        // 构建完整的模式请求对象
        const modeRequest: SceneModeRequest = {
          name,
          description,
          shortcut: shortcut || '',
          isDefault: isDefault || false,
          sortOrder: sortOrder || 999,
          defaultFeedback: defaultFeedback || ''
        };

        logger.debug('创建场景模式请求数据:', { sceneId, modeRequest });
        const mode = this.promptManager.addSceneMode(sceneId, modeRequest);

        res.json({
          success: true,
          message: `场景模式已添加: ${name}`,
          data: {
            mode: this.convertSceneModeToFrontendFormat(mode)
          }
        });
      } catch (error) {
        logger.error(`添加场景模式失败 (sceneId: ${req.params.sceneId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to add scene mode',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 更新场景模式
    this.app.put('/api/scenes/:sceneId/modes/:modeId', (req, res) => {
      try {
        const { sceneId, modeId } = req.params;
        const { name, description, shortcut, isDefault, sortOrder, defaultFeedback } = req.body;

        if (!name || typeof name !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid mode name',
            message: '模式名称不能为空'
          });
          return;
        }

        if (!description || typeof description !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid mode description',
            message: '模式描述不能为空'
          });
          return;
        }

        // 构建完整的模式更新请求对象
        const modeRequest: Partial<SceneModeRequest> = {
          name,
          description,
          ...(shortcut !== undefined && { shortcut }),
          ...(isDefault !== undefined && { isDefault }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(defaultFeedback !== undefined && { defaultFeedback })
        };

        logger.debug('更新场景模式请求数据:', { sceneId, modeId, modeRequest });
        const mode = this.promptManager.updateSceneMode(sceneId, modeId, modeRequest);

        if (!mode) {
          res.status(404).json({
            success: false,
            error: 'Scene mode not found',
            message: `未找到场景模式: ${sceneId}:${modeId}`
          });
          return;
        }

        res.json({
          success: true,
          message: `场景模式已更新: ${name}`,
          data: {
            mode: this.convertSceneModeToFrontendFormat(mode)
          }
        });
      } catch (error) {
        logger.error(`更新场景模式失败 (sceneId: ${req.params.sceneId}, modeId: ${req.params.modeId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to update scene mode',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 删除场景模式
    this.app.delete('/api/scenes/:sceneId/modes/:modeId', (req, res) => {
      try {
        const { sceneId, modeId } = req.params;
        const deleted = this.promptManager.deleteSceneMode(sceneId, modeId);

        if (!deleted) {
          res.status(404).json({
            success: false,
            error: 'Scene mode not found',
            message: `未找到场景模式: ${sceneId}:${modeId}`
          });
          return;
        }

        res.json({
          success: true,
          message: `场景模式已删除: ${sceneId}:${modeId}`,
          deleted: true
        });
      } catch (error) {
        logger.error(`删除场景模式失败 (sceneId: ${req.params.sceneId}, modeId: ${req.params.modeId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete scene mode',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 获取场景提示词
    this.app.get('/api/scenes/:sceneId/modes/:modeId/prompt', (req, res) => {
      try {
        const { sceneId, modeId } = req.params;
        const { type = 'current' } = req.query;

        const result: any = {
          success: true,
          sceneId,
          modeId
        };

        if (type === 'current') {
          const currentPrompt = this.promptManager.getScenePrompt(sceneId, modeId);
          if (currentPrompt) {
            result.currentPrompt = {
              content: currentPrompt
            };
          }
        }

        // 可以扩展支持获取自定义和默认提示词
        res.json(result);
      } catch (error) {
        logger.error(`获取场景提示词失败 (scene: ${req.params.sceneId}, mode: ${req.params.modeId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to get scene prompt',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 保存场景提示词
    this.app.post('/api/scenes/:sceneId/modes/:modeId/prompt', (req, res) => {
      try {
        const { sceneId, modeId } = req.params;
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Invalid prompt content',
            message: '提示词内容不能为空'
          });
          return;
        }

        this.promptManager.saveScenePrompt(sceneId, modeId, prompt);

        res.json({
          success: true,
          message: `场景提示词已保存 (scene: ${sceneId}, mode: ${modeId})`,
          sceneId,
          modeId
        });
      } catch (error) {
        logger.error(`保存场景提示词失败 (scene: ${req.params.sceneId}, mode: ${req.params.modeId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to save scene prompt',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 删除场景提示词
    this.app.delete('/api/scenes/:sceneId/modes/:modeId/prompt', (req, res) => {
      try {
        const { sceneId, modeId } = req.params;
        const deleted = this.promptManager.deleteScenePrompt(sceneId, modeId);

        res.json({
          success: true,
          message: deleted 
            ? `场景提示词已删除 (scene: ${sceneId}, mode: ${modeId})`
            : `未找到要删除的场景提示词 (scene: ${sceneId}, mode: ${modeId})`,
          deleted
        });
      } catch (error) {
        logger.error(`删除场景提示词失败 (scene: ${req.params.sceneId}, mode: ${req.params.modeId}):`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to delete scene prompt',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 导出场景配置
    this.app.get('/api/scenes/export', (req, res) => {
      try {
        const config = this.promptManager.exportSceneConfig();
        
        // 转换数据格式以匹配前端期望的SceneConfigExport格式
        const exportData = {
          version: '2.0',
          exported_at: new Date().toISOString(),
          config: {
            version: '2.0',
            exportedAt: Date.now(),
            scenes: config.scenes.map(scene => ({
              id: scene.id,
              name: scene.name,
              description: scene.description,
              icon: scene.icon,
              isDefault: scene.is_default,
              sortOrder: scene.sort_order,
              createdAt: scene.created_at,
              updatedAt: scene.updated_at
            })),
            modes: config.sceneModes.map(mode => ({
              id: mode.id,
              sceneId: mode.scene_id,
              name: mode.name,
              description: mode.description,
              shortcut: mode.shortcut,
              isDefault: mode.is_default,
              sortOrder: mode.sort_order,
              defaultFeedback: mode.default_feedback,
              createdAt: mode.created_at,
              updatedAt: mode.updated_at
            })),
            prompts: config.scenePrompts.map(prompt => ({
              sceneId: prompt.scene_id,
              modeId: prompt.mode_id,
              prompt: prompt.prompt
            }))
          }
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="scene-config-export-${Date.now()}.json"`);
        res.json(exportData);
      } catch (error) {
        logger.error('导出场景配置失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to export scene config',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 导入场景配置
    this.app.post('/api/scenes/import', (req, res) => {
      try {
        const { config } = req.body;

        if (!config || typeof config !== 'object') {
          res.status(400).json({
            success: false,
            error: 'Invalid import data',
            message: '导入数据格式无效：缺少config对象'
          });
          return;
        }

        // 验证导入数据的基本结构
        const validationErrors: string[] = [];
        
        if (!Array.isArray(config.scenes)) {
          validationErrors.push('缺少scenes数组');
        }
        
        if (!Array.isArray(config.modes)) {
          validationErrors.push('缺少modes数组');  
        }
        
        if (!Array.isArray(config.prompts)) {
          validationErrors.push('缺少prompts数组');
        }

        if (validationErrors.length > 0) {
          res.status(400).json({
            success: false,
            error: 'Invalid import data structure',
            message: `导入数据结构无效: ${validationErrors.join(', ')}`
          });
          return;
        }

        // 转换前端格式到后端格式
        const backendConfig = {
          scenes: config.scenes.map((scene: any) => ({
            id: scene.id,
            name: scene.name,
            description: scene.description,
            icon: scene.icon,
            is_default: scene.isDefault || false,
            sort_order: scene.sortOrder || 0,
            created_at: scene.createdAt || Date.now(),
            updated_at: scene.updatedAt || Date.now()
          })),
          sceneModes: config.modes.map((mode: any) => ({
            id: mode.id,
            scene_id: mode.sceneId,
            name: mode.name,
            description: mode.description,
            shortcut: mode.shortcut,
            is_default: mode.isDefault || false,
            sort_order: mode.sortOrder || 0,
            default_feedback: mode.defaultFeedback,
            created_at: mode.createdAt || Date.now(),
            updated_at: mode.updatedAt || Date.now()
          })),
          scenePrompts: config.prompts.map((prompt: any) => ({
            scene_id: prompt.sceneId,
            mode_id: prompt.modeId,
            prompt: prompt.prompt,
            created_at: Date.now(),
            updated_at: Date.now()
          }))
        };

        const result = this.promptManager.importSceneConfig(backendConfig);

        res.json({
          success: true,
          message: `场景配置导入完成: 成功 ${result.success} 个, 失败 ${result.failed} 个`,
          result: {
            success: result.success,
            failed: result.failed,
            errors: result.errors
          }
        });
      } catch (error) {
        logger.error('导入场景配置失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to import scene config',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // ================== 兼容性API端点 ==================
    
    // 统一的提示词获取API（支持场景化和传统模式）
    this.app.get('/api/unified/prompt', (req, res) => {
      try {
        const { scene, mode } = req.query;

        if (!mode || typeof mode !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Mode parameter is required',
            message: '缺少mode参数'
          });
          return;
        }

        let prompt: string | null = null;
        let promptType: 'legacy' | 'scene' = 'legacy';

        if (scene && typeof scene === 'string') {
          // 场景化提示词
          prompt = this.promptManager.getScenePrompt(scene, mode);
          promptType = 'scene';
        } else {
          // 不支持传统模式，返回错误
          res.status(400).json({
            success: false,
            error: 'Legacy mode not supported',
            message: '传统模式已不支持，请使用场景化模式'
          });
          return;
        }

        // 如果没有找到提示词，返回空字符串而不是错误
        // 这样前端可以显示空编辑器让用户开始编辑
        const promptContent = prompt || '';
        
        if (!prompt) {
          logger.info(`场景提示词为空，返回空内容供编辑 (scene: ${scene}, mode: ${mode})`);
        }

        res.json({
          success: true,
          data: {
            prompt: promptContent
          }
        });
      } catch (error) {
        logger.error('获取统一提示词失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to get unified prompt',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // 保存提示词API（支持场景化模式）
    this.app.post('/api/unified/prompt/apply', (req, res) => {
      try {
        const { scene, mode, prompt } = req.body;

        if (!mode || typeof mode !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Mode parameter is required',
            message: '缺少mode参数'
          });
          return;
        }

        if (!scene || typeof scene !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Scene parameter is required',
            message: '缺少scene参数'
          });
          return;
        }

        if (!prompt || typeof prompt !== 'string') {
          res.status(400).json({
            success: false,
            error: 'Prompt parameter is required',
            message: '缺少prompt参数'
          });
          return;
        }

        // 保存场景化提示词
        this.promptManager.saveScenePrompt(scene, mode, prompt);

        res.json({
          success: true,
          message: `场景提示词已保存 (scene: ${scene}, mode: ${mode})`
        });
      } catch (error) {
        logger.error('保存统一提示词失败:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to apply unified prompt',
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

      // 建立Web Socket与MCP会话的关联
      const mcpSessionId = socket.handshake.query['mcpSessionId'] as string;
      logger.debug(`Socket ${socket.id} 握手查询参数:`, socket.handshake.query);
      logger.debug(`Socket ${socket.id} 握手头部:`, socket.handshake.headers);
      logger.debug(`Socket ${socket.id} 握手URL: ${socket.handshake.url}`);
      
      if (mcpSessionId) {
        this.socketMcpMapping.set(socket.id, mcpSessionId);
        logger.info(`✅ Web Socket ${socket.id} 关联到MCP会话: ${mcpSessionId}`);
        
        // 验证关联的MCP会话是否有对应的反馈会话
        const matchingSession = this.findSessionByMcpId(mcpSessionId);
        if (matchingSession) {
          logger.info(`✅ 找到匹配的反馈会话: ${matchingSession.sessionId}`);
        } else {
          logger.warn(`⚠️  未找到MCP会话 ${mcpSessionId} 对应的反馈会话，可能存在时序问题`);
        }
      } else {
        logger.warn(`⚠️  Web Socket ${socket.id} 未提供mcpSessionId参数`);
        logger.warn(`URL参数: ${socket.handshake.url}`);
        logger.warn(`查询参数: ${JSON.stringify(socket.handshake.query)}`);
      }

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

        // 获取当前Socket关联的MCP会话ID
        const socketMcpSessionId = this.socketMcpMapping.get(socket.id);
        
        logger.info(`会话分配请求 - Socket: ${socket.id}, 关联MCP会话: ${socketMcpSessionId || 'none'}`);
        
        // 获取所有活跃会话用于调试
        const allSessions = this.sessionStorage.getAllSessions();
        logger.debug(`当前活跃反馈会话数量: ${allSessions.size}`);
        
        for (const [sessionId, session] of allSessions) {
          logger.debug(`活跃会话: ${sessionId}, MCP会话: ${session.mcpSessionId || 'none'}, 创建时间: ${new Date(session.startTime).toISOString()}`);
        }
        
        if (socketMcpSessionId) {
          // 查找匹配MCP会话ID的反馈会话
          const matchingSession = this.findSessionByMcpId(socketMcpSessionId);
          if (matchingSession) {
            // 分配匹配的会话
            logger.info(`✅ 会话分配成功 - Socket ${socket.id} (MCP会话: ${socketMcpSessionId}) 分配到匹配的反馈会话: ${matchingSession.sessionId}`);
            socket.emit('session_assigned', {
              session_id: matchingSession.sessionId,
              work_summary: matchingSession.session.workSummary
            });
            return;
          } else {
            // 未找到匹配会话，记录详细信息
            logger.warn(`❌ 未找到匹配会话 - Socket ${socket.id} (MCP会话: ${socketMcpSessionId})`);
            logger.warn(`可能原因: 1) 会话已超时被清理 2) 会话创建失败 3) MCP会话ID不匹配`);
            
            // 检查是否有相似的会话（用于调试）
            for (const [sessionId, session] of allSessions) {
              if (session.mcpSessionId) {
                const similarity = this.calculateSessionIdSimilarity(socketMcpSessionId, session.mcpSessionId);
                if (similarity > 0.8) {
                  logger.warn(`发现相似会话: ${sessionId} (MCP会话: ${session.mcpSessionId}), 相似度: ${similarity.toFixed(2)}`);
                }
              }
            }
          }
        } else {
          logger.warn(`❌ Socket ${socket.id} 未关联MCP会话ID`);
        }
        
        // 备选方案：查找最新会话
        const latestSession = this.findLatestSession();
        if (latestSession) {
          // 分配最新会话并记录警告
          logger.warn(`⚠️  使用备选方案 - Socket ${socket.id} (MCP会话: ${socketMcpSessionId || 'unknown'}) 分配到最新会话: ${latestSession.sessionId} (MCP会话: ${latestSession.session.mcpSessionId || 'none'})`);
          logger.warn(`这可能导致反馈路由错误，建议检查会话创建和浏览器打开的时序`);
          
          socket.emit('session_assigned', {
            session_id: latestSession.sessionId,
            work_summary: latestSession.session.workSummary
          });
        } else {
          // 无活跃会话
          logger.error(`❌ 无活跃会话可分配 - Socket ${socket.id}`);
          socket.emit('no_active_session', {
            message: '当前无活跃的反馈会话，请重新调用collect_feedback工具'
          });
        }
      });

      // 处理最新工作汇报请求
      socket.on('request_latest_summary', () => {
        logger.socket('request_latest_summary', socket.id);

        // 获取当前Socket关联的MCP会话ID
        const socketMcpSessionId = this.socketMcpMapping.get(socket.id);
        
        if (socketMcpSessionId) {
          // 优先返回匹配MCP会话的工作汇报
          const matchingSession = this.findSessionByMcpId(socketMcpSessionId);
          if (matchingSession && matchingSession.session.workSummary) {
            logger.info(`为Socket ${socket.id} (MCP会话: ${socketMcpSessionId}) 返回匹配的工作汇报`);
            socket.emit('latest_summary_response', {
              success: true,
              work_summary: matchingSession.session.workSummary,
              session_id: matchingSession.sessionId,
              timestamp: matchingSession.session.startTime
            });
            return;
          }
        }

        // 备选：返回最新的工作汇报
        const latestSession = this.findLatestSession();
        if (latestSession && latestSession.session.workSummary) {
          // 找到最新的工作汇报
          logger.warn(`Socket ${socket.id} (MCP会话: ${socketMcpSessionId || 'unknown'}) 未找到匹配会话，返回最新工作汇报`);
          socket.emit('latest_summary_response', {
            success: true,
            work_summary: latestSession.session.workSummary,
            session_id: latestSession.sessionId,
            timestamp: latestSession.session.startTime
          });
        } else {
          // 没有找到工作汇报
          logger.info(`Socket ${socket.id} 请求最新工作汇报，但未找到`);
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

        // 清理Web Socket与MCP会话的关联
        const mcpSessionId = this.socketMcpMapping.get(socket.id);
        if (mcpSessionId) {
          this.socketMcpMapping.delete(socket.id);
          logger.info(`清理Web Socket ${socket.id} 与MCP会话 ${mcpSessionId} 的关联`);
        }

        // 记录WebSocket断开连接
        performanceMonitor.recordWebSocketDisconnection();
      });
    });
  }

  /**
   * 计算两个会话ID的相似度（用于调试）
   */
  private calculateSessionIdSimilarity(id1: string, id2: string): number {
    if (id1 === id2) return 1.0;
    
    const len1 = id1.length;
    const len2 = id2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1.0;
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (id1[i] === id2[i]) {
        matches++;
      }
    }
    
    return matches / maxLen;
  }

  /**
   * 根据MCP会话ID查找对应的反馈会话
   */
  private findSessionByMcpId(mcpSessionId: string): { sessionId: string; session: any } | null {
    const activeSessions = this.sessionStorage.getAllSessions();
    
    for (const [sessionId, session] of activeSessions) {
      if (session.mcpSessionId === mcpSessionId) {
        return { sessionId, session };
      }
    }
    
    return null;
  }

  /**
   * 查找最新的活跃会话
   */
  private findLatestSession(): { sessionId: string; session: any } | null {
    const activeSessions = this.sessionStorage.getAllSessions();
    let latestSession: { sessionId: string; session: any } | null = null;

    for (const [sessionId, session] of activeSessions) {
      if (!latestSession || session.startTime > latestSession.session.startTime) {
        latestSession = { sessionId, session };
      }
    }

    return latestSession;
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

    // 验证反馈来源（确保来自正确的MCP会话关联的Web客户端）
    if (session.mcpSessionId) {
      const socketMcpSessionId = this.socketMcpMapping.get(socket.id);
      logger.debug(`反馈来源验证 - Socket: ${socket.id}, Socket关联的MCP会话: ${socketMcpSessionId}, 反馈会话的MCP会话: ${session.mcpSessionId}`);
      
      if (socketMcpSessionId !== session.mcpSessionId) {
        logger.warn(`❌ 反馈来源验证失败: Socket ${socket.id} (MCP会话: ${socketMcpSessionId}) 尝试提交到会话 ${feedbackData.sessionId} (MCP会话: ${session.mcpSessionId})`);
        
        // 提供详细的诊断信息
        logger.warn(`诊断信息:`);
        logger.warn(`  - Socket ID: ${socket.id}`);
        logger.warn(`  - Socket关联的MCP会话: ${socketMcpSessionId || 'none'}`);
        logger.warn(`  - 反馈会话ID: ${feedbackData.sessionId}`);
        logger.warn(`  - 反馈会话关联的MCP会话: ${session.mcpSessionId}`);
        logger.warn(`  - 会话创建时间: ${new Date(session.startTime).toISOString()}`);
        
        // 检查是否存在正确的会话
        const correctSession = this.findSessionByMcpId(socketMcpSessionId || '');
        if (correctSession) {
          logger.warn(`  - 发现正确的会话: ${correctSession.sessionId} (MCP会话: ${correctSession.session.mcpSessionId})`);
          logger.warn(`  - 建议: 用户可能需要刷新页面或重新打开正确的反馈链接`);
        } else {
          logger.warn(`  - 未找到Socket对应的正确会话，可能已超时或被清理`);
        }
        
        socket.emit('feedback_error', {
          error: '反馈来源验证失败，请刷新页面重试'
        });
        return;
      }
      logger.info(`✅ 反馈来源验证通过: MCP会话 ${session.mcpSessionId}`);
    } else {
      logger.debug(`反馈会话 ${feedbackData.sessionId} 没有关联MCP会话，跳过来源验证`);
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
   * 定向广播到特定MCP会话的Web客户端
   */
  private broadcastToMcpSession(mcpSessionId: string, data: any): void {
    let broadcastCount = 0;
    
    for (const [socketId, sessionId] of this.socketMcpMapping) {
      if (sessionId === mcpSessionId) {
        this.io.to(socketId).emit('work_summary_broadcast', data);
        broadcastCount++;
      }
    }
    
    logger.debug(`定向广播到MCP会话 ${mcpSessionId} 的 ${broadcastCount} 个Web客户端`);
    
    // 如果没有找到关联的Web客户端，记录警告
    if (broadcastCount === 0) {
      logger.warn(`未找到MCP会话 ${mcpSessionId} 关联的Web客户端，可能需要手动打开浏览器`);
    }
  }

  /**
   * 清理MCP会话关联的反馈会话
   */
  cleanupMcpSession(mcpSessionId: string): void {
    logger.info(`清理MCP会话关联的反馈会话: ${mcpSessionId}`);
    
    // 删除关联的反馈会话
    const deleted = this.sessionStorage.deleteSessionByMcpId(mcpSessionId);
    if (deleted) {
      logger.info(`已清理MCP会话 ${mcpSessionId} 关联的反馈会话`);
    } else {
      logger.debug(`MCP会话 ${mcpSessionId} 没有关联的反馈会话需要清理`);
    }
    
    // 清理Web Socket映射（通过遍历查找）
    const socketsToRemove: string[] = [];
    for (const [socketId, sessionId] of this.socketMcpMapping) {
      if (sessionId === mcpSessionId) {
        socketsToRemove.push(socketId);
      }
    }
    
    for (const socketId of socketsToRemove) {
      this.socketMcpMapping.delete(socketId);
      logger.debug(`清理Web Socket ${socketId} 与MCP会话 ${mcpSessionId} 的关联`);
    }
  }

  /**
   * 收集用户反馈
   */
  async collectFeedback(workSummary: string, timeoutSeconds: number, mcpSessionId?: string): Promise<FeedbackData[]> {
    const sessionId = this.generateSessionId();
    
    logger.info(`创建反馈会话: ${sessionId}, 超时: ${timeoutSeconds}秒, MCP会话: ${mcpSessionId || 'unknown'}`);
    
    // 严格的会话ID验证
    if (!mcpSessionId) {
      logger.warn(`警告: 反馈会话 ${sessionId} 没有关联的MCP会话ID，可能导致反馈路由问题`);
      // 可以选择拒绝服务或继续使用兼容模式
      // throw new MCPError('Missing MCP session ID for feedback collection', 'MISSING_MCP_SESSION_ID');
    }
    
    return new Promise((resolve, reject) => {
      // 创建会话
      const session: SessionData = {
        workSummary,
        feedback: [],
        startTime: Date.now(),
        timeout: timeoutSeconds * 1000,
        mcpSessionId,  // 设置MCP会话ID关联
        resolve,
        reject
      };

      this.sessionStorage.createSession(sessionId, session);
      
      // 验证会话创建成功
      const createdSession = this.sessionStorage.getSession(sessionId);
      if (!createdSession) {
        logger.error(`❌ 会话创建失败: ${sessionId}`);
        reject(new MCPError('Failed to create feedback session', 'SESSION_CREATION_FAILED'));
        return;
      }
      
      logger.info(`✅ 反馈会话创建成功: ${sessionId}, MCP会话: ${mcpSessionId || 'none'}`);

      // 根据是否有MCP会话ID决定广播方式
      if (mcpSessionId) {
        // 定向广播到特定MCP会话的Web客户端
        this.broadcastToMcpSession(mcpSessionId, {
          session_id: sessionId,
          work_summary: workSummary,
          timestamp: Date.now()
        });
        logger.info(`工作汇报已定向广播到MCP会话 ${mcpSessionId} 的客户端: ${sessionId}`);
      } else {
        // 兼容模式：广播到所有客户端（记录警告）
        logger.warn(`使用兼容模式广播到所有客户端: ${sessionId}`);
        this.io.emit('work_summary_broadcast', {
          session_id: sessionId,
          work_summary: workSummary,
          timestamp: Date.now()
        });
        logger.info(`工作汇报已广播到所有客户端: ${sessionId}`);
      }

      // 设置超时
      const timeoutId = setTimeout(() => {
        logger.warn(`⏰ 反馈会话超时: ${sessionId} (${timeoutSeconds}秒)`);
        this.sessionStorage.deleteSession(sessionId);
        reject(new MCPError(
          `Feedback collection timeout after ${timeoutSeconds} seconds`,
          'FEEDBACK_TIMEOUT'
        ));
      }, timeoutSeconds * 1000);

      // 延迟打开浏览器，确保会话完全创建
      setTimeout(() => {
        this.openFeedbackPage(sessionId, mcpSessionId).catch(error => {
          logger.error('打开反馈页面失败:', error);
          clearTimeout(timeoutId);
          this.sessionStorage.deleteSession(sessionId);
          reject(error);
        });
      }, 100); // 100ms延迟确保会话完全创建
    });
  }

  /**
   * 生成反馈页面URL
   */
  private generateFeedbackUrl(sessionId: string, mcpSessionId?: string): string {
    // 优先使用配置的服务器基础URL
    if (this.config.serverBaseUrl) {
      const baseUrl = `${this.config.serverBaseUrl}/?mode=feedback&session=${sessionId}`;
      return mcpSessionId ? `${baseUrl}&mcpSessionId=${mcpSessionId}` : baseUrl;
    }
    
    // 使用本地地址
    const host = this.config.serverHost || 'localhost';
    const baseUrl = `http://${host}:${this.port}/?mode=feedback&session=${sessionId}`;
    return mcpSessionId ? `${baseUrl}&mcpSessionId=${mcpSessionId}` : baseUrl;
  }

  /**
   * 打开反馈页面
   */
  private async openFeedbackPage(sessionId: string, mcpSessionId?: string): Promise<void> {
    const url = this.generateFeedbackUrl(sessionId, mcpSessionId);
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
   * 转换后端Scene对象为前端期望的格式
   */
  private convertSceneToFrontendFormat(scene: any): any {
    return {
      id: scene.id,
      name: scene.name,
      description: scene.description,
      icon: scene.icon,
      isDefault: Boolean(scene.is_default),      // 下划线转驼峰，显式转换为布尔值
      sortOrder: scene.sort_order,      // 下划线转驼峰
      createdAt: scene.created_at,      // 下划线转驼峰
      updatedAt: scene.updated_at       // 下划线转驼峰
    };
  }

  /**
   * 转换后端SceneMode对象为前端期望的格式
   */
  private convertSceneModeToFrontendFormat(mode: any): any {
    return {
      id: mode.id,
      sceneId: mode.scene_id,           // 下划线转驼峰
      name: mode.name,
      description: mode.description,
      shortcut: mode.shortcut,
      isDefault: Boolean(mode.is_default),       // 下划线转驼峰，显式转换为布尔值
      sortOrder: mode.sort_order,       // 下划线转驼峰
      defaultFeedback: mode.default_feedback,   // 下划线转驼峰
      createdAt: mode.created_at,       // 下划线转驼峰
      updatedAt: mode.updated_at        // 下划线转驼峰
    };
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
      // 如果没有预分配端口，则查找可用端口
      if (this.port === 0) {
        logger.debug('查找可用端口...');
        this.port = await this.portManager.findAvailablePort();
      } else {
        logger.debug(`使用预分配端口: ${this.port}`);
      }

      // 启动服务器前再次确认端口可用
      logger.debug(`准备在端口 ${this.port} 启动服务器...`);

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
      logger.info(`✅ Web服务器启动成功: http://localhost:${this.port}`);

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
    logger.debug(`正在停止Web服务器 (端口: ${currentPort})...`);

    try {
      // 清理所有活跃会话
      this.sessionStorage.clear();
      this.sessionStorage.stopCleanupTimer();

      // 关闭提示词管理器
      this.promptManager.close();

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

      // 释放端口分配（如果不是预分配的端口）
      try {
        await this.portManager.releasePort(currentPort);
        logger.info(`✅ Web服务器已停止，端口 ${currentPort} 已释放`);
      } catch (portError) {
        logger.warn(`释放端口 ${currentPort} 失败:`, portError);
        logger.info(`✅ Web服务器已停止 (端口: ${currentPort})`);
      }

      // 简单等待端口释放
      await new Promise(resolve => setTimeout(resolve, 1000));

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

  /**
   * 获取会话映射统计信息（用于调试）
   */
  getSessionMappingStats(): {
    socketMcpMappings: Array<{ socketId: string; mcpSessionId: string }>;
    sessionStorageStats: any;
  } {
    const socketMcpMappings: Array<{ socketId: string; mcpSessionId: string }> = [];
    
    for (const [socketId, mcpSessionId] of this.socketMcpMapping) {
      socketMcpMappings.push({ socketId, mcpSessionId });
    }
    
    return {
      socketMcpMappings,
      sessionStorageStats: this.sessionStorage.getMcpSessionMappingStats()
    };
  }


}
