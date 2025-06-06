<template>
  <div class="feedback-card">
    <div class="feedback-header">
      <div class="feedback-title">
        <span>💬</span>
        您的反馈
      </div>
    </div>
    <div class="feedback-body">
      <form @submit.prevent="handleSubmit">
        <div class="form-group">
          <label class="form-label">反馈内容</label>
          <textarea
            v-model="feedbackText"
            class="form-textarea"
            :placeholder="placeholderText"
            @paste="handlePaste"
          ></textarea>

          <!-- 快捷语选项 -->
          <PhraseModeSelector />
        </div>

        <div class="form-group">
          <label class="form-label">附件图片（可选）</label>
          <ImageUpload />
        </div>

        <div class="button-group">
          <button 
            type="button" 
            class="btn btn-secondary" 
            @click="clearForm"
            :title="clearShortcutHint"
          >
            <span class="btn-text">清空</span>
            <span class="btn-shortcut">{{ clearShortcutText }}</span>
          </button>
          <button 
            type="submit" 
            class="btn btn-primary" 
            :disabled="isSubmitting"
            :title="shortcutHint"
          >
            <span class="btn-text">{{ isSubmitting ? '提交中...' : '提交反馈' }}</span>
            <span class="btn-shortcut">{{ shortcutText }}</span>
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import socketService from '../services/socket'
import { useAppStore } from '../stores/app'
import { useConnectionStore } from '../stores/connection'
import { useFeedbackStore } from '../stores/feedback'
import type { ImageFile } from '../types/app'
import ImageUpload from './ImageUpload.vue'
import PhraseModeSelector from './PhraseModeSelector.vue'

// Store引用
const feedbackStore = useFeedbackStore()
const connectionStore = useConnectionStore()
const appStore = useAppStore()

// 本地状态
const feedbackText = ref('')
const isSubmitting = ref(false)

// 计算属性
const shortcutText = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '⌘⏎' : 'Ctrl+⏎'
})

const shortcutHint = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '快捷键: Cmd+Enter' : '快捷键: Ctrl+Enter'
})

const clearShortcutText = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '⌘⌫' : 'Ctrl+⌫'
})

const clearShortcutHint = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '快捷键: Cmd+Backspace' : '快捷键: Ctrl+Backspace'
})

const placeholderText = computed(() => {
  const defaultFeedback = getDefaultFeedback()
  return `默认反馈: "${defaultFeedback}"` || '请输入您对本次工作的反馈和建议...'
})

// 应用快捷语到反馈内容
const applyQuickPhraseToFeedback = (text: string): string => {
  const quickPhrase = getCustomQuickPhrase()
  
  if (!quickPhrase) {
    return text
  }
  
  // 检查提示词中是否包含 {{ feedback }} 占位符
  if (quickPhrase.includes('{{ feedback }}')) {
    // 如果包含占位符，替换为用户反馈内容
    return quickPhrase.replace(/\{\{\s*feedback\s*\}\}/g, text)
  } else {
    // 如果不包含占位符，提示词在前（顶部），反馈内容在后，用---分割
    return quickPhrase.trim() + '\n\n---\n' + text
  }
}

// 获取自定义快捷语
const getCustomQuickPhrase = (): string => {
  const customPhrase = localStorage.getItem(`mcp-custom-quick-phrase-${appStore.currentPhraseMode}`)
  return customPhrase || appStore.defaultPhrases[appStore.currentPhraseMode]
}

// 获取默认反馈内容
const getDefaultFeedback = (): string => {
  const defaultFeedbacks = {
    discuss: '对之前的所有过程,做一个整体的总结性的归纳,并且明确最近一段时间我们的核心聚焦点是什么,思考接下来我们需要做什么',
    edit: '根据之前步骤及需求,完成编码',
    search: '深入研究相关代码'
  }
  return defaultFeedbacks[appStore.currentPhraseMode as keyof typeof defaultFeedbacks] || ''
}

// 表单提交处理
const handleSubmit = () => {
  let processedText = feedbackText.value.trim()

  // 如果用户未输入内容，使用当前模式的默认反馈
  if (!processedText) {
    const defaultFeedback = getDefaultFeedback()
    if (defaultFeedback) {
      processedText = defaultFeedback
    }
  }

  // 自动附加快捷语（反馈模式是必选的）
  if (processedText) {
    processedText = applyQuickPhraseToFeedback(processedText)
  }

  console.log('提交反馈:', {
    text: processedText,
    images: feedbackStore.selectedImages.length,
    session: feedbackStore.currentFeedbackSession,
    connected: connectionStore.isConnected
  })

  if (!processedText && feedbackStore.selectedImages.length === 0) {
    showStatusMessage('error', '请输入反馈内容或选择图片')
    return
  }

  if (!connectionStore.isConnected) {
    showStatusMessage('error', '连接已断开，请刷新页面重试')
    return
  }

  // 检查会话ID
  if (!feedbackStore.currentFeedbackSession) {
    showStatusMessage('error', '当前为演示模式，请通过MCP工具函数调用来创建正式的反馈会话')
    console.log('演示模式 - 反馈内容:', {
      text: processedText,
      images: feedbackStore.selectedImages.length,
      timestamp: new Date().toLocaleString()
    })

    // 显示演示反馈
    showStatusMessage('info', '演示反馈已记录到控制台，请查看浏览器开发者工具')
    clearForm()
    return
  }

  // 设置提交状态
  isSubmitting.value = true

  // 发送反馈数据
  const feedbackData = {
    text: processedText,
    images: feedbackStore.selectedImages.map(img => ({
      name: img.name,
      data: img.data,
      size: img.size,
      type: img.type
    })),
    timestamp: Date.now(),
    sessionId: feedbackStore.currentFeedbackSession
  }

  console.log('发送反馈数据:', feedbackData)
  socketService.submitFeedback(feedbackData)

  // 5秒后重新启用按钮（防止卡住）
  setTimeout(() => {
    isSubmitting.value = false
  }, 5000)
}

