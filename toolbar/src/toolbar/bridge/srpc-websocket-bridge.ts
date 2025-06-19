import type { Server } from 'node:http';
import type { WebSocket as NodeWebSocket } from 'ws';
import { WebSocketServer } from 'ws';

// SRPC协议消息类型定义
export type WebSocketMessageType = 'request' | 'response' | 'update' | 'error';

export interface BaseWebSocketMessage {
  id: string;
  messageType: WebSocketMessageType;
  method?: string;
}

export interface RequestMessage<T = any> extends BaseWebSocketMessage {
  messageType: 'request';
  method: string;
  payload: T;
}

export interface ResponseMessage<T = any> extends BaseWebSocketMessage {
  messageType: 'response';
  method: string;
  payload: T;
}

export interface UpdateMessage<T = any> extends BaseWebSocketMessage {
  messageType: 'update';
  method: string;
  payload: T;
}

export interface ErrorMessage extends BaseWebSocketMessage {
  messageType: 'error';
  error: {
    message: string;
    code?: string;
  };
}

export type WebSocketMessage<T = any> =
  | RequestMessage<T>
  | ResponseMessage<T>
  | UpdateMessage<T>
  | ErrorMessage;

// RPC方法处理器类型
export type RpcMethodHandler<TRequest, TResponse, TUpdate> = (
  request: TRequest,
  sendUpdate: (update: TUpdate) => void,
) => Promise<TResponse>;

export interface RpcMethodDefinition<TRequest, TResponse, TUpdate> {
  handler: RpcMethodHandler<TRequest, TResponse, TUpdate>;
}

export type RpcMethods = Record<string, RpcMethodDefinition<any, any, any>>;

/**
 * SRPC兼容的WebSocket桥接器
 */
export class SRPCWebSocketBridge {
  private wss: WebSocketServer;
  private ws: NodeWebSocket | null = null;
  private methods: RpcMethods = {};

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: NodeWebSocket) => {
      console.log('[SRPC] WebSocket client connected');
      
      if (this.ws) {
        console.warn('[SRPC] New WebSocket connection attempted while one is already active. Closing existing connection first.');
        const oldWs = this.ws;
        this.ws = null;
        oldWs.close();
      }

      this.ws = ws;
      this.setupWebSocketHandlers(ws);

      ws.on('close', () => {
        console.log('[SRPC] WebSocket client disconnected');
        if (this.ws === ws) {
          this.ws = null;
        }
      });
    });
  }

  /**
   * 注册RPC方法处理器
   */
  public register<T extends Record<string, RpcMethodHandler<any, any, any>>>(
    methodHandlers: T,
  ): void {
    Object.entries(methodHandlers).forEach(([methodName, handler]) => {
      this.methods[methodName] = { handler };
      console.log(`[SRPC] Registered RPC method: ${methodName}`);
    });
  }

  /**
   * 设置WebSocket事件处理器
   */
  private setupWebSocketHandlers(ws: NodeWebSocket): void {
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        console.log('[SRPC] Received message:', message);
        this.handleMessage(message);
      } catch (error) {
        console.error('[SRPC] Error handling WebSocket message:', error);
      }
    });

    ws.on('error', (error) => {
      console.error('[SRPC] WebSocket error:', error);
    });
  }

  /**
   * 处理传入的WebSocket消息
   */
  private handleMessage(message: WebSocketMessage): void {
    const { messageType } = message;

    switch (messageType) {
      case 'request':
        this.handleRequest(message as RequestMessage);
        break;
      case 'response':
        console.log('[SRPC] Received response:', message);
        break;
      case 'update':
        console.log('[SRPC] Received update:', message);
        break;
      case 'error':
        console.error('[SRPC] Received error:', message);
        break;
      default:
        console.warn(`[SRPC] Unknown message type: ${messageType}`);
    }
  }

  /**
   * 处理传入的请求
   */
  private async handleRequest(message: RequestMessage): Promise<void> {
    const { id, method, payload } = message;

    if (!method) {
      this.sendError(id, 'Method name is required');
      return;
    }

    const methodDef = this.methods[method];
    if (!methodDef) {
      this.sendError(id, `Method not found: ${method}`);
      return;
    }

    try {
      console.log(`[SRPC] Calling method: ${method} with payload:`, payload);
      
      // 创建发送更新的函数
      const sendUpdate = (update: any) => {
        this.sendUpdate(id, method, update);
      };

      // 调用处理器
      const result = await methodDef.handler(payload, sendUpdate);

      // 发送最终结果
      this.sendResponse(id, method, result);
    } catch (error) {
      this.sendError(
        id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * 发送响应消息
   */
  private sendResponse(id: string, method: string, payload: any): void {
    if (!this.ws) {
      throw new Error('WebSocket is not connected');
    }

    const responseMessage: ResponseMessage = {
      id,
      messageType: 'response',
      method,
      payload,
    };

    console.log('[SRPC] Sending response:', responseMessage);
    this.ws.send(JSON.stringify(responseMessage));
  }

  /**
   * 发送更新消息
   */
  private sendUpdate(id: string, method: string, payload: any): void {
    if (!this.ws) {
      throw new Error('WebSocket is not connected');
    }

    const updateMessage: UpdateMessage = {
      id,
      messageType: 'update',
      method,
      payload,
    };

    console.log('[SRPC] Sending update:', updateMessage);
    this.ws.send(JSON.stringify(updateMessage));
  }

  /**
   * 发送错误消息
   */
  private sendError(id: string, errorMessage: string): void {
    if (!this.ws) {
      throw new Error('WebSocket is not connected');
    }

    const errorResponse: ErrorMessage = {
      id,
      messageType: 'error',
      error: {
        message: errorMessage,
      },
    };

    console.log('[SRPC] Sending error:', errorResponse);
    this.ws.send(JSON.stringify(errorResponse));
  }

  /**
   * 获取连接状态
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === this.ws.OPEN;
  }

  /**
   * 获取已注册的方法列表
   */
  public getRegisteredMethods(): string[] {
    return Object.keys(this.methods);
  }

  /**
   * 关闭WebSocket服务器
   */
  public close(): void {
    console.log('[SRPC] Closing WebSocket server');
    this.wss.close();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// 工厂函数，创建 SRPC WebSocket 桥接器实例
export function createSRPCBridge(server: Server): SRPCWebSocketBridge {
  return new SRPCWebSocketBridge(server);
} 