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
  private connections: Map<string, NodeWebSocket> = new Map();
  private methods: RpcMethods = {};

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server });

    this.wss.on('connection', (ws: NodeWebSocket) => {
      const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      console.log(`[SRPC] WebSocket client connected: ${connectionId}`);
      
      // 添加连接到连接池
      this.connections.set(connectionId, ws);
      this.setupWebSocketHandlers(ws, connectionId);

      ws.on('close', () => {
        console.log(`[SRPC] WebSocket client disconnected: ${connectionId}`);
        this.connections.delete(connectionId);
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
  private setupWebSocketHandlers(ws: NodeWebSocket, connectionId: string): void {
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        console.log(`[SRPC] Received message from ${connectionId}:`, message);
        this.handleMessage(message, ws, connectionId);
      } catch (error) {
        console.error(`[SRPC] Error handling WebSocket message from ${connectionId}:`, error);
      }
    });

    ws.on('error', (error) => {
      console.error(`[SRPC] WebSocket error for ${connectionId}:`, error);
    });
  }

  /**
   * 处理传入的WebSocket消息
   */
  private handleMessage(message: WebSocketMessage, ws: NodeWebSocket, connectionId: string): void {
    const { messageType } = message;

    switch (messageType) {
      case 'request':
        this.handleRequest(message as RequestMessage, ws, connectionId);
        break;
      case 'response':
        console.log(`[SRPC] Received response from ${connectionId}:`, message);
        break;
      case 'update':
        console.log(`[SRPC] Received update from ${connectionId}:`, message);
        break;
      case 'error':
        console.error(`[SRPC] Received error from ${connectionId}:`, message);
        break;
      default:
        console.warn(`[SRPC] Unknown message type from ${connectionId}: ${messageType}`);
    }
  }

  /**
   * 处理传入的请求
   */
  private async handleRequest(message: RequestMessage, ws: NodeWebSocket, connectionId: string): Promise<void> {
    const { id, method, payload } = message;

    if (!method) {
      this.sendError(id, 'Method name is required', ws, connectionId);
      return;
    }

    const methodDef = this.methods[method];
    if (!methodDef) {
      this.sendError(id, `Method not found: ${method}`, ws, connectionId);
      return;
    }

    try {
      console.log(`[SRPC] Calling method: ${method} with payload from ${connectionId}:`, payload);
      
      // 创建发送更新的函数
      const sendUpdate = (update: any) => {
        this.sendUpdate(id, method, update, ws, connectionId);
      };

      // 调用处理器
      const result = await methodDef.handler(payload, sendUpdate);

      // 发送最终结果
      this.sendResponse(id, method, result, ws, connectionId);
    } catch (error) {
      this.sendError(
        id,
        error instanceof Error ? error.message : String(error),
        ws,
        connectionId
      );
    }
  }

  /**
   * 发送响应消息
   */
  private sendResponse(id: string, method: string, payload: any, ws: NodeWebSocket, connectionId: string): void {
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new Error(`WebSocket connection ${connectionId} is not open`);
    }

    const responseMessage: ResponseMessage = {
      id,
      messageType: 'response',
      method,
      payload,
    };

    console.log(`[SRPC] Sending response to ${connectionId}:`, responseMessage);
    ws.send(JSON.stringify(responseMessage));
  }

  /**
   * 发送更新消息
   */
  private sendUpdate(id: string, method: string, payload: any, ws: NodeWebSocket, connectionId: string): void {
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new Error(`WebSocket connection ${connectionId} is not open`);
    }

    const updateMessage: UpdateMessage = {
      id,
      messageType: 'update',
      method,
      payload,
    };

    console.log(`[SRPC] Sending update to ${connectionId}:`, updateMessage);
    ws.send(JSON.stringify(updateMessage));
  }

  /**
   * 发送错误消息
   */
  private sendError(id: string, errorMessage: string, ws: NodeWebSocket, connectionId: string): void {
    if (!ws || ws.readyState !== ws.OPEN) {
      throw new Error(`WebSocket connection ${connectionId} is not open`);
    }

    const errorResponse: ErrorMessage = {
      id,
      messageType: 'error',
      error: {
        message: errorMessage,
      },
    };

    console.log(`[SRPC] Sending error to ${connectionId}:`, errorResponse);
    ws.send(JSON.stringify(errorResponse));
  }

  /**
   * 获取连接状态
   */
  public isConnected(): boolean {
    return this.connections.size > 0;
  }

  /**
   * 获取连接数量
   */
  public getConnectionCount(): number {
    return this.connections.size;
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
    
    // 关闭所有连接
    this.connections.forEach((ws, connectionId) => {
      console.log(`[SRPC] Closing connection: ${connectionId}`);
      ws.close();
    });
    this.connections.clear();
  }
}

// 工厂函数，创建 SRPC WebSocket 桥接器实例
export function createSRPCBridge(server: Server): SRPCWebSocketBridge {
  return new SRPCWebSocketBridge(server);
} 