import { defineStore } from 'pinia'
import { ref } from 'vue'
// Scene相关类型已移至scenesStore使用

// 确认对话框选项接口
interface ConfirmOptions {
  title?: string
  message: string
  type?: 'info' | 'warning' | 'danger'
  confirmText?: string
  cancelText?: string
}

export const useAppStore = defineStore('app', () => {
  // 当前标签页
  const currentTab = ref<string>('report')
  
  // ===== 场景化状态管理已移至scenesStore =====
  
  // ===== 确认对话框状态管理 =====
  
  // 确认对话框引用
  const confirmDialogRef = ref<any>(null)
  
  // 设置确认对话框引用
  const setConfirmDialogRef = (ref: any) => {
    confirmDialogRef.value = ref
  }
  
  // 显示确认对话框
  const showConfirm = async (options: ConfirmOptions): Promise<boolean> => {
    if (!confirmDialogRef.value) {
      console.error('确认对话框组件未初始化')
      return false
    }
    return await confirmDialogRef.value.show(options)
  }
  
  // ===== 向后兼容代码已移除 =====
  
  // ===== 其他状态保持不变 =====
  
  // 自动刷新相关状态
  const autoRefreshInterval = ref<number | null>(null)
  const autoRefreshCountdown = ref<number>(10)
  const autoRefreshTimer = ref<number | null>(null)
  const lastWorkSummary = ref<string | null>(null)
  
  // 接收到的prompt状态
  const receivedPrompt = ref<{
    sessionId: string;
    prompt: string;
    model?: string;
    files?: any[];
    images?: any[];
    mode?: string;
    metadata?: any;
    timestamp: number;
  } | null>(null)
  

  
  // ===== 基础方法 =====
  
  // 切换标签页
  const setCurrentTab = (tab: string) => {
    currentTab.value = tab
  }
  
  // ===== 场景化管理方法已移至scenesStore =====
  
  // ===== 向后兼容方法已移除 =====
  
  // ===== 其他方法保持不变 =====
  
  // 设置自动刷新倒计时
  const setAutoRefreshCountdown = (countdown: number) => {
    autoRefreshCountdown.value = countdown
  }
  
  // 设置最后的工作汇报
  const setLastWorkSummary = (summary: string | null) => {
    lastWorkSummary.value = summary
  }
  
  // 设置接收到的prompt
  const setReceivedPrompt = (prompt: typeof receivedPrompt.value) => {
    receivedPrompt.value = prompt
  }
  
  // 清除接收到的prompt
  const clearReceivedPrompt = () => {
    receivedPrompt.value = null
  }

  return {
    // ===== 确认对话框状态 =====
    confirmDialogRef,
    
    // ===== 应用状态 =====
    currentTab,
    autoRefreshInterval,
    autoRefreshCountdown,
    autoRefreshTimer,
    lastWorkSummary,
    receivedPrompt,
    
    // ===== 确认对话框方法 =====
    setConfirmDialogRef,
    showConfirm,
    
    // ===== 应用方法 =====
    setCurrentTab,
    setAutoRefreshCountdown,
    setLastWorkSummary,
    setReceivedPrompt,
    clearReceivedPrompt,
    

  }
})
