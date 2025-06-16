#!/usr/bin/env node

/**
 * MCP客户端测试脚本
 * 用于快速测试连接和collect_feedback工具调用
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testMCPClient() {
    console.log('🧪 开始测试MCP客户端连接...');
    
    const serverUrl = 'http://localhost:3001/mcp';
    console.log(`📡 连接到: ${serverUrl}`);
    
    try {
        // 创建传输和客户端
        const transport = new StreamableHTTPClientTransport(serverUrl);
        const client = new Client({
            name: 'test-mcp-client',
            version: '1.0.0'
        }, {
            capabilities: {}
        });
        
        // 连接
        console.log('🔗 正在连接...');
        await client.connect(transport);
        console.log('✅ 连接成功!');
        
        // 列出工具
        console.log('📋 获取工具列表...');
        const toolsResponse = await client.listTools();
        
        console.log('🛠️  可用工具:');
        toolsResponse.tools?.forEach(tool => {
            console.log(`   - ${tool.name}: ${tool.description || '无描述'}`);
        });
        
        // 测试collect_feedback工具
        const hasFeedbackTool = toolsResponse.tools?.some(tool => tool.name === 'collect_feedback');
        if (hasFeedbackTool) {
            console.log('\n🎯 测试collect_feedback工具...');
            const result = await client.callTool({
                name: 'collect_feedback',
                arguments: {
                    work_summary: '测试MCP客户端连接和工具调用功能123'
                }
            });
            
            console.log('📬 工具调用结果:');
            if (result.content && result.content.length > 0) {
                result.content.forEach((item, index) => {
                    if (item.type === 'text') {
                        console.log(`   ${index + 1}. ${item.text}`);
                    } else if (item.type === 'image') {
                        console.log(`   ${index + 1}. [图片: ${item.mimeType}]`);
                    }
                });
            } else {
                console.log('   (无内容返回)');
            }
        } else {
            console.log('❌ collect_feedback工具不可用');
        }
        
        // 断开连接
        await transport.close();
        console.log('🔌 连接已断开');
        console.log('✅ 测试完成!');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('详细错误:', error);
        process.exit(1);
    }
}

// 运行测试
testMCPClient().catch(console.error); 