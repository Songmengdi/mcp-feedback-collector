#!/usr/bin/env node

/**
 * Toolbar 集成测试脚本
 * 验证 SRPC WebSocket 桥接器和 RPC 处理器的基本功能
 */

import { createServer } from 'http';
import { createSRPCBridge, ToolbarRPCHandler } from './dist/toolbar/index.js';

console.log('🧪 开始 Toolbar 集成测试...\n');

// 创建 HTTP 服务器
const server = createServer();

// 创建 SRPC WebSocket 桥接器
const srpcBridge = createSRPCBridge(server);

// 创建 RPC 处理器
const rpcHandler = new ToolbarRPCHandler(srpcBridge);

console.log('✅ SRPC WebSocket 桥接器创建成功');
console.log('✅ RPC 处理器创建成功');

// 检查注册的方法
const registeredMethods = srpcBridge.getRegisteredMethods();
console.log('📋 已注册的 RPC 方法:', registeredMethods);

// 检查连接状态
console.log('🔗 WebSocket 连接状态:', srpcBridge.isConnected());

// 启动服务器进行测试
const port = 3001;
server.listen(port, () => {
  console.log(`\n🚀 测试服务器启动在端口 ${port}`);
  console.log(`📡 WebSocket 端点: ws://localhost:${port}`);
  console.log('\n可以使用以下命令测试 WebSocket 连接:');
  console.log(`node test-websocket-client.js ws://localhost:${port}`);
  
  // 10秒后自动关闭
  setTimeout(() => {
    console.log('\n⏰ 测试完成，关闭服务器...');
    srpcBridge.close();
    server.close(() => {
      console.log('✅ 服务器已关闭');
      process.exit(0);
    });
  }, 10000);
});

// 错误处理
server.on('error', (error) => {
  console.error('❌ 服务器错误:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 收到中断信号，关闭服务器...');
  srpcBridge.close();
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
}); 