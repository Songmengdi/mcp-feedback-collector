/**
 * MCP Feedback Collector - 类型定义
 */

// 基础配置类型
export interface Config {
  webPort: number;
  dialogTimeout: number;
  corsOrigin: string;
  maxFileSize: number;
  logLevel: string;
  // 新增：服务器主机配置
  serverHost?: string | undefined;
  serverBaseUrl?: string | undefined;
  // 新增：URL和端口优化配置
  forcePort?: boolean | undefined;           // 强制使用指定端口
  killProcessOnPortConflict?: boolean | undefined;  // 自动终止占用进程
  useFixedUrl?: boolean | undefined;         // 使用固定URL，不带会话参数
  cleanupPortOnStart?: boolean | undefined;  // 启动时清理端口
  // 新增：MCP传输模式配置
  transportMode?: TransportMode | undefined;  // MCP传输模式
  mcpPort?: number | undefined;              // MCP HTTP服务器端口
  enableSSEFallback?: boolean | undefined;   // 启用SSE向后兼容
}

// 反馈数据类型
export interface FeedbackData {
  text?: string;
  images?: ImageData[];
  timestamp: number;
  sessionId: string;
}

// 图片数据类型
export interface ImageData {
  name: string;
  data: string; // Base64编码
  size: number;
  type: string;
}

// 工作汇报类型
export interface WorkSummary {
  content: string;
  timestamp: number;
  sessionId: string;
}

// MCP工具函数参数类型
export interface CollectFeedbackParams {
  work_summary: string;
}

// MCP内容类型 - 符合MCP协议标准
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  data: string; // base64编码的图片数据
  mimeType: string; // 图片MIME类型
}

export interface AudioContent {
  type: 'audio';
  data: string; // base64编码的音频数据
  mimeType: string; // 音频MIME类型
}

// MCP内容联合类型
export type MCPContent = TextContent | ImageContent | AudioContent;

// MCP工具函数返回类型 - 符合MCP协议要求
export interface CollectFeedbackResult {
  [x: string]: unknown;
  content: MCPContent[];
  isError?: boolean;
}

// WebSocket事件类型
export interface SocketEvents {
  // 连接管理
  connect: () => void;
  disconnect: () => void;
  
  // 反馈收集
  start_feedback_session: (data: { sessionId: string; workSummary: string }) => void;
  get_work_summary: (data: { feedback_session_id: string }) => void;
  submit_feedback: (data: FeedbackData) => void;
  feedback_submitted: (data: { success: boolean; message?: string }) => void;
  feedback_error: (data: { error: string }) => void;
  work_summary_data: (data: { work_summary: string }) => void;
}

// 服务器状态类型
export interface ServerStatus {
  running: boolean;
  port: number;
  startTime: number;
  activeSessions: number;
}

// 会话管理类型
export interface Session {
  id: string;
  workSummary?: string;
  feedback?: FeedbackData[];
  startTime: number;
  timeout: number;
  status: 'active' | 'completed' | 'timeout' | 'error';
}

// 错误类型
export class MCPError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

// 端口管理类型
export interface PortInfo {
  port: number;
  available: boolean;
  pid?: number | undefined;
}

// 日志级别类型
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silent';

// API配置类型
export interface APIConfig {
  apiKey?: string;
  apiBaseUrl: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// MCP传输模式枚举
export enum TransportMode {
  STDIO = 'stdio',                    // 标准输入输出
  STREAMABLE_HTTP = 'streamable_http', // StreamableHTTP（默认，推荐）
  SSE = 'sse'                         // Server-Sent Events（向后兼容）
}
