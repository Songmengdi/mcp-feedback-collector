#!/usr/bin/env node

/**
 * MCP Feedback Collector - Node.js客户端
 * 支持连接到MCP反馈收集服务器并调用collect_feedback工具
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fileURLToPath } from 'url';
import * as readline from 'node:readline';



/**
 * MCP客户端类
 */
class MCPClient {
  constructor(options = {}) {
    this.client = null;
    this.transport = null;
    this.httpPort = options.httpPort || 3001;
    this.timeout = options.timeout || 60;
    this.debug = options.debug || false;
  }

  /**
   * 调试日志
   */
  log(message, ...args) {
    if (this.debug) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  /**
   * 检查HTTP服务器是否运行
   */
  async checkHttpServer(port = this.httpPort) {
    try {
      const response = await fetch(`http://localhost:${port}/`, {
        method: 'GET',
        timeout: 5000
      });
      return response.status < 500; // 接受任何非服务器错误状态
    } catch (error) {
      this.log('服务器检查失败:', error.message);
      return false;
    }
  }

  /**
   * 连接到MCP服务器
   */
  async connect() {
    try {
      this.log(`连接到MCP服务器端口 ${this.httpPort}`);
      
      // 检查服务器是否运行
      const serverAvailable = await this.checkHttpServer();
      if (!serverAvailable) {
        throw new Error(`MCP服务器未在端口 ${this.httpPort} 运行，请先启动服务器`);
      }
      
      // 创建StreamableHTTP传输
      const serverUrl = `http://localhost:${this.httpPort}/mcp`;
      this.transport = new StreamableHTTPClientTransport(serverUrl);

      // 创建客户端
      this.client = new Client({
        name: 'mcp-feedback-client',
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      // 添加协议级别的调试监听
      if (this.debug) {
        // 监听客户端错误
        this.client.onerror = (error) => {
          console.error('[DEBUG] MCP客户端错误:', error);
          console.error('[DEBUG] 错误堆栈:', error.stack);
        };

        // 监听传输层错误
        if (this.transport.onerror) {
          this.transport.onerror = (error) => {
            console.error('[DEBUG] 传输层错误:', error);
          };
        }
      }

      // 连接
      await this.client.connect(this.transport);
      this.log('连接建立成功');

      // 验证连接
      await this.listTools();
      console.log('✅ MCP客户端连接成功');
      
    } catch (error) {
      console.log(error)
      console.error('❌ 连接失败:', error.message);
      throw error;
    }
  }

  /**
   * 获取工具列表
   */
  async listTools() {
    if (!this.client) {
      throw new Error('客户端未连接');
    }

    if (this.debug) {
      console.log('[DEBUG] 调用 client.listTools()...');
    }

    try {
      const response = await this.client.listTools();

      if (this.debug) {
        console.log('[DEBUG] 工具列表响应:', JSON.stringify(response, null, 2));
      }

      this.log('可用工具:', response.tools?.map(t => t.name));
      
      // 验证collect_feedback工具是否存在
      const hasFeedbackTool = response.tools?.some(tool => tool.name === 'collect_feedback');
      if (!hasFeedbackTool) {
        throw new Error('服务器不支持collect_feedback工具');
      }

      return response.tools;
    } catch (error) {
      if (this.debug) {
        console.error('[DEBUG] 工具列表请求失败:', error);
        console.error('[DEBUG] 错误堆栈:', error.stack);
      }
      throw error;
    }
  }

  /**
   * 调用collect_feedback工具
   */
  async callCollectFeedback(workSummary) {
    if (!this.client) {
      throw new Error('客户端未连接');
    }

    console.log('\n📝 正在收集反馈...');
    console.log(`⏱️  超时时间: ${this.timeout}秒`);
    console.log('🌐 请在浏览器中提供反馈');

    const toolCallParams = {
      name: 'collect_feedback',
      arguments: {
        work_summary: workSummary
      }
    };

    if (this.debug) {
      console.log('[DEBUG] 工具调用参数:', JSON.stringify(toolCallParams, null, 2));
      console.log('[DEBUG] 调用 client.callTool()...');
    }

    try {
      const result = await this.client.callTool(toolCallParams);
      
      if (this.debug) {
        console.log('[DEBUG] 工具调用响应:', JSON.stringify(result, null, 2));
      }

      return result;
    } catch (error) {
      console.error('❌ 工具调用失败:', error.message);
      if (this.debug) {
        console.error('[DEBUG] 工具调用详细错误:', error);
        console.error('[DEBUG] 错误堆栈:', error.stack);
      }
      throw error;
    }
  }

  /**
   * 处理工具结果
   */
  processToolResult(result) {
    if (!result.content || result.content.length === 0) {
      console.log('\n📭 未收到用户反馈');
      return;
    }

    console.log('\n📬 收到用户反馈:');
    console.log('=' .repeat(50));

    let feedbackCount = 0;
    let imageCount = 0;

    result.content.forEach((item, index) => {
      if (item.type === 'text') {
        const text = item.text.trim();
        
        if (text.includes('未收到用户反馈')) {
          console.log('📭 未收到用户反馈');
        } else if (text.includes('图片数量:')) {
          const match = text.match(/图片数量: (\d+)/);
          if (match) {
            imageCount += parseInt(match[1]);
          }
          console.log(`🖼️  ${text}`);
        } else if (text.includes('图片 ')) {
          console.log(`   ${text}`);
        } else if (text.includes('提交时间:')) {
          console.log(`⏰ ${text}`);
        } else if (text.length > 0 && !text.includes('收到') && !text.includes('条用户反馈')) {
          feedbackCount++;
          console.log(`💬 反馈内容: ${text}`);
        }
      } else if (item.type === 'image') {
        console.log(`🖼️  收到图片 (${item.mimeType})`);
      }
    });

    if (feedbackCount > 0 || imageCount > 0) {
      console.log(`\n📊 反馈统计: ${feedbackCount}条文字反馈, ${imageCount}张图片`);
    }
    
    console.log('=' .repeat(50));
  }

  /**
   * 启动交互模式
   */
  async startInteractiveMode() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('\n🚀 MCP反馈收集客户端已启动');
    console.log('💡 输入AI工作汇报内容，或输入 "quit" 退出');

    const askQuestion = () => {
      rl.question('\n📝 请输入工作汇报内容: ', async (input) => {
        try {
          if (input.toLowerCase().trim() === 'quit') {
            console.log('\n👋 再见!');
            await this.disconnect();
            rl.close();
            return;
          }

          if (!input.trim()) {
            console.log('⚠️  请输入有效的工作汇报内容');
            askQuestion();
            return;
          }

          const result = await this.callCollectFeedback(input.trim());
          this.processToolResult(result);
          
          askQuestion();
        } catch (error) {
          console.error('❌ 处理失败:', error.message);
          askQuestion();
        }
      });
    };

    askQuestion();
  }

  /**
   * 断开连接
   */
  async disconnect() {
    try {
      if (this.transport) {
        await this.transport.close();
        this.transport = null;
      }
      
      this.client = null;
      this.log('连接已断开');
    } catch (error) {
      this.log('断开连接时出错:', error.message);
    }
  }
}

/**
 * 显示帮助信息
 */
function showHelp() {
  console.log(`
MCP反馈收集客户端

用法:
  node mcp-client.js [选项]

选项:
  --port <端口>               MCP服务器端口 (默认: 3001)
  --timeout <秒数>            反馈收集超时时间 (默认: 60)
  --debug                     启用调试日志
  --help                      显示帮助信息

示例:
  node mcp-client.js                    # 连接到默认端口3001
  node mcp-client.js --port 3001        # 指定端口
  node mcp-client.js --debug            # 启用调试
  node mcp-client.js --timeout 120      # 设置超时时间

注意: 请确保MCP服务器已经在指定端口运行
`);
}

/**
 * 解析命令行参数
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
        options.httpPort = parseInt(args[++i]);
        break;
      case '--timeout':
        options.timeout = parseInt(args[++i]);
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--help':
        showHelp();
        process.exit(0);
        break;
      default:
        console.error(`未知参数: ${args[i]}`);
        showHelp();
        process.exit(1);
    }
  }

  return options;
}

/**
 * 主函数
 */
async function main() {
  const options = parseArgs();
  const client = new MCPClient(options);

  // 处理进程退出
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 收到退出信号，正在清理...');
    await client.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await client.disconnect();
    process.exit(0);
  });

  try {
    await client.connect();
    await client.startInteractiveMode();
  } catch (error) {
    console.error('❌ 启动失败:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(console.error);
}

export { MCPClient }; 