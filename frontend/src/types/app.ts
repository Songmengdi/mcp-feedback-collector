// 图片文件接口
export interface ImageFile {
  name: string
  data: string
  size: number
  type: string
  id?: string
  originalSize?: number
}

// 反馈数据接口
export interface FeedbackData {
  text: string
  images: ImageFile[]
  timestamp: number
  sessionId: string | null
}

// 工作汇报数据接口
export interface WorkSummaryData {
  work_summary: string
  session_id?: string
}

// 状态消息类型
export type MessageType = 'success' | 'error' | 'warning' | 'info'

// 标签页类型
export type TabType = 'report' | 'feedback'

// 快捷语模式类型
export type PhraseModeType = 'discuss' | 'edit' | 'search'

// ===== 新增场景化相关类型定义 =====

// 场景定义
export interface Scene {
  id: string
  name: string
  description: string
  icon?: string
  isDefault: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

// 场景模式定义
export interface SceneMode {
  id: string
  sceneId: string
  name: string
  description: string
  shortcut?: string
  isDefault: boolean
  sortOrder: number
  defaultFeedback?: string
  createdAt: number
  updatedAt: number
}

// 场景配置
export interface SceneConfig {
  scene: Scene
  modes: SceneMode[]
  prompts: Record<string, string> // modeId -> prompt
}

// 当前选择状态
export interface CurrentSelection {
  sceneId: string
  modeId: string
}

// 场景列表响应
export interface ScenesResponse {
  success: boolean
  data: {
    scenes: Scene[]
    total: number
    defaultSceneId: string
  }
  message?: string
  error?: string
}

// 场景配置响应
export interface SceneConfigResponse {
  success: boolean
  data: {
    scene: Scene
    modes: SceneMode[]
    prompts: Record<string, string>
  }
  message?: string
  error?: string
}

// 场景配置导出响应（直接返回导出数据，不是标准API格式）
export interface SceneConfigExportResponse {
  version: string
  exported_at: string
  config: SceneConfigExport
}

// 场景模式响应
export interface SceneModesResponse {
  success: boolean
  data: {
    modes: SceneMode[]
    total: number
  }
  message?: string
  error?: string
}

// 场景创建/更新请求
export interface SceneRequest {
  name: string
  description: string
  icon?: string
  isDefault?: boolean
  sortOrder?: number
}

// 场景模式创建/更新请求
export interface SceneModeRequest {
  name: string
  description: string
  shortcut?: string
  isDefault?: boolean
  sortOrder?: number
  defaultFeedback?: string
}

// 配置导出/导入数据结构
export interface SceneConfigExport {
  version: string
  exportedAt: number
  scenes: Scene[]
  modes: SceneMode[]
  prompts: Array<{
    sceneId: string
    modeId: string
    prompt: string
  }>
}
