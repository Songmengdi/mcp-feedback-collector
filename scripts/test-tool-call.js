#!/usr/bin/env node

/**
 * MCP工具调用测试脚本
 * 专门用于测试collect_feedback工具调用的兼容性
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

async function testToolCall() {
    console.log('🧪 开始测试MCP工具调用...');
    
    const serverUrl = 'http://localhost:3001/mcp';
    console.log(`📡 连接到: ${serverUrl}`);
    
    try {
        // 创建传输和客户端
        const transport = new StreamableHTTPClientTransport(serverUrl);
        const client = new Client({
            name: 'test-tool-call-client',
            version: '1.0.0'
        }, {
            capabilities: {}
        });
        
        // 添加详细的错误监听
        client.onerror = (error) => {
            console.error('[ERROR] 客户端错误:', error);
            console.error('[ERROR] 错误堆栈:', error.stack);
        };

        if (transport.onerror) {
            transport.onerror = (error) => {
                console.error('[ERROR] 传输层错误:', error);
            };
        }
        
        // 连接
        console.log('🔗 正在连接...');
        await client.connect(transport);
        console.log('✅ 连接成功!');
        
        // 测试工具列表 - 使用正确的SDK方法
        console.log('📋 获取工具列表...');
        console.log('[DEBUG] 调用 client.listTools()...');
        
        const toolsResponse = await client.listTools();
        console.log('[DEBUG] 工具列表响应:', JSON.stringify(toolsResponse, null, 2));
        
        console.log('🛠️  可用工具:');
        toolsResponse.tools?.forEach(tool => {
            console.log(`   - ${tool.name}: ${tool.description || '无描述'}`);
        });
        
        // 检查collect_feedback工具
        const hasFeedbackTool = toolsResponse.tools?.some(tool => tool.name === 'collect_feedback');
        if (!hasFeedbackTool) {
            console.error('❌ collect_feedback工具不可用');
            return;
        }
        
        // 测试collect_feedback工具调用 - 使用正确的SDK方法
        console.log('\n🎯 测试collect_feedback工具调用...');
        const toolCallParams = {
            name: 'collect_feedback',
            arguments: {
                work_summary: '测试MCP工具调用功能 - 验证协议兼容性'
            }
        };
        
        console.log('[DEBUG] 工具调用参数:', JSON.stringify(toolCallParams, null, 2));
        console.log('[DEBUG] 调用 client.callTool()...');
        
        const toolCallResponse = await client.callTool(toolCallParams);
        console.log('[DEBUG] 工具调用响应:', JSON.stringify(toolCallResponse, null, 2));
        
        console.log('📬 工具调用结果:');
        if (toolCallResponse.content && toolCallResponse.content.length > 0) {
            toolCallResponse.content.forEach((item, index) => {
                if (item.type === 'text') {
                    console.log(`   ${index + 1}. [文本] ${item.text}`);
                } else if (item.type === 'image') {
                    console.log(`   ${index + 1}. [图片] ${item.mimeType}`);
                }
            });
        } else {
            console.log('   (无内容返回)');
        }
        
        // 断开连接
        await transport.close();
        console.log('🔌 连接已断开');
        console.log('✅ 工具调用测试完成!');
        
    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        console.error('[ERROR] 详细错误信息:', error);
        console.error('[ERROR] 错误堆栈:', error.stack);
        
        // 检查是否是parse相关错误
        if (error.message.includes('parse') || error.stack?.includes('parse')) {
            console.error('\n🔍 检测到parse相关错误，可能的原因:');
            console.error('   1. MCP SDK版本不兼容');
            console.error('   2. 服务器响应格式不正确');
            console.error('   3. 消息序列化/反序列化问题');
            console.error('   4. 协议版本不匹配');
        }
        
        process.exit(1);
    }
}

// 运行测试
testToolCall().catch(console.error); 