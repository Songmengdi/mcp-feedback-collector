/**
 * JSON存储相关类型定义
 */

// 不再从prompt-database导入，避免循环依赖

// 完全兼容的Scene类型，保持与原始类型一致
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

// 完全兼容的SceneMode类型，保持与原始类型一致
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

// 定义其他相关类型
export interface ScenePrompt {
  scene_id: string;
  mode_id: string;
  prompt: string;
  created_at: number;
  updated_at: number;
}

export interface ClearPrompt {
  prompt_text: string;
}

// JSON存储专用类型
export interface ClearPromptRecord {
  id: string;
  user_id: string;
  prompt_text: string;
  is_default: boolean;
  created_at: number;
  updated_at: number;
}

export interface JsonStorageMetadata {
  created_at: number;
  updated_at: number;
  backup_count?: number;
}

export interface JsonStorageDataSection {
  scenes: Scene[];
  scene_modes: SceneMode[];
  scene_prompts: ScenePrompt[];
  clear_prompts: ClearPromptRecord[];
}

export interface JsonStorageData {
  version: number;
  metadata: JsonStorageMetadata;
  data: JsonStorageDataSection;
} 