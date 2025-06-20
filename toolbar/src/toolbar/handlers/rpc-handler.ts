// RPC Bridge for WebSocket communication

import { SRPCWebSocketBridge } from '../bridge/srpc-websocket-bridge.js';

// 定义prompt广播回调函数类型
type PromptBroadcastCallback = (promptData: {
  prompt: string;
  sessionId: string;
  model?: string;
  files?: any[];
  images?: any[];
  mode?: string;
  metadata?: any;
  timestamp: number;
}) => Promise<any>;

/**
 * RPC桥接器类，处理具体的RPC方法实现
 */
export class ToolbarRPCHandler {
  private bridge: SRPCWebSocketBridge;
  private broadcastCallback: PromptBroadcastCallback | undefined;

  constructor(bridge: SRPCWebSocketBridge, broadcastCallback?: PromptBroadcastCallback) {
    this.bridge = bridge;
    this.broadcastCallback = broadcastCallback || undefined;
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
      sessionId: 'standalone-toolbar-service-session-' + Date.now(),
      appName: 'Standalone Toolbar Service',
      displayName: 'Standalone Toolbar Service - WebSocket Broadcast',
      port: 5748,
      version: '1.0.0',
      features: ['websocket-broadcast', 'toolbar-integration', 'multi-service-support'],
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
      // 如果有广播回调，使用它广播到所有WebService客户端
      if (this.broadcastCallback) {
        console.log('[Toolbar RPC] Broadcasting prompt to all WebService clients...');
        
        sendUpdate({
          sessionId,
          updateText: 'Broadcasting prompt to all connected services...',
          status: 'forwarding',
        });

        const broadcastResult = await this.broadcastCallback({
          prompt,
          sessionId: sessionId || `rpc_${Date.now()}`,
          model,
          files,
          images,
          mode,
          metadata: {
            source: 'toolbar_rpc',
            timestamp: Date.now(),
            rpcMethod: 'triggerAgentPrompt',
            service: 'standalone-toolbar-service'
          },
          timestamp: Date.now()
        });

        sendUpdate({
          sessionId,
          updateText: 'Prompt broadcasted successfully to all services',
          status: 'forwarded',
        });

        // 返回广播结果
        const result = {
          sessionId,
          result: {
            success: true,
            output: 'Prompt has been broadcasted to all connected WebService instances. All services will receive the prompt simultaneously.',
            broadcastResult,
            metadata: {
              model: model || 'default',
              mode: mode || 'agent',
              processedAt: new Date().toISOString(),
              service: 'standalone-toolbar-service',
            version: '1.0.0',
            broadcasted: true,
            port: 5748
          }
        },
        };

        console.log('[Toolbar RPC] Prompt broadcasted successfully:', result);
        return result;

      } else {
        // 没有广播回调时返回错误
        console.log('[Toolbar RPC] No broadcast callback available');
        
        sendUpdate({
          sessionId,
          updateText: 'Prompt broadcasting service not available',
          status: 'error',
        });

        return {
          sessionId,
          result: {
            success: false,
            error: 'Prompt broadcasting service not available',
            metadata: {
              service: 'standalone-toolbar-service',
              version: '1.0.0',
              processedAt: new Date().toISOString()
            }
          },
        };
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
            service: 'standalone-toolbar-service',
            processedAt: new Date().toISOString()
          }
        },
      };
    }
  }
}

// 兼容性导出：简化的RPC方法函数
export const registerRPCMethod = (name: string, method: any): void => {
  console.log(`[Toolbar RPC] Method registration not implemented: ${name}`);
};

export const callRPCMethod = async (
  methodName: string, 
  request: any, 
  sessionId: string,
  sendUpdateCallback?: (update: any) => void
): Promise<any> => {
  throw new Error(`RPC method calling not implemented: ${methodName}`);
};

export const getSessionInfo = async (request: any): Promise<any> => {
  return {
    sessionId: request.sessionId || 'unknown',
    timestamp: new Date().toISOString(),
    status: 'active',
    service: 'standalone-toolbar-service'
  };
};

export const triggerAgentPrompt = async (request: any): Promise<any> => {
  return {
    sessionId: request.sessionId || 'unknown',
    result: {
      success: false,
      error: 'Direct RPC method calling not supported, use ToolbarRPCHandler instead'
    }
  };
};

export const defaultRPCMethods = {
  getSessionInfo,
  triggerAgentPrompt
}; 