/**
 * 自定义提示词数据库管理器
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { logger } from './logger.js';
import { MCPError } from '../types/index.js';

export interface CustomPrompt {
  mode: string;
  prompt: string;
  created_at: number;
  updated_at: number;
}

export class PromptDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    this.dbPath = this.getStoragePath();
    this.ensureStorageDirectory();
    this.db = new Database(this.dbPath);
    this.initializeDatabase();
  }

  /**
   * 获取跨平台存储路径
   */
  private getStoragePath(): string {
    const platform = process.platform;
    let baseDir: string;

    switch (platform) {
      case 'darwin': // macOS
        baseDir = join(homedir(), '.mcp_feedback');
        break;
      case 'win32': // Windows
        baseDir = join(process.env['APPDATA'] || join(homedir(), 'AppData', 'Roaming'), 'mcp_feedback');
        break;
      default: // Linux and others
        baseDir = join(process.env['XDG_CONFIG_HOME'] || join(homedir(), '.config'), 'mcp_feedback');
        break;
    }

    return join(baseDir, 'prompts.db');
  }

  /**
   * 确保存储目录存在
   */
  private ensureStorageDirectory(): void {
    const dir = this.dbPath.substring(0, this.dbPath.lastIndexOf('/'));
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
      logger.info(`创建存储目录: ${dir}`);
    }
  }

  /**
   * 初始化数据库表
   */
  private initializeDatabase(): void {
    try {
      // 创建自定义提示词表
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS custom_prompts (
          mode TEXT PRIMARY KEY,
          prompt TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `);

      logger.info(`提示词数据库初始化完成: ${this.dbPath}`);
    } catch (error) {
      logger.error('提示词数据库初始化失败:', error);
      throw new MCPError(
        'Failed to initialize prompt database',
        'PROMPT_DATABASE_INIT_ERROR',
        error
      );
    }
  }

  /**
   * 获取指定模式的提示词
   */
  getPrompt(mode: string): CustomPrompt | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM custom_prompts WHERE mode = ?');
      const result = stmt.get(mode) as CustomPrompt | undefined;
      return result || null;
    } catch (error) {
      logger.error(`获取提示词失败 (mode: ${mode}):`, error);
      throw new MCPError(
        `Failed to get prompt for mode: ${mode}`,
        'PROMPT_GET_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 保存提示词
   */
  savePrompt(mode: string, prompt: string): void {
    try {
      const now = Date.now();
      const existing = this.getPrompt(mode);

      if (existing) {
        // 更新现有记录
        const stmt = this.db.prepare('UPDATE custom_prompts SET prompt = ?, updated_at = ? WHERE mode = ?');
        stmt.run(prompt, now, mode);
        logger.debug(`提示词已更新 (mode: ${mode})`);
      } else {
        // 插入新记录
        const stmt = this.db.prepare('INSERT INTO custom_prompts (mode, prompt, created_at, updated_at) VALUES (?, ?, ?, ?)');
        stmt.run(mode, prompt, now, now);
        logger.debug(`提示词已创建 (mode: ${mode})`);
      }
    } catch (error) {
      logger.error(`保存提示词失败 (mode: ${mode}):`, error);
      throw new MCPError(
        `Failed to save prompt for mode: ${mode}`,
        'PROMPT_SAVE_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 删除指定模式的提示词
   */
  deletePrompt(mode: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM custom_prompts WHERE mode = ?');
      const result = stmt.run(mode);
      const deleted = result.changes > 0;
      
      if (deleted) {
        logger.debug(`提示词已删除 (mode: ${mode})`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`删除提示词失败 (mode: ${mode}):`, error);
      throw new MCPError(
        `Failed to delete prompt for mode: ${mode}`,
        'PROMPT_DELETE_ERROR',
        { mode, error }
      );
    }
  }

  /**
   * 获取所有提示词
   */
  getAllPrompts(): CustomPrompt[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM custom_prompts ORDER BY mode');
      return stmt.all() as CustomPrompt[];
    } catch (error) {
      logger.error('获取所有提示词失败:', error);
      throw new MCPError(
        'Failed to get all prompts',
        'PROMPT_GET_ALL_ERROR',
        error
      );
    }
  }

  /**
   * 检查数据库是否为空
   */
  isEmpty(): boolean {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM custom_prompts');
      const result = stmt.get() as { count: number };
      return result.count === 0;
    } catch (error) {
      logger.error('检查数据库是否为空失败:', error);
      return true; // 出错时假设为空
    }
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    try {
      this.db.close();
      logger.debug('提示词数据库连接已关闭');
    } catch (error) {
      logger.error('关闭提示词数据库连接失败:', error);
    }
  }

  /**
   * 获取数据库路径
   */
  getDatabasePath(): string {
    return this.dbPath;
  }
} 