/**
 * 数据库相关类型定义
 */

// 场景类型定义
export interface Scene {
  id: string;
  name: string;
  description: string;
  icon?: string;
  is_default: boolean;
  sort_order: number;
  created_at: number;
  updated_at: number;
}

// 场景模式类型定义
export interface SceneMode {
  id: string;
  scene_id: string;
  name: string;
  description: string;
  shortcut?: string;
  is_default: boolean;
  sort_order: number;
  default_feedback?: string;
  created_at: number;
  updated_at: number;
}

// 场景提示词类型定义
export interface ScenePrompt {
  scene_id: string;
  mode_id: string;
  prompt: string;
  created_at: number;
  updated_at: number;
}

// 清理提示词基础类型
export interface ClearPrompt {
  prompt_text: string;
}

// 清理提示词记录类型
export interface ClearPromptRecord {
  id: string;
  user_id: string;
  prompt_text: string;
  is_default: boolean;
  created_at: number;
  updated_at: number;
} 