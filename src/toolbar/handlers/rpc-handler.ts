// RPC Bridge for WebSocket communication

import { SRPCWebSocketBridge } from '../bridge/srpc-websocket-bridge.js';

// 定义prompt转发回调函数类型
type PromptForwarder = (promptData: {
  prompt: string;
  sessionId: string;
  model?: string;
  files?: any[];
  images?: any[];
  mode?: string;
  metadata?: any;
}) => Promise<any>;

/**
 * RPC桥接器类，处理具体的RPC方法实现
 */
export class ToolbarRPCHandler {
  private bridge: SRPCWebSocketBridge;
  private promptForwarder: PromptForwarder | undefined;

  constructor(bridge: SRPCWebSocketBridge, promptForwarder?: PromptForwarder) {
    this.bridge = bridge;
    this.promptForwarder = promptForwarder || undefined;
    this.registerMethods();
  }

  private registerMethods() {
    this.bridge.register({
      getSessionInfo: this.getSessionInfo.bind(this),
      triggerAgentPrompt: this.triggerAgentPrompt.bind(this),
    });
  }

  /**
   * 获取会话信息
   */
  private async getSessionInfo(
    request: any,
    sendUpdate: (update: any) => void,
  ): Promise<any> {
    console.log('[Toolbar RPC] getSessionInfo called with request:', request);
    
    // 发送更新（可选）
    sendUpdate({
      status: 'gathering_session_info',
      message: 'Collecting session information...',
    });

    // 返回会话信息
    const sessionInfo = {
      sessionId: 'mcp-feedback-collector-session-' + Date.now(),
      appName: 'MCP Feedback Collector',
      displayName: 'MCP Feedback Collector - Toolbar Integration',
      port: process.env['PORT'] || 3000,
      version: '2.0.8',
      features: ['feedback-collection', 'ai-agent', 'toolbar-integration'],
    };

    console.log('[Toolbar RPC] Returning session info:', sessionInfo);
    return sessionInfo;
  }

  /**
   * 触发AI代理提示
   */
  private async triggerAgentPrompt(
    request: any,
    sendUpdate: (update: any) => void,
  ): Promise<any> {
    console.log('[Toolbar RPC] triggerAgentPrompt called with request:', request);
    
    const { prompt, model, files, mode, images, sessionId } = request;

    // 发送处理更新
    sendUpdate({
      sessionId,
      updateText: 'Processing your prompt...',
      status: 'processing',
    });

    try {
      // 如果有prompt转发器，使用它转发到WebServer
      if (this.promptForwarder) {
        console.log('[Toolbar RPC] Forwarding prompt to WebServer...');
        
        sendUpdate({
          sessionId,
          updateText: 'Forwarding prompt to feedback system...',
          status: 'forwarding',
        });

        const forwardResult = await this.promptForwarder({
          prompt,
          sessionId: sessionId || `rpc_${Date.now()}`,
          model,
          files,
          images,
          mode,
          metadata: {
            source: 'toolbar_rpc',
            timestamp: Date.now(),
            rpcMethod: 'triggerAgentPrompt'
          }
        });

        sendUpdate({
          sessionId,
          updateText: 'Prompt forwarded successfully to feedback system',
          status: 'forwarded',
        });

        // 返回转发结果
        const result = {
          sessionId,
          result: {
            success: true,
            output: 'Prompt has been forwarded to the MCP Feedback Collector system. Please check the feedback interface for the prompt display.',
            forwardResult,
            metadata: {
              model: model || 'default',
              mode: mode || 'agent',
              processedAt: new Date().toISOString(),
              service: 'mcp-feedback-collector',
              version: '2.0.8',
              forwarded: true
            }
          },
        };

        console.log('[Toolbar RPC] Prompt forwarded successfully:', result);
        return result;

      } else {
        // 回退到模拟处理（兼容性）
        console.log('[Toolbar RPC] No prompt forwarder available, using fallback simulation...');
        
        sendUpdate({
          sessionId,
          updateText: 'AI agent is working on your request...',
          status: 'ai_processing',
        });

        // 模拟AI处理
        await new Promise(resolve => setTimeout(resolve, 2000));

        // 生成响应
        let response = `MCP Feedback Collector AI Agent Response:\n\n`;
        response += `Prompt: "${prompt}"\n`;
        
        if (files && files.length > 0) {
          response += `Files referenced: ${files.join(', ')}\n`;
        }
        
        if (images && images.length > 0) {
          response += `Images processed: ${images.length} image(s)\n`;
        }
        
        response += `\nModel: ${model || 'default'}\n`;
        response += `Mode: ${mode || 'agent'}\n\n`;
        
        response += '--- AI Analysis ---\n';
        response += 'This is integrated with the MCP Feedback Collector system. ';
        response += 'The AI agent can now work with feedback data and provide enhanced responses. ';
        response += 'This demonstrates successful toolbar integration with the core MCP service.';

        // 返回结果
        const result = {
          sessionId,
          result: {
            success: true,
            output: response,
            metadata: {
              model: model || 'default',
              mode: mode || 'agent',
              processedAt: new Date().toISOString(),
              service: 'mcp-feedback-collector',
              version: '2.0.8',
              fallback: true
            }
          },
        };

        console.log('[Toolbar RPC] Returning fallback result:', result);
        return result;
      }

    } catch (error) {
      console.error('[Toolbar RPC] Error in triggerAgentPrompt:', error);
      
      sendUpdate({
        sessionId,
        updateText: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        status: 'error',
      });

      return {
        sessionId,
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          metadata: {
            service: 'mcp-feedback-collector',
            processedAt: new Date().toISOString()
          }
        },
      };
    }
  }
}

