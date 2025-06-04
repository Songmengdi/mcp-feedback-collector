/**
 * MCP Feedback Collector - 类型定义
 */
export interface Config {
    webPort: number;
    dialogTimeout: number;
    corsOrigin: string;
    maxFileSize: number;
    logLevel: string;
    serverHost?: string | undefined;
    serverBaseUrl?: string | undefined;
    forcePort?: boolean | undefined;
    killProcessOnPortConflict?: boolean | undefined;
    useFixedUrl?: boolean | undefined;
    cleanupPortOnStart?: boolean | undefined;
}
export interface FeedbackData {
    text?: string;
    images?: ImageData[];
    timestamp: number;
    sessionId: string;
}
export interface ImageData {
    name: string;
    data: string;
    size: number;
    type: string;
}
export interface WorkSummary {
    content: string;
    timestamp: number;
    sessionId: string;
}
export interface CollectFeedbackParams {
    work_summary: string;
}
export interface TextContent {
    type: 'text';
    text: string;
}
export interface ImageContent {
    type: 'image';
    data: string;
    mimeType: string;
}
export interface AudioContent {
    type: 'audio';
    data: string;
    mimeType: string;
}
export type MCPContent = TextContent | ImageContent | AudioContent;
export interface CollectFeedbackResult {
    [x: string]: unknown;
    content: MCPContent[];
    isError?: boolean;
}
export interface SocketEvents {
    connect: () => void;
    disconnect: () => void;
    start_feedback_session: (data: {
        sessionId: string;
        workSummary: string;
    }) => void;
    get_work_summary: (data: {
        feedback_session_id: string;
    }) => void;
    submit_feedback: (data: FeedbackData) => void;
    feedback_submitted: (data: {
        success: boolean;
        message?: string;
    }) => void;
    feedback_error: (data: {
        error: string;
    }) => void;
    work_summary_data: (data: {
        work_summary: string;
    }) => void;
}
export interface ServerStatus {
    running: boolean;
    port: number;
    startTime: number;
    activeSessions: number;
}
export interface Session {
    id: string;
    workSummary?: string;
    feedback?: FeedbackData[];
    startTime: number;
    timeout: number;
    status: 'active' | 'completed' | 'timeout' | 'error';
}
export declare class MCPError extends Error {
    code: string;
    details?: unknown | undefined;
    constructor(message: string, code: string, details?: unknown | undefined);
}
export interface PortInfo {
    port: number;
    available: boolean;
    pid?: number | undefined;
}
export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'silent';
export interface APIConfig {
    apiKey?: string;
    apiBaseUrl: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
}
//# sourceMappingURL=index.d.ts.map