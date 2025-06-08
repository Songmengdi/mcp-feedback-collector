import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 当前标签页
  const currentTab = ref<string>('report')
  
  // 当前快捷语模式
  const currentPhraseMode = ref<string>('discuss')
  
  // 默认快捷语内容
  const defaultPhrases = ref<Record<string, string>>({
    discuss: '对之前的所有过程,做一个整体的总结性的归纳,并且明确最近一段时间我们的核心聚焦点是什么,思考接下来我们需要做什么',
    edit: '根据之前步骤及需求,完成编码',
    search: '深入研究相关代码'
  })
  
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
  
  // 切换标签页
  const setCurrentTab = (tab: string) => {
    currentTab.value = tab
  }
  
  // 设置快捷语模式
  const setCurrentPhraseMode = (mode: string) => {
    currentPhraseMode.value = mode
  }
  
  // 设置默认快捷语
  const setDefaultPhrases = (phrases: Record<string, string>) => {
    defaultPhrases.value = phrases
  }
  
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
    // 状态
    currentTab,
    currentPhraseMode,
    defaultPhrases,
    autoRefreshInterval,
    autoRefreshCountdown,
    autoRefreshTimer,
    lastWorkSummary,
    receivedPrompt,
    
    // 方法
    setCurrentTab,
    setCurrentPhraseMode,
    setDefaultPhrases,
    setAutoRefreshCountdown,
    setLastWorkSummary,
    setReceivedPrompt,
    clearReceivedPrompt
  }
})
