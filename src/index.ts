/**
 * MCP Feedback Collector - 主入口文件
 */

// 导出主要类和函数
export { createDefaultConfig, getConfig, validateConfig } from './config/index.js';
export { MCPServer } from './server/mcp-server.js';
export { ServerCoordinator } from './server/server-coordinator.js';
export { logger } from './utils/logger.js';

// 导出类型定义
export * from './types/index.js';

// 导出版本信息
export const VERSION = '2.0.9';
