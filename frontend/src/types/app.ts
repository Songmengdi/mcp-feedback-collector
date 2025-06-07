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
