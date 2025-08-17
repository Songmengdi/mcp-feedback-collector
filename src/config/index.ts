/**
 * MCP Feedback Collector - 配置管理
 */

import { config as dotenvConfig } from 'dotenv';
import { Config, MCPError, TransportMode } from '../types/index.js';

// 加载环境变量
dotenvConfig();

/**
 * 获取环境变量值，支持默认值
 */
function getEnvVar(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * 获取可选的环境变量值
 */
function getOptionalEnvVar(key: string): string | undefined {
  return process.env[key] || undefined;
}

/**
 * 获取数字类型的环境变量
 */
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    console.warn(`Invalid number for ${key}: ${value}, using default: ${defaultValue}`);
    return defaultValue;
  }

  return parsed;
}

/**
 * 获取布尔类型的环境变量
 */
function getEnvBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;

  return value.toLowerCase() === 'true';
}

/**
 * 创建默认配置
 */
export function createDefaultConfig(): Config {
  return {
    dialogTimeout: getEnvNumber('MCP_DIALOG_TIMEOUT', 60000),
    corsOrigin: getEnvVar('MCP_CORS_ORIGIN', '*'),
    maxFileSize: getEnvNumber('MCP_MAX_FILE_SIZE', 10485760), // 10MB
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
    // 服务器主机配置
    serverHost: getOptionalEnvVar('MCP_SERVER_HOST'),
    serverBaseUrl: getOptionalEnvVar('MCP_SERVER_BASE_URL'),
    // MCP传输模式配置
    transportMode: getEnvVar('MCP_TRANSPORT_MODE', TransportMode.STDIO) as TransportMode,
    mcpPort: getEnvNumber('MCP_HTTP_PORT', 3001)  // MCP HTTP服务器端口
  };
}

/**
 * 验证配置
 */
export function validateConfig(config: Config): void {
  // 验证MCP HTTP端口范围
  if (config.mcpPort && (config.mcpPort < 1024 || config.mcpPort > 65535)) {
    throw new MCPError(
      `Invalid MCP port number: ${config.mcpPort}. Must be between 1024 and 65535.`,
      'INVALID_MCP_PORT'
    );
  }

  // 验证超时时间 - 扩展支持到60000秒（约16.7小时）
  if (config.dialogTimeout < 10 || config.dialogTimeout > 60000) {
    throw new MCPError(
      `Invalid timeout: ${config.dialogTimeout}. Must be between 10 and 60000 seconds.`,
      'INVALID_TIMEOUT'
    );
  }

  // 验证文件大小限制
  if (config.maxFileSize < 1024 || config.maxFileSize > 104857600) { // 1KB - 100MB
    throw new MCPError(
      `Invalid max file size: ${config.maxFileSize}. Must be between 1KB and 100MB.`,
      'INVALID_FILE_SIZE'
    );
  }

  // 验证传输模式
  if (config.transportMode && !Object.values(TransportMode).includes(config.transportMode)) {
    throw new MCPError(
      `Invalid transport mode: ${config.transportMode}. Must be one of: ${Object.values(TransportMode).join(', ')}`,
      'INVALID_TRANSPORT_MODE'
    );
  }

  // 验证日志级别
  const validLogLevels = ['error', 'warn', 'info', 'debug'];
  if (!validLogLevels.includes(config.logLevel)) {
    throw new MCPError(
      `Invalid log level: ${config.logLevel}. Must be one of: ${validLogLevels.join(', ')}`,
      'INVALID_LOG_LEVEL'
    );
  }
}

/**
 * 获取验证后的配置
 */
export function getConfig(): Config {
  const config = createDefaultConfig();
  validateConfig(config);
  return config;
}

/**
 * 显示配置信息（隐藏敏感信息）
 * 注意：在 stdio 模式下，这些信息会发送到 stderr 而不是 stdout
 */
export function displayConfig(config: Config): void {
  // 使用 stderr 避免在 stdio 模式下污染 MCP 协议通信
  process.stderr.write('MCP Feedback Collector Configuration:\n');
  process.stderr.write(`Web Port: 动态分配\n`);
  process.stderr.write(`Dialog Timeout: ${config.dialogTimeout}s\n`);
  process.stderr.write(`CORS Origin: ${config.corsOrigin}\n`);
  process.stderr.write(`Max File Size: ${(config.maxFileSize / 1024 / 1024).toFixed(1)}MB\n`);
  process.stderr.write(`Log Level: ${config.logLevel}\n`);
  process.stderr.write(`Server Host: ${config.serverHost || '自动检测'}\n`);
  process.stderr.write(`Server Base URL: ${config.serverBaseUrl || '自动生成'}\n`);
  process.stderr.write(`Transport Mode: ${config.transportMode || TransportMode.STDIO}\n`);
  process.stderr.write(`MCP HTTP Port: ${config.mcpPort || 'N/A'}\n`);
}
