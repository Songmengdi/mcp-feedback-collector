#!/usr/bin/env node

/**
 * MCP Feedback Collector - CLI入口
 */

import { program } from 'commander';
import fetch from 'node-fetch';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { displayConfig, getConfig } from './config/index.js';
import { MCPServer } from './server/mcp-server.js';
import { WebServer } from './server/web-server.js';
import { StdioServerLauncher } from './server/stdio-server-launcher.js';
import { MCPError, TransportMode } from './types/index.js';
import { ClientIdentifier } from './utils/client-identifier.js';
import { logger } from './utils/logger.js';
import { detectMCPModeStatus } from './utils/mode-detector.js';

// 动态读取版本信息
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageJsonPath = join(__dirname, '../package.json');
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const VERSION = packageJson.version;


/**
 * 启动MCP服务器
 */
async function startMCPServer(options: {
  port?: number;
  web?: boolean;
  config?: string;
  debug?: boolean;
  mode?: string;
  persistent?: boolean;
}): Promise<void> {
  try {
    // 使用新的模式检测逻辑
    const modeStatus = detectMCPModeStatus(options.mode);
    
    // 根据检测结果设置日志
    if (modeStatus.shouldDisableColors) {
      logger.disableColors();
    }
    
    // 在MCP模式下禁用emoji图标
    if (modeStatus.isStdio) {
      logger.disableEmojis();
      logger.disableColors();
    }
    
    // 加载配置并覆盖传输模式
    const config = getConfig();
    config.transportMode = modeStatus.transportMode;
    
    // 设置日志级别
    if (modeStatus.logLevel === 'info') {
      logger.setLevel('info' as any);
    } else if (modeStatus.logLevel === 'silent') {
      logger.setLevel('silent' as any);
    } else {
      // 使用配置文件中的默认级别
      logger.setLevel(config.logLevel as any);
    }

    if (!modeStatus.isMCP) {
      logger.debug(`启动模式: 交互模式 (传输模式: ${modeStatus.transportMode}, TTY: ${process.stdin.isTTY})`);
    } else {
      logger.debug(`启动模式: MCP模式 (传输模式: ${modeStatus.transportMode}, TTY: ${process.stdin.isTTY})`);
    }

    // 注意：端口配置已简化，不再支持命令行指定端口

    // 设置调试模式（仅在非MCP模式下）
    if (!modeStatus.isMCP && (options.debug || process.env['LOG_LEVEL'] === 'debug')) {
      config.logLevel = 'debug';

      // 启用文件日志记录
      logger.enableFileLogging();
      logger.setLevel('debug');
      logger.debug('调试模式已启用，日志将保存到文件');
    }
    
    // 显示配置信息
    if (logger.getLevel() === 'debug') {
      displayConfig(config);
      console.log('');
    }
    
    // 声明server变量
    let server: MCPServer;
    let launcher: StdioServerLauncher | undefined;

    // 根据传输模式选择启动方式
    if (modeStatus.isStdio && !options.web) {
      // stdio模式：使用专用启动器
      logger.info('检测到stdio模式，使用专用启动器...');
      
      const clientIdentifier = ClientIdentifier.getInstance();
      const clientEnv = clientIdentifier.getClientEnvironment();
      
      logger.debug('客户端环境信息:', clientEnv);
      
      launcher = new StdioServerLauncher(config);
      
      // 验证stdio环境
      launcher.validateStdioEnvironment();
      
      // 启动stdio客户端服务器
      server = await launcher.launchForClient();
      
      // 显示启动统计信息
      const stats = launcher.getStats();
      logger.info(`stdio模式启动完成，活跃服务器: ${stats.activeServers}/${stats.totalServers}`);
      
    } else {
      // 传统模式：使用原有逻辑
      server = new MCPServer(config);
      
      if (options.web) {
        // 仅Web模式
        logger.info('启动Web模式...');
        await server.startWebOnly();
      } else {
        // 完整MCP模式
        logger.info('启动MCP服务器...');
        await server.start();
      }
    }
    
    // 根据模式决定是否保持进程运行
    if (options.persistent || options.web) {
      logger.info('持久运行模式已启用，服务器将保持运行直到手动停止');
      
      // 保持进程运行
      process.stdin.resume();
    }
    
    // 处理优雅关闭
    process.on('SIGINT', async () => {
      logger.info('收到SIGINT信号，正在关闭服务器...');
      if (launcher) {
        await launcher.cleanup();
      } else {
        await server.stop();
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      logger.info('收到SIGTERM信号，正在关闭服务器...');
      if (launcher) {
        await launcher.cleanup();
      } else {
        await server.stop();
      }
      process.exit(0);
    });
    
  } catch (error) {
    if (error instanceof MCPError) {
      logger.error(`MCP错误 [${error.code}]: ${error.message}`);
      if (error.details) {
        logger.debug('错误详情:', error.details);
      }
    } else if (error instanceof Error) {
      logger.error('启动失败:', error.message);
      logger.debug('错误堆栈:', error.stack);
    } else {
      logger.error('未知错误:', error);
    }
    process.exit(1);
  }
}

/**
 * 启动开发模式服务器（固定端口）
 */
async function startDevServer(): Promise<void> {
  try {
    
    // 加载配置
    const config = getConfig();
    config.transportMode = TransportMode.MCP;
    
    // 设置调试日志
    logger.setLevel('debug');
    logger.enableFileLogging();
    
    // 创建带固定端口的WebServer实例
    const webServer = new WebServer(config, 10050);
    
    // 创建并启动服务器
    const server = new MCPServer(config, webServer);
    await server.startWebOnly();
    
    console.log('开发服务器已启动');
    console.log(`Web界面: http://localhost:10050`);
    console.log(`API端点: http://localhost:10050/api`);
    console.log('前端代理已配置到此端口\n');
    console.log('提示: 在另一个终端运行 "npm run dev:frontend" 启动前端开发服务器');
    console.log('按 Ctrl+C 停止服务器\n');
    
    // 保持进程运行
    process.stdin.resume();
    
    // 处理优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n收到停止信号，正在关闭开发服务器...');
      await server.stop();
      console.log('开发服务器已停止');
      process.exit(0);
    });
    
    process.on('SIGTERM', async () => {
      console.log('\n收到终止信号，正在关闭开发服务器...');
      await server.stop();
      console.log('开发服务器已停止');
      process.exit(0);
    });
    
  } catch (error) {
    if (error instanceof MCPError) {
      console.error(`开发服务器启动失败 [${error.code}]: ${error.message}`);
    } else if (error instanceof Error) {
      console.error('开发服务器启动失败:', error.message);
      logger.debug('错误堆栈:', error.stack);
    } else {
      console.error('未知错误:', error);
    }
    process.exit(1);
  }
}