// RPC方法接口
interface RPCMethod {
  (request: any, sendUpdate: UpdateSender): Promise<any>;
}

// 更新发送器接口
interface UpdateSender {
  sendUpdate: (update: any) => void;
}

// RPC方法注册表
const rpcMethods = new Map<string, RPCMethod>();

// 注册RPC方法
export const registerRPCMethod = (name: string, method: RPCMethod): void => {
  rpcMethods.set(name, method);
  console.log(`[Toolbar RPC] Method registered: ${name}`);
};

// 调用RPC方法 (由WebSocket桥接器处理)
export const callRPCMethod = async (
  methodName: string, 
  request: any, 
  sessionId: string,
  sendUpdateCallback?: (update: any) => void
): Promise<any> => {
  const method = rpcMethods.get(methodName);
  
  if (!method) {
    throw new Error(`RPC method not found: ${methodName}`);
  }

  // 创建更新发送器
  const sendUpdate: UpdateSender = {
    sendUpdate: (update: any) => {
      if (sendUpdateCallback) {
        sendUpdateCallback({
          type: 'rpc_update',
          methodName,
          update
        });
      }
    }
  };

  return await method(request, sendUpdate);
};

// 获取会话信息的RPC方法
export const getSessionInfo: RPCMethod = async (request, sendUpdate) => {
  const { sessionId } = request;
  
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  console.log(`[Toolbar RPC] Getting session info for: ${sessionId}`);

  return {
    sessionId,
    timestamp: new Date().toISOString(),
    status: 'active',
    service: 'mcp-feedback-collector',
    info: {
      createdAt: new Date(),
      lastActivity: new Date(),
      port: process.env['PORT'] || 3000,
      metadata: {
        source: 'websocket_rpc',
        version: '2.0.8',
        service: 'mcp-feedback-collector'
      }
    }
  };
};

// 触发代理提示的RPC方法
export const triggerAgentPrompt: RPCMethod = async (request, sendUpdate) => {
  const { sessionId, prompt, files, images, model, mode } = request;
  
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  if (!prompt) {
    throw new Error('prompt is required');
  }

  console.log(`[Toolbar RPC] Processing prompt for session ${sessionId}: ${prompt.substring(0, 100)}...`);

  // 发送处理开始的更新
  sendUpdate.sendUpdate({
    sessionId,
    updateText: 'Processing prompt...',
    status: 'processing'
  });

  try {
    // 模拟AI处理过程
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 发送处理中的更新
    sendUpdate.sendUpdate({
      sessionId,
      updateText: 'Calling AI agent...',
      status: 'calling_agent'
    });

    // 模拟AI响应生成
    await new Promise(resolve => setTimeout(resolve, 1500));

    // 生成响应
    let response = `MCP Feedback Collector AI Agent Response for prompt: "${prompt}"\n\n`;
    
    if (files && files.length > 0) {
      response += `Files referenced: ${files.join(', ')}\n`;
    }
    
    if (images && images.length > 0) {
      response += `Images processed: ${images.length} image(s)\n`;
    }
    
    response += '\n--- AI Analysis ---\n';
    response += 'This response is generated by the integrated MCP Feedback Collector AI agent. ';
    response += 'The system can now handle toolbar requests and provide feedback collection capabilities. ';
    response += 'This demonstrates successful integration between toolbar communication and the core MCP service.';

    // 发送完成的更新
    sendUpdate.sendUpdate({
      sessionId,
      updateText: 'AI processing completed',
      status: 'completed',
      result: response
    });

    console.log(`[Toolbar RPC] Prompt processed successfully for session ${sessionId}`);

    return {
      sessionId,
      result: {
        success: true,
        output: response,
        metadata: {
          model: model || 'default',
          mode: mode || 'agent',
          processedAt: new Date().toISOString(),
          service: 'mcp-feedback-collector',
          version: '2.0.8'
        }
      }
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // 发送错误更新
    sendUpdate.sendUpdate({
      sessionId,
      updateText: `Error: ${errorMessage}`,
      status: 'error'
    });

    console.error(`[Toolbar RPC] Error processing prompt for session ${sessionId}:`, error);

    return {
      sessionId,
      result: {
        success: false,
        error: errorMessage,
        service: 'mcp-feedback-collector'
      }
    };
  }
};

// 注册默认RPC方法
registerRPCMethod('getSessionInfo', getSessionInfo);
registerRPCMethod('triggerAgentPrompt', triggerAgentPrompt);

// 导出RPC方法映射
export const defaultRPCMethods = {
  getSessionInfo,
  triggerAgentPrompt
}; 