// Standalone Toolbar Service - 模块索引文件

// 导出 SRPC WebSocket 桥接器
export { createSRPCBridge, SRPCWebSocketBridge } from './bridge/srpc-websocket-bridge.js';

// 导出 RPC 处理器
export { callRPCMethod, defaultRPCMethods, getSessionInfo, registerRPCMethod, ToolbarRPCHandler, triggerAgentPrompt } from './handlers/rpc-handler.js';

// 导出所有类型
export type * from './types/index.js'; 