#!/usr/bin/env node

/**
 * 多客户端并发测试脚本 - 增强版
 * 用于测试和诊断反馈路由问题
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const SERVER_URL = 'http://localhost:3001/mcp';
const CLIENT_COUNT = parseInt(process.argv[2]) || 2;
const TEST_TIMEOUT = 60000; // 60秒超时

console.log(`🚀 启动多客户端并发测试 (${CLIENT_COUNT} 个客户端)`);
console.log(`服务器地址: ${SERVER_URL}`);
console.log(`测试超时: ${TEST_TIMEOUT / 1000} 秒`);
console.log('=' .repeat(60));

class TestClient {
  constructor(id) {
    this.id = id;
    this.client = null;
    this.transport = null;
    this.connected = false;
    this.mcpSessionId = null;
    this.feedbackReceived = false;
    this.startTime = null;
  }

  async connect() {
    try {
      console.log(`[客户端${this.id}] 🔌 开始连接...`);
      this.startTime = Date.now();
      
      this.transport = new StreamableHTTPClientTransport(SERVER_URL);
      this.client = new Client({
        name: `test-client-${this.id}`,
        version: '1.0.0'
      }, {
        capabilities: {}
      });

      await this.client.connect(this.transport);
      this.connected = true;
      
      // 获取MCP会话ID（从传输对象中）
      this.mcpSessionId = this.transport.sessionId || `unknown-${this.id}`;
      
      const connectTime = Date.now() - this.startTime;
      console.log(`[客户端${this.id}] ✅ 连接成功 (${connectTime}ms)`);
      console.log(`[客户端${this.id}] 📋 MCP会话ID: ${this.mcpSessionId}`);
      
      return true;
    } catch (error) {
      console.error(`[客户端${this.id}] ❌ 连接失败:`, error.message);
      return false;
    }
  }

  async callCollectFeedback() {
    if (!this.connected) {
      console.error(`[客户端${this.id}] ❌ 未连接，无法调用工具`);
      return false;
    }

    try {
      const workSummary = `测试工作汇报 - 客户端${this.id} - ${new Date().toISOString()}`;
      console.log(`[客户端${this.id}] 🔧 调用collect_feedback工具...`);
      console.log(`[客户端${this.id}] 📝 工作汇报: ${workSummary.substring(0, 50)}...`);
      
      const callStartTime = Date.now();
      
      const result = await this.client.callTool({
        name: 'collect_feedback',
        arguments: {
          work_summary: workSummary
        }
      });

      const callTime = Date.now() - callStartTime;
      console.log(`[客户端${this.id}] ✅ 工具调用完成 (${callTime}ms)`);
      console.log(`[客户端${this.id}] 📊 结果类型: ${typeof result}`);
      
      if (result && result.content) {
        console.log(`[客户端${this.id}] 📄 结果内容长度: ${JSON.stringify(result.content).length} 字符`);
        this.feedbackReceived = true;
      }
      
      return true;
    } catch (error) {
      console.error(`[客户端${this.id}] ❌ 工具调用失败:`, error.message);
      return false;
    }
  }

  async disconnect() {
    if (this.client && this.connected) {
      try {
        await this.client.close();
        this.connected = false;
        console.log(`[客户端${this.id}] 🔌 已断开连接`);
      } catch (error) {
        console.error(`[客户端${this.id}] ❌ 断开连接失败:`, error.message);
      }
    }
  }

  getStats() {
    const totalTime = this.startTime ? Date.now() - this.startTime : 0;
    return {
      id: this.id,
      connected: this.connected,
      mcpSessionId: this.mcpSessionId,
      feedbackReceived: this.feedbackReceived,
      totalTime
    };
  }
}

async function runTest() {
  const clients = [];
  const results = [];

  try {
    // 创建客户端
    console.log(`📋 创建 ${CLIENT_COUNT} 个测试客户端...`);
    for (let i = 1; i <= CLIENT_COUNT; i++) {
      clients.push(new TestClient(i));
    }

    // 并发连接
    console.log(`🔌 并发连接所有客户端...`);
    const connectPromises = clients.map(client => client.connect());
    const connectResults = await Promise.all(connectPromises);
    
    const connectedCount = connectResults.filter(Boolean).length;
    console.log(`✅ 连接完成: ${connectedCount}/${CLIENT_COUNT} 个客户端成功连接`);
    
    if (connectedCount === 0) {
      console.error('❌ 没有客户端成功连接，测试终止');
      return;
    }

    // 显示会话信息
    console.log('\n📋 MCP会话信息:');
    clients.forEach(client => {
      if (client.connected) {
        console.log(`  客户端${client.id}: ${client.mcpSessionId}`);
      }
    });

    // 等待一段时间确保连接稳定
    console.log('\n⏳ 等待连接稳定...');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 并发调用collect_feedback
    console.log(`🔧 并发调用collect_feedback工具...`);
    const callPromises = clients
      .filter(client => client.connected)
      .map(client => client.callCollectFeedback());
    
    const callResults = await Promise.all(callPromises);
    const successCount = callResults.filter(Boolean).length;
    
    console.log(`✅ 工具调用完成: ${successCount}/${connectedCount} 个调用成功`);

    // 等待用户反馈（或超时）
    console.log(`\n⏳ 等待用户反馈 (${TEST_TIMEOUT / 1000} 秒超时)...`);
    console.log('💡 请在打开的浏览器窗口中提交反馈，观察反馈是否路由到正确的客户端');
    
    await new Promise(resolve => setTimeout(resolve, TEST_TIMEOUT));

  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  } finally {
    // 收集统计信息
    console.log('\n📊 测试统计:');
    console.log('=' .repeat(60));
    
    clients.forEach(client => {
      const stats = client.getStats();
      console.log(`客户端${stats.id}:`);
      console.log(`  连接状态: ${stats.connected ? '✅ 已连接' : '❌ 未连接'}`);
      console.log(`  MCP会话ID: ${stats.mcpSessionId || 'N/A'}`);
      console.log(`  反馈接收: ${stats.feedbackReceived ? '✅ 已接收' : '❌ 未接收'}`);
      console.log(`  总耗时: ${stats.totalTime}ms`);
      console.log('');
    });

    // 断开所有连接
    console.log('🔌 断开所有客户端连接...');
    const disconnectPromises = clients.map(client => client.disconnect());
    await Promise.all(disconnectPromises);
    
    console.log('✅ 测试完成');
  }
}

// 诊断函数
async function checkServerStatus() {
  try {
    console.log('🔍 检查服务器状态...');
    
    const response = await fetch('http://localhost:3001/api/mcp-debug');
    if (response.ok) {
      const data = await response.json();
      console.log('📊 MCP服务器状态:', data);
    } else {
      console.warn('⚠️  无法获取MCP服务器状态');
    }

    const webResponse = await fetch('http://localhost:3000/api/session-debug');
    if (webResponse.ok) {
      const webData = await webResponse.json();
      console.log('📊 Web服务器状态:', webData);
    } else {
      console.warn('⚠️  无法获取Web服务器状态');
    }
  } catch (error) {
    console.warn('⚠️  服务器状态检查失败:', error.message);
  }
}

// 主函数
async function main() {
  console.log('🔍 开始诊断和测试...\n');
  
  // 检查服务器状态
  await checkServerStatus();
  
  console.log('\n🚀 开始多客户端测试...\n');
  
  // 运行测试
  await runTest();
  
  console.log('\n📋 测试建议:');
  console.log('1. 检查服务器日志中的会话分配和反馈路由信息');
  console.log('2. 观察是否有"反馈来源验证失败"的错误');
  console.log('3. 确认每个客户端的反馈是否路由到正确的MCP会话');
  console.log('4. 如果发现问题，请查看详细的诊断日志');
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 启动测试
main().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
}); 