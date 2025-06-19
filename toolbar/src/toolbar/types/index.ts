// Standalone Toolbar Service - 类型定义

// 重新导出 SRPC 相关类型
export type {
    BaseWebSocketMessage, ErrorMessage, RequestMessage,
    ResponseMessage, RpcMethodDefinition, RpcMethodHandler, RpcMethods, UpdateMessage, WebSocketMessage, WebSocketMessageType
} from '../bridge/srpc-websocket-bridge.js';

// Toolbar 会话信息类型
export interface ToolbarSessionInfo {
  sessionId: string;
  appName: string;
  displayName: string;
  port: string | number;
  version: string;
  features: string[];
}

// RPC 更新消息类型
export interface RPCUpdateMessage {
  sessionId: string;
  updateText: string;
  status: 'processing' | 'completed' | 'error' | 'forwarding' | 'forwarded';
  result?: any;
}

// Toolbar 配置类型
export interface ToolbarConfig {
  enabled: boolean;
  port?: number;
  portRange?: {
    start: number;
    end: number;
  };
  logging?: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

// Toolbar 状态类型
export interface ToolbarStatus {
  connected: boolean;
  clientCount: number;
  registeredMethods: string[];
  lastActivity?: Date;
  uptime: number;
}

// Toolbar 事件类型
export type ToolbarEventType = 
  | 'client_connected'
  | 'client_disconnected'
  | 'method_called'
  | 'prompt_processed'
  | 'error_occurred';

export interface ToolbarEvent {
  type: ToolbarEventType;
  timestamp: Date;
  data?: any;
  sessionId?: string;
  methodName?: string;
  error?: string;
}

// WebSocket 客户端连接类型
export interface WebSocketClient {
  id: string;
  ws: any;
  connected: boolean;
  lastActivity: Date;
}

// Prompt 广播数据类型
export interface PromptBroadcastData {
  prompt: string;
  sessionId: string;
  model?: string;
  files?: any[];
  images?: any[];
  mode?: string;
  metadata?: any;
  timestamp: number;
} 