// Toolbar 模块索引文件

// 导出 SRPC WebSocket 桥接器
export { createSRPCBridge, SRPCWebSocketBridge } from './bridge/srpc-websocket-bridge.js';

// 导出 RPC 处理器
export { callRPCMethod, defaultRPCMethods, getSessionInfo, registerRPCMethod, ToolbarRPCHandler, triggerAgentPrompt } from './handlers/rpc-handler.js';

// 导出 AI Agent
export {
    aiAgent, mcpAIAgent, MCPFeedbackAIAgent
} from './handlers/ai-agent.js';

// 导出所有类型
export type * from './types/index.js';