/**
 * 显示健康检查信息
 */
async function healthCheck(): Promise<void> {
  try {
    const config = getConfig();
    console.log('配置验证通过');
    console.log(`超时时间: ${config.dialogTimeout}秒`);
    
    
  } catch (error) {
    if (error instanceof MCPError) {
      console.error(`配置错误 [${error.code}]: ${error.message}`);
    } else {
      console.error('健康检查失败:', error);
    }
    process.exit(1);
  }
}

// 配置CLI命令
program
  .name('mcp-feedback-collector')
  .description('基于Node.js的MCP反馈收集器')
  .version(VERSION);

// 主命令 - 启动服务器
program
  .command('start', { isDefault: true })
  .description('启动MCP反馈收集器')
  .option('-w, --web', '仅启动Web模式（不启动MCP服务器）')
  .option('-c, --config <path>', '指定配置文件路径')
  .option('-d, --debug', '启用调试模式（显示详细的MCP通信日志）')
  .option('-m, --mode <mode>', '指定传输模式 (stdio|mcp)', 'stdio')
  .option('--persistent', '持久运行模式，不自动退出')
  .action(startMCPServer);

// 开发模式命令 - 固定端口启动
program
  .command('dev')
  .description('启动开发模式服务器（固定端口10050，用于前端开发）')
  .action(startDevServer);