// 清空表单
const clearForm = () => {
  feedbackText.value = ''
  feedbackStore.clearFeedbackForm()
}

// 处理图片粘贴
const handlePaste = (e: ClipboardEvent) => {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault() // 阻止默认粘贴行为
      
      const blob = item.getAsFile()
      if (blob) {
        const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type })
        try {
          validateImageFile(file)
          addImageToStore(file)
        } catch (error) {
          showStatusMessage('error', `粘贴图片失败: ${(error as Error).message}`)
        }
      }
      break
    }
  }
}

// 验证图片文件
const validateImageFile = (file: File) => {
  const maxFileSize = 10 * 1024 * 1024 // 10MB
  const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']

  if (file.size > maxFileSize) {
    throw new Error(`文件过大，最大支持 ${formatFileSize(maxFileSize)}`)
  }

  if (!supportedFormats.includes(file.type.toLowerCase())) {
    throw new Error(`不支持的文件格式: ${file.type}`)
  }
}

// 添加图片到store
const addImageToStore = (file: File) => {
  // 这里应该调用图片压缩服务，暂时简化处理
  const reader = new FileReader()
  reader.onload = (e) => {
    const imageData: ImageFile = {
      name: file.name,
      data: e.target?.result as string,
      size: file.size,
      type: file.type
    }
    feedbackStore.addImage(imageData)
  }
  reader.readAsDataURL(file)
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 显示状态消息（临时实现，后续会用StatusMessage组件）
const showStatusMessage = (type: string, message: string) => {
  console.log(`[${type.toUpperCase()}] ${message}`)
  // TODO: 集成StatusMessage组件
}

// 快捷键处理
const handleKeydown = (e: KeyboardEvent) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey
  
  // 检查是否按下了 Cmd+Enter (Mac) 或 Ctrl+Enter (Windows)
  const isSubmitShortcut = isCtrlOrCmd && e.key === 'Enter'
  
  if (isSubmitShortcut) {
    // 检查当前焦点是否在反馈表单区域内
    const activeElement = document.activeElement
    const formElement = document.querySelector('.feedback-card')
    
    // 如果焦点在表单内，触发提交
    if (formElement && formElement.contains(activeElement)) {
      e.preventDefault()
      handleSubmit()
    }
    return
  }
  
  // 检查反馈模式切换快捷键 (Ctrl/Cmd + 1/2/3)
  if (isCtrlOrCmd && ['1', '2', '3'].includes(e.key)) {
    e.preventDefault()
    
    const modeMap = {
      '1': 'discuss',
      '2': 'edit', 
      '3': 'search'
    }
    
    const targetMode = modeMap[e.key as '1' | '2' | '3']
    if (targetMode) {
      appStore.setCurrentPhraseMode(targetMode)
    }
    return
  }
  
  // 检查清空表单快捷键 (Ctrl/Cmd + Backspace)
  if (isCtrlOrCmd && e.key === 'Backspace') {
    // 检查当前焦点是否在反馈表单区域内
    const activeElement = document.activeElement
    const formElement = document.querySelector('.feedback-card')
    
    // 如果焦点在表单内，触发清空
    if (formElement && formElement.contains(activeElement)) {
      e.preventDefault()
      clearForm()
    }
  }
}

// 生命周期
onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  nextTick(() => {
    const textarea = document.querySelector('.form-textarea') as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
    }
  })
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* 使用原始设计的卡片样式 */
.feedback-card {
  background-color: #252526;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.feedback-header {
  margin-bottom: 15px;
}

.feedback-title {
  color: #ffffff;
  font-size: 18px;
  margin-bottom: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.feedback-body {
  flex: 1;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  color: #cccccc;
  font-size: 14px;
  margin-bottom: 8px;
  font-weight: 500;
}

.form-textarea {
  width: 100%;
  padding: 10px 12px;
  background-color: #3c3c3c;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #cccccc;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s ease;
  resize: none;
  min-height: 200px;
}

.form-textarea:focus {
  outline: none;
  border-color: #0e639c;
  box-shadow: 0 0 0 2px rgba(14, 99, 156, 0.2);
}

.button-group {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
  min-width: 140px;
  gap: 8px;
}

.btn:last-child {
  margin-right: 0;
}

.btn-secondary {
  background-color: #5a5a5a;
  color: #ffffff;
}

.btn-secondary:hover {
  background-color: #6e6e6e;
}

.btn-primary {
  background-color: #0e639c;
  color: #ffffff;
}

.btn-primary:hover:not(:disabled) {
  background-color: #1177bb;
}

.btn-primary:disabled {
  background-color: #5a5a5a;
  cursor: not-allowed;
}

.btn-text {
  flex: 1;
  text-align: left;
}

.btn-shortcut {
  font-size: 11px;
  opacity: 0.7;
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  display: inline-block;
  line-height: 1;
  vertical-align: middle;
  flex-shrink: 0;
}
</style>
