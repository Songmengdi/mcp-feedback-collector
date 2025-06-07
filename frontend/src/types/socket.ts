// Socket事件接口
export interface SocketEvents {
  // 客户端发送的事件
  get_work_summary: (data: { feedback_session_id: string }) => void
  request_session: () => void
  request_latest_summary: () => void
  submit_feedback: (data: any) => void
  
  // 服务端发送的事件
  connect: () => void
  disconnect: (reason: string) => void
  connect_error: (error: Error) => void
  feedback_session_started: (data: any) => void
  feedback_submitted: (data: any) => void
  feedback_error: (data: { error: string }) => void
  work_summary_data: (data: { work_summary: string }) => void
  session_assigned: (data: { session_id: string }) => void
  latest_summary_data: (data: { work_summary: string }) => void
}

// Socket连接配置
export interface SocketConfig {
  transports: string[]
  timeout: number
  reconnection: boolean
  reconnectionAttempts: number
  reconnectionDelay: number
}
