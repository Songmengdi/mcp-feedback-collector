/**
 * MCP Feedback Collector - 传输模式检测工具
 * 统一处理传输模式的检测和验证逻辑
 */

import { TransportMode } from '../types/index.js';
import { logger } from './logger.js';

/**
 * 检测传输模式
 * 优先级：CLI参数 > 环境变量 > 默认值(stdio)
 */
export function detectTransportMode(cliMode?: string): TransportMode {
  // 1. 优先使用CLI参数
  if (cliMode) {
    if (cliMode === 'stdio') {
      logger.debug('使用CLI参数指定的传输模式: stdio');
      return TransportMode.STDIO;
    }
    if (cliMode === 'mcp') {
      logger.debug('使用CLI参数指定的传输模式: mcp');
      return TransportMode.MCP;
    }
    throw new Error(`Invalid transport mode: ${cliMode}. Must be 'stdio' or 'mcp'.`);
  }
  
  // 2. 其次使用环境变量
  const envMode = process.env['MCP_TRANSPORT_MODE'];
  if (envMode) {
    if (envMode === 'stdio') {
      logger.debug('使用环境变量指定的传输模式: stdio');
      return TransportMode.STDIO;
    }
    if (envMode === 'mcp') {
      logger.debug('使用环境变量指定的传输模式: mcp');
      return TransportMode.MCP;
    }
    // 兼容性处理：将原来的 streamable_http 转换为 mcp
    if (envMode === 'streamable_http') {
      logger.debug('检测到环境变量 streamable_http，自动转换为 mcp 模式');
      return TransportMode.MCP;
    }
    logger.warn(`Invalid MCP_TRANSPORT_MODE: ${envMode}, using default: stdio`);
  }
  
  // 3. 最后使用默认值
  logger.debug('使用默认传输模式: stdio');
  return TransportMode.STDIO;
}

/**
 * 判断是否为MCP模式（非stdio模式）
 */
export function isMCPMode(mode: TransportMode): boolean {
  return mode !== TransportMode.STDIO;
}

/**
 * 判断是否为stdio模式
 */
export function isStdioMode(mode: TransportMode): boolean {
  return mode === TransportMode.STDIO;
}

/**
 * 获取传输模式的显示名称
 */
export function getTransportModeDisplayName(mode: TransportMode): string {
  switch (mode) {
    case TransportMode.STDIO:
      return 'Standard I/O';
    case TransportMode.MCP:
      return 'MCP HTTP';
    default:
      return 'Unknown';
  }
}

/**
 * 验证传输模式是否有效
 */
export function validateTransportMode(mode: string): boolean {
  return Object.values(TransportMode).includes(mode as TransportMode);
}

/**
 * 检测完整的MCP模式状态
 * 结合传输模式和其他环境因素
 */
export function detectMCPModeStatus(cliMode?: string): {
  transportMode: TransportMode;
  isMCP: boolean;
  isStdio: boolean;
  shouldDisableColors: boolean;
  logLevel: string;
} {
  const transportMode = detectTransportMode(cliMode);
  const isMCP = isMCPMode(transportMode);
  const isStdio = isStdioMode(transportMode);
  
  // 检查其他MCP模式指示器
  const hasNodeEnvMCP = process.env['NODE_ENV'] === 'mcp';
  const hasForceInteractive = process.env['FORCE_INTERACTIVE'];
  const isNonTTY = !process.stdin.isTTY;
  
  // 确定是否应该禁用颜色
  // stdio模式下始终禁用颜色，mcp模式根据环境决定
  const shouldDisableColors = isStdio || ((isMCP || hasNodeEnvMCP) && !hasForceInteractive);
  
  // 确定日志级别
  let logLevel: string;
  if (isStdio) {
    // stdio模式下使用info级别
    logLevel = 'info';
  } else if ((isMCP || hasNodeEnvMCP) && isNonTTY && !hasForceInteractive) {
    // mcp模式且非TTY环境下使用silent级别
    logLevel = 'silent';
  } else {
    // 其他情况使用默认级别（将在配置中设置）
    logLevel = 'default';
  }
  
  return {
    transportMode,
    isMCP,
    isStdio,
    shouldDisableColors,
    logLevel
  };
} 