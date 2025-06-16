import { io, Socket } from 'socket.io-client'
import { useAppStore } from '../stores/app'
import { useConnectionStore } from '../stores/connection'
import { useFeedbackStore } from '../stores/feedback'

class SocketService {
  private socket: Socket | null = null
  private connectionStore: any = null
  private feedbackStore: any = null
  private appStore: any = null

  // 初始化Socket连接
  public initializeSocket(): void {
    console.log('初始化Socket.IO连接...')
    
    // 解析URL参数获取mcpSessionId
    const urlParams = new URLSearchParams(window.location.search)
    const mcpSessionId = urlParams.get('mcpSessionId')
    
    console.log('从URL获取mcpSessionId:', mcpSessionId)
    
    // 在Vue应用启动后初始化stores
    this.connectionStore = useConnectionStore()
    this.feedbackStore = useFeedbackStore()
    this.appStore = useAppStore()

    // 创建Socket连接配置
    const socketConfig: any = {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    }
    
    // 如果有mcpSessionId，添加到query参数中
    if (mcpSessionId) {
      socketConfig.query = { mcpSessionId }
      console.log('Socket连接将携带mcpSessionId:', mcpSessionId)
    }

    this.socket = io(socketConfig)

    this.setupEventListeners()
    this.connectionStore.setSocket(this.socket)
  }

  // 设置事件监听器
  private setupEventListeners(): void {
    if (!this.socket) return

    // 连接成功
    this.socket.on('connect', () => {
      this.connectionStore.setConnectionStatus(true, '已连接')
      console.log('WebSocket连接成功, ID:', this.socket?.id)
      
      // 连接成功后立即请求会话分配和最新汇报
      setTimeout(() => {
        this.requestSession()
        this.requestLatestSummary()
      }, 100) // 短暂延迟确保连接完全建立
    })

    // 连接断开
    this.socket.on('disconnect', (reason: string) => {
      this.connectionStore.setConnectionStatus(false, '连接断开')
      console.log('WebSocket连接断开, 原因:', reason)
    })

    // 连接错误
    this.socket.on('connect_error', (error: Error) => {
      this.connectionStore.setConnectionStatus(false, '连接失败')
      console.error('WebSocket连接错误:', error)
    })

    // 反馈会话开始
    this.socket.on('feedback_session_started', (data: any) => {
      console.log('反馈会话已开始:', data)
    })

    // 反馈提交成功
    this.socket.on('feedback_submitted', (data: any) => {
      this.feedbackStore.clearFeedbackForm()
      console.log('反馈提交成功:', data)
      this.showFeedbackSuccessWithCountdown()
    })

    // 反馈错误
    this.socket.on('feedback_error', (data: any) => {
      console.error('反馈错误:', data.error)
    })

    // 工作汇报数据
    this.socket.on('work_summary_data', (data: any) => {
      console.log('收到工作汇报数据:', data)
      if (data.work_summary) {
        this.feedbackStore.setWorkSummary(data.work_summary)
        this.appStore.setLastWorkSummary(data.work_summary)
        this.appStore.setCurrentTab('feedback')
      }
    })

    // 会话分配
    this.socket.on('session_assigned', (data: any) => {
      console.log('收到会话分配:', data)
      if (data.session_id) {
        this.feedbackStore.setCurrentFeedbackSession(data.session_id)
        console.log('固定URL模式 - 分配的会话ID:', data.session_id)
      }
    })

    // 最新汇报数据
    this.socket.on('latest_summary_data', (data: any) => {
      console.log('收到最新汇报数据:', data)
      if (data.work_summary) {
        this.feedbackStore.setWorkSummary(data.work_summary)
        this.appStore.setLastWorkSummary(data.work_summary)
      }
    })

    // 工作汇报广播（实时推送）
    this.socket.on('work_summary_broadcast', (data: any) => {
      console.log('收到工作汇报广播:', data)
      if (data.work_summary) {
        this.feedbackStore.setWorkSummary(data.work_summary)
        this.appStore.setLastWorkSummary(data.work_summary)
        
        // 如果有会话ID，也更新当前会话
        if (data.session_id) {
          this.feedbackStore.setCurrentFeedbackSession(data.session_id)
          console.log('通过广播更新会话ID:', data.session_id)
        }
        
        // 切换到反馈标签页
        this.appStore.setCurrentTab('feedback')
      }
    })

    // 最新汇报响应
    this.socket.on('latest_summary_response', (data: any) => {
      console.log('收到最新汇报响应:', data)
      if (data.success && data.work_summary) {
        this.feedbackStore.setWorkSummary(data.work_summary)
        this.appStore.setLastWorkSummary(data.work_summary)
        
        if (data.session_id) {
          this.feedbackStore.setCurrentFeedbackSession(data.session_id)
        }
      } else if (!data.success) {
        console.log('获取最新汇报失败:', data.message)
      }
    })

    // 接收来自Toolbar的prompt
    this.socket.on('prompt_received', (data: any) => {
      console.log('收到来自Toolbar的prompt:', data)
      
      if (data.prompt) {
        // 显示prompt通知
        this.showPromptNotification(data)
        
        // 将prompt存储到应用状态中
        this.appStore.setReceivedPrompt({
          sessionId: data.sessionId,
          prompt: data.prompt,
          model: data.model,
          files: data.files,
          images: data.images,
          mode: data.mode,
          metadata: data.metadata,
          timestamp: data.timestamp || Date.now()
        })
        
        // 如果有会话ID，更新当前会话
        if (data.sessionId) {
          this.feedbackStore.setCurrentFeedbackSession(data.sessionId)
        }
        
        // 切换到prompt显示标签页（如果存在）
        this.appStore.setCurrentTab('prompt')
      }
    })
  }

