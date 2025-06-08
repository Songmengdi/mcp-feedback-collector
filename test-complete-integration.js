#!/usr/bin/env node

/**
 * 完整的 Toolbar 集成测试脚本
 * 测试第4-7步的所有功能
 */

import { WebServer } from './dist/server/web-server.js';
import { PortManager } from './dist/utils/port-manager.js';

console.log('🧪 开始完整的 Toolbar 集成测试...\n');

// 创建配置
const config = {
  corsOrigin: '*',
  maxFileSize: 50 * 1024 * 1024, // 50MB
  timeout: 300000, // 5分钟
  port: 0 // 自动分配
};

// 创建端口管理器
const portManager = new PortManager();

async function runTests() {
  try {
    console.log('📋 第1步：检查 Toolbar 端口配置');
    const toolbarConfig = portManager.getToolbarPortConfig();
    console.log('✅ Toolbar 端口配置:', toolbarConfig);

    console.log('\n📋 第2步：检测现有 Toolbar 服务');
    const existingServices = await portManager.detectToolbarServices();
    console.log('✅ 现有服务:', existingServices);

    console.log('\n📋 第3步：查找可用的 Toolbar 端口');
    const toolbarPort = await portManager.findToolbarPort();
    console.log('✅ 找到可用端口:', toolbarPort);

    console.log('\n📋 第4步：创建 WebServer 实例（包含 SRPC 支持）');
    const webServer = new WebServer(config);
    console.log('✅ WebServer 创建成功');

    console.log('\n📋 第5步：启动服务器');
    await webServer.start();
    const serverPort = webServer.getPort();
    console.log(`✅ 服务器启动成功，端口: ${serverPort}`);

    console.log('\n📋 第6步：测试 Toolbar 专用路由');
    
    // 测试 ping 端点
    try {
      const pingResponse = await fetch(`http://localhost:${serverPort}/ping/stagewise`);
      const pingText = await pingResponse.text();
      console.log('✅ Ping 端点测试成功:', pingText);
    } catch (error) {
      console.error('❌ Ping 端点测试失败:', error.message);
    }

    // 测试 toolbar 状态端点
    try {
      const statusResponse = await fetch(`http://localhost:${serverPort}/api/toolbar/status`);
      const statusData = await statusResponse.json();
      console.log('✅ Toolbar 状态端点测试成功:', statusData);
    } catch (error) {
      console.error('❌ Toolbar 状态端点测试失败:', error.message);
    }

    console.log('\n📋 第7步：获取 Toolbar 状态');
    const toolbarStatus = webServer.getToolbarStatus();
    console.log('✅ Toolbar 状态:', toolbarStatus);

    console.log('\n📋 第8步：测试端口管理功能');
    const portRangeStatus = await portManager.getToolbarPortRangeStatus();
    console.log('✅ Toolbar 端口范围状态:', portRangeStatus.slice(0, 3)); // 只显示前3个

    console.log('\n📋 第9步：重新检测 Toolbar 服务（应该包含我们的服务）');
    const updatedServices = await portManager.detectToolbarServices();
    console.log('✅ 更新后的服务列表:', updatedServices);

    console.log('\n🎉 所有测试完成！');
    console.log('\n📊 测试总结:');
    console.log(`- 服务器端口: ${serverPort}`);
    console.log(`- SRPC 支持: ${toolbarStatus.enabled ? '✅' : '❌'}`);
    console.log(`- WebSocket 连接: ${toolbarStatus.connected ? '✅' : '❌'}`);
    console.log(`- 注册的 RPC 方法: ${toolbarStatus.registeredMethods.join(', ')}`);
    console.log(`- Toolbar 端口范围: ${toolbarConfig.rangeStart}-${toolbarConfig.rangeEnd}`);

    // 等待10秒后关闭
    console.log('\n⏰ 10秒后自动关闭服务器...');
    setTimeout(async () => {
      console.log('\n🛑 关闭服务器...');
      await webServer.stop();
      console.log('✅ 服务器已关闭');
      process.exit(0);
    }, 10000);

  } catch (error) {
    console.error('❌ 测试失败:', error);
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 收到中断信号，退出测试...');
  process.exit(0);
});

// 运行测试
runTests(); 