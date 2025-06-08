// Toolbar 相关类型定义

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

// AI Agent 请求类型
export interface PromptRequest {
  sessionId: string;
  prompt: string;
  model?: string;
  files?: string[];
  images?: string[];
  mode?: 'agent' | 'chat' | 'completion';
}

// AI Agent 响应类型
export interface PromptResponse {
  sessionId: string;
  result: {
    success: boolean;
    output?: string;
    error?: string;
    metadata?: {
      model: string;
      mode: string;
      processedAt: string;
      service: string;
      version?: string;
    };
  };
}

// RPC 更新消息类型
export interface RPCUpdateMessage {
  sessionId: string;
  updateText: string;
  status: 'processing' | 'ai_processing' | 'completed' | 'error' | 'calling_agent';
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
  aiAgent?: {
    enabled: boolean;
    defaultModel?: string;
    timeout?: number;
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