  // 发送事件
  public emit(event: string, data?: any): void {
    if (this.socket && this.connectionStore && this.connectionStore.isConnected) {
      this.socket.emit(event, data)
    } else {
      console.warn('Socket未连接，无法发送事件:', event)
    }
  }

  // 获取工作汇报
  public getWorkSummary(sessionId: string): void {
    this.emit('get_work_summary', { feedback_session_id: sessionId })
  }

  // 请求会话分配
  public requestSession(): void {
    this.emit('request_session')
  }

  // 请求最新汇报
  public requestLatestSummary(): void {
    this.emit('request_latest_summary')
  }

  // 提交反馈
  public submitFeedback(feedbackData: any): void {
    this.emit('submit_feedback', feedbackData)
  }

  // 断开连接
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }

  // 获取Socket实例
  public getSocket(): Socket | null {
    return this.socket
  }

  // 显示prompt接收通知
  private showPromptNotification(data: any): void {
    // 通过事件系统通知主应用显示prompt通知
    const event = new CustomEvent('showPromptNotification', {
      detail: {
        prompt: data.prompt,
        sessionId: data.sessionId,
        source: data.metadata?.source || 'toolbar',
        timestamp: data.timestamp
      }
    })
    window.dispatchEvent(event)
  }

  // 显示反馈提交成功消息并开始倒计时关闭页面
  private showFeedbackSuccessWithCountdown(): void {
    let countdown = 3
    
    // 通过事件系统通知主应用显示倒计时消息
    const event = new CustomEvent('showFeedbackSuccess', {
      detail: { countdown }
    })
    window.dispatchEvent(event)
    
    // 开始倒计时
    const countdownTimer = setInterval(() => {
      countdown--
      
      if (countdown > 0) {
        // 发送更新倒计时的事件
        const updateEvent = new CustomEvent('updateFeedbackCountdown', {
          detail: { countdown }
        })
        window.dispatchEvent(updateEvent)
      } else {
        // 倒计时结束，关闭页面
        clearInterval(countdownTimer)
        
        // 发送关闭页面的事件
        const closeEvent = new CustomEvent('closeFeedbackPage')
        window.dispatchEvent(closeEvent)
        
        // 延迟500ms后关闭页面，让用户看到最终消息
        setTimeout(() => {
          window.close()
        }, 500)
      }
    }, 1000)
  }
}

// 创建单例实例
export const socketService = new SocketService()
export default socketService
