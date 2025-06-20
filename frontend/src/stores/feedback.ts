import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageFile } from '../types/app'
import type { ClearPrompt } from '../services/clearPromptService'

export const useFeedbackStore = defineStore('feedback', () => {
  // 当前反馈会话ID
  const currentFeedbackSession = ref<string | null>(null)
  
  // 选中的图片
  const selectedImages = ref<ImageFile[]>([])
  
  // 反馈文本
  const feedbackText = ref<string>('')
  
  // 工作汇报内容
  const workSummary = ref<string>('')
  
  // 清理提示词相关状态
  const clearPrompt = ref<ClearPrompt | null>(null)
  const clearPromptLoading = ref<boolean>(false)
  const clearPromptError = ref<string>('')
  
  // 设置反馈会话ID
  const setCurrentFeedbackSession = (sessionId: string | null) => {
    currentFeedbackSession.value = sessionId
  }
  
  // 添加图片
  const addImage = (image: ImageFile) => {
    selectedImages.value.push(image)
  }
  
  // 移除图片
  const removeImage = (index: number) => {
    selectedImages.value.splice(index, 1)
  }
  
  // 清空图片
  const clearImages = () => {
    selectedImages.value = []
  }
  
  // 设置反馈文本
  const setFeedbackText = (text: string) => {
    feedbackText.value = text
  }
  
  // 设置工作汇报
  const setWorkSummary = (summary: string) => {
    workSummary.value = summary
  }
  
  // 清空反馈表单
  const clearFeedbackForm = () => {
    feedbackText.value = ''
    selectedImages.value = []
  }
  
  // 设置清理提示词
  const setClearPrompt = (prompt: ClearPrompt | null) => {
    clearPrompt.value = prompt
  }
  
  // 设置清理提示词加载状态
  const setClearPromptLoading = (loading: boolean) => {
    clearPromptLoading.value = loading
  }
  
  // 设置清理提示词错误
  const setClearPromptError = (error: string) => {
    clearPromptError.value = error
  }
  
  return {
    // 状态
    currentFeedbackSession,
    selectedImages,
    feedbackText,
    workSummary,
    clearPrompt,
    clearPromptLoading,
    clearPromptError,
    
    // 方法
    setCurrentFeedbackSession,
    addImage,
    removeImage,
    clearImages,
    setFeedbackText,
    setWorkSummary,
    clearFeedbackForm,
    setClearPrompt,
    setClearPromptLoading,
    setClearPromptError
  }
})