// 健康检查命令
program
  .command('health')
  .description('检查配置和系统状态')
  .action(healthCheck);

// 配置显示命令
program
  .command('config')
  .description('显示当前配置')
  .action(() => {
    try {
      const config = getConfig();
      displayConfig(config);
    } catch (error) {
      console.error('配置加载失败:', error);
      process.exit(1);
    }
  });

// 性能监控命令
program
  .command('metrics')
  .description('显示性能监控指标')
  .option('-f, --format <format>', '输出格式 (json|text)', 'text')
  .action(async (options) => {
    try {

      const config = getConfig();
      logger.setLevel('error'); // 减少日志输出

      logger.info(' 获取性能监控指标...');

      // 创建MCP服务器实例
      const server = new MCPServer(config);

      // 启动Web服务器
      await server.startWebOnly();

      // 等待服务器完全启动
      await new Promise(resolve => setTimeout(resolve, 1000));

      try {
        const response = await fetch(`http://localhost:${server.getStatus().webPort}/api/metrics`);
        const metrics = await response.json();

        if (options.format === 'json') {
          console.log(JSON.stringify(metrics, null, 2));
        } else {
          const reportResponse = await fetch(`http://localhost:${server.getStatus().webPort}/api/performance-report`);
          const report = await reportResponse.text();
          console.log(report);
        }

      } catch (error) {
        logger.error('获取性能指标失败:', error);
      }

      await server.stop();

    } catch (error) {
      logger.error('性能监控失败:', error);
      process.exit(1);
    }
  });

// 测试MCP工具函数命令
program
  .command('test-feedback')
  .description('测试collect_feedback工具函数')
  .option('-m, --message <message>', '测试工作汇报内容', '这是一个测试工作汇报，用于验证collect_feedback功能是否正常工作。')
  .action(async (options) => {
    try {

      const config = getConfig();
      logger.setLevel(config.logLevel as any);

      logger.info('开始测试collect_feedback工具函数...');

      // 创建MCP服务器实例
      const server = new MCPServer(config);

      // 启动Web服务器
      await server.startWebOnly();

      // 等待服务器完全启动
      await new Promise(resolve => setTimeout(resolve, 1000));

      // 创建测试会话
      logger.info('创建测试会话...');

      const testParams = {
        work_summary: options.message
      };

      try {
        const response = await fetch(`http://localhost:${server.getStatus().webPort}/api/test-session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(testParams)
        });

        const result = await response.json() as any;

        if (result.success) {
          logger.info('测试会话创建成功');
          logger.info(`会话ID: ${result.session_id}`);
          logger.info(`反馈页面: ${result.feedback_url}`);

          // 自动打开浏览器
          try {
            const open = await import('open');
            await open.default(result.feedback_url);
            logger.info('浏览器已自动打开反馈页面');
          } catch (error) {
            logger.warn('无法自动打开浏览器，请手动访问上述URL');
          }

          logger.info('现在您可以在浏览器中测试完整的反馈流程');
          logger.info(`会话将在 ${config.dialogTimeout} 秒后超时`);

        } else {
          logger.error('测试会话创建失败:', result.error);
        }
      } catch (error) {
        logger.error('创建测试会话时出错:', error);
      }

      // 保持进程运行
      process.stdin.resume();

    } catch (error) {
      logger.error('测试失败:', error);
      if (error instanceof Error) {
        logger.error('错误详情:', error.message);
        logger.error('错误堆栈:', error.stack);
      }
      process.exit(1);
    }
  });
// 解析命令行参数
program.parse();
