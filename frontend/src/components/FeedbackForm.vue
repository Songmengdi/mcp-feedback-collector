<template>
  <div class="feedback-card">
    <div class="feedback-header">
      <div class="feedback-title">
        <span>💬</span>
        您的反馈
      </div>
      <div class="clear-control-group">
        <label class="switch-label">
          <span class="switch-text">清理之前对话</span>
          <div class="switch-container">
            <input 
              v-model="clearPreviousConversation" 
              type="checkbox"
              class="switch-input"
              @change="handleClearSwitchChange"
            />
            <span class="switch-slider"></span>
          </div>
        </label>
        <button 
          type="button"
          class="edit-prompt-btn"
          @click="showClearPromptEditor"
          title="编辑清理提示词"
        >
          <PencilIcon class="edit-icon" />
        </button>
      </div>
    </div>
    <div class="feedback-body" ref="feedbackBodyRef">
      <form @submit.prevent="handleSubmit">
        <div class="form-group textarea-group">
          <textarea
            ref="textareaRef"
            v-model="feedbackText"
            class="form-textarea"
            :placeholder="placeholderText"
            @paste="handlePaste"
          ></textarea>
        </div>

        <div class="form-group phrase-mode-group">
          <!-- 快捷语选项 -->
          <PhraseModeSelector />
        </div>

        <div class="form-group">
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
    
    <!-- 清理提示词编辑器弹窗 -->
    <ClearPromptEditor
      v-if="showEditor"
      :initial-prompt="currentClearPrompt"
      @close="hideClearPromptEditor"
      @saved="handleClearPromptSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import socketService from '../services/socket'
import promptService from '../services/promptService'
import shortcutService from '../services/shortcutService'
import clearPromptService from '../services/clearPromptService'
import { useConnectionStore } from '../stores/connection'
import { useFeedbackStore } from '../stores/feedback'
import { useScenesStore } from '../stores/scenes'
import type { ImageFile } from '../types/app'
import ImageUpload from './ImageUpload.vue'
import PhraseModeSelector from './PhraseModeSelector.vue'
import ClearPromptEditor from './ClearPromptEditor.vue'
import { PencilIcon } from './icons'

// Store引用
const feedbackStore = useFeedbackStore()
const connectionStore = useConnectionStore()
const scenesStore = useScenesStore()

// 本地状态
const feedbackText = ref('')
const isSubmitting = ref(false)
const clearPreviousConversation = ref(false)
// textareaHeight已移除，改为CSS的height: 100%
const feedbackBodyRef = ref<HTMLElement>()
const textareaRef = ref<HTMLTextAreaElement>()

// 清理提示词编辑器相关状态
const showEditor = ref(false)
const currentClearPrompt = ref('')

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
const applyQuickPhraseToFeedback = async (text: string): Promise<string> => {
  try {
    const quickPhrase = await getCustomQuickPhrase()
    
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
  } catch (error) {
    console.error('应用提示词失败，使用原始反馈内容:', error)
    return text
  }
}

// 获取自定义快捷语
const getCustomQuickPhrase = async (): Promise<string> => {
  try {
    // 使用场景化API获取提示词 - 修复：使用scenesStore.currentSelection而不是appStore.currentSelection
    const selection = { sceneId: scenesStore.currentSelection.sceneId, modeId: scenesStore.currentSelection.modeId }
    const prompt = await promptService.getUnifiedPrompt(selection)
    return prompt || ''
  } catch (error) {
    console.error('获取提示词失败:', error)
    // 网络错误时返回空字符串
    return ''
  }
}

// 获取默认反馈内容 - 重构为使用快捷键服务
const getDefaultFeedback = (): string => {
  return shortcutService.getCurrentModeDefaultFeedback()
}

// 清理开关变化处理
const handleClearSwitchChange = async () => {
  if (clearPreviousConversation.value) {
    // 开启清理时，加载当前清理提示词
    await loadCurrentClearPrompt()
  }
}

// 加载当前清理提示词
const loadCurrentClearPrompt = async () => {
  try {
    feedbackStore.setClearPromptLoading(true)
    const clearPrompt = await clearPromptService.getClearPrompt()
    
    if (clearPrompt) {
      currentClearPrompt.value = clearPrompt.prompt_text
      feedbackStore.setClearPrompt(clearPrompt)
    } else {
      // 如果没有找到，使用默认提示词
      currentClearPrompt.value = `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`
    }
    
    feedbackStore.setClearPromptError('')
  } catch (error) {
    console.error('加载清理提示词失败:', error)
    feedbackStore.setClearPromptError('加载清理提示词失败')
    // 使用默认提示词作为后备
    currentClearPrompt.value = `**(重要)不再关注之前我们谈论的话题,专注于接下来的具体任务**
=== 新任务 ===

`
  } finally {
    feedbackStore.setClearPromptLoading(false)
  }
}

// 显示清理提示词编辑器
const showClearPromptEditor = async () => {
  // 如果开关未开启，先开启开关并加载提示词
  if (!clearPreviousConversation.value) {
    clearPreviousConversation.value = true
    await loadCurrentClearPrompt()
  }
  
  showEditor.value = true
}

// 隐藏清理提示词编辑器
const hideClearPromptEditor = () => {
  showEditor.value = false
}

// 处理清理提示词保存
const handleClearPromptSaved = (prompt: string) => {
  currentClearPrompt.value = prompt
  showStatusMessage('success', '清理提示词保存成功')
}

// 表单提交处理
const handleSubmit = async () => {
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
    try {
      processedText = await applyQuickPhraseToFeedback(processedText)
    } catch (error) {
      console.error('应用提示词失败:', error)
      showStatusMessage('warning', '提示词应用失败，使用原始反馈内容')
    }
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
    sessionId: feedbackStore.currentFeedbackSession,
    clearPreviousConversation: clearPreviousConversation.value
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

// textarea高度计算函数已移除，改为CSS的height: 100%

// 快捷键处理 - 只处理表单相关的快捷键，模式切换由shortcutService统一处理
const handleKeydown = (e: KeyboardEvent) => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  const isCtrlOrCmd = isMac ? e.metaKey : e.ctrlKey
  
  // 检查当前焦点是否在反馈表单区域内
  const activeElement = document.activeElement
  const formElement = document.querySelector('.feedback-card')
  const isInForm = formElement && formElement.contains(activeElement)
  
  if (!isInForm) {
    return // 不在表单内，不处理任何快捷键
  }
  
  // 检查是否按下了 Cmd+Enter (Mac) 或 Ctrl+Enter (Windows) - 提交表单
  if (isCtrlOrCmd && e.key === 'Enter') {
    e.preventDefault()
    handleSubmit()
    return
  }
  
  // 检查清空表单快捷键 (Ctrl/Cmd + Backspace)
  if (isCtrlOrCmd && e.key === 'Backspace') {
    e.preventDefault()
    clearForm()
    return
  }
  
  // 所有其他快捷键（包括数字键模式切换）由 shortcutService 统一处理
  // 这里不再拦截任何其他按键事件
}

// 生命周期
onMounted(() => {
  // 初始化快捷键服务
  shortcutService.init()
  
  // 监听场景模式变化，更新快捷键绑定
  const updateShortcutBindings = () => {
    if (scenesStore.hasModes && scenesStore.currentSceneModes.length > 0) {
      shortcutService.updateBindings(scenesStore.currentSceneModes)
    }
  }
  
  // 等待场景数据加载完成后再初始化快捷键绑定
  const initializeShortcuts = async () => {
    // 如果场景数据已经加载，直接更新
    if (scenesStore.hasModes && scenesStore.currentSceneModes.length > 0) {
      updateShortcutBindings()
    } else {
      // 否则等待数据加载
      // 监听场景数据变化
      const unsubscribe = scenesStore.$subscribe((_, state) => {
        if (state.currentSceneModes.length > 0) {
          updateShortcutBindings()
          unsubscribe() // 只需要初始化一次
        }
      })
    }
  }
  
  // 初始化快捷键绑定
  initializeShortcuts()
  
  // 监听后续的模式变化
  scenesStore.$subscribe(() => {
    updateShortcutBindings()
  })
  
  // 初始化清理提示词（如果开关已开启）
  if (clearPreviousConversation.value) {
    loadCurrentClearPrompt()
  }
  
  document.addEventListener('keydown', handleKeydown)
  
  nextTick(() => {
    const textarea = document.querySelector('.form-textarea') as HTMLTextAreaElement
    if (textarea) {
      textarea.focus()
    }
  })
})

onUnmounted(() => {
  // 销毁快捷键服务
  shortcutService.destroy()
  
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
  flex: 1; /* 占据剩余空间 */
  display: flex;
  flex-direction: column;
  min-height: 0; /* 允许收缩 */
  overflow: hidden; /* 防止内容溢出 */
  height: 100%; /* 占用全部可用高度 */
}

.feedback-header {
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.feedback-title {
  color: #ffffff;
  font-size: 16px;
  margin-bottom: 0;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.feedback-body {
  flex: 1;
  overflow-y: auto; 
  min-height: 0; /* 确保可以收缩 */
  display: flex;
  flex-direction: column;
  height: 100%; /* 占用全部可用高度 */
}

.feedback-body form {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.form-group {
  margin-bottom: 10px; /* 进一步减少间距 */
}

.form-group:last-child {
  margin-bottom: 0; /* 最后一个组件无下边距 */
  flex-shrink: 0; /* 按钮组不被压缩 */
}

/* PhraseModeSelector所在的form-group也不应被压缩 */
.form-group.phrase-mode-group {
  flex-shrink: 0;
}

.form-label {
  display: block;
  color: #cccccc;
  font-size: 13px;
  margin-bottom: 6px;
  font-weight: 500;
}

/* 反馈标签行样式 */
.feedback-label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.feedback-label-row .form-label {
  margin-bottom: 0; /* 重置原有的margin-bottom */
}

/* 复用开关样式，但调整尺寸 */
.feedback-label-row .switch-label {
  display: flex !important;
  justify-content: flex-end;
  align-items: center;
  cursor: pointer;
  margin: 0;
  gap: 8px;
}

.feedback-label-row .switch-text {
  font-size: 12px;
  color: #969696;
  font-weight: 400;
}

.feedback-label-row .switch-container {
  position: relative;
  display: inline-block;
  width: 36px;  /* 比原来的44px小一些 */
  height: 20px; /* 比原来的24px小一些 */
}

.feedback-label-row .switch-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.feedback-label-row .switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #3e3e42;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.feedback-label-row .switch-slider:before {
  position: absolute;
  content: "";
  height: 14px;  /* 调整滑块大小 */
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: #cccccc;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.feedback-label-row .switch-input:checked + .switch-slider {
  background-color: #0e639c; /* 使用与按钮一致的蓝色 */
}

.feedback-label-row .switch-input:checked + .switch-slider:before {
  transform: translateX(16px); /* 调整滑动距离 */
  background-color: white;
}

.feedback-label-row .switch-slider:hover {
  box-shadow: 0 0 6px rgba(14, 99, 156, 0.3); /* 使用一致的蓝色 */
}

.textarea-group {
  flex: 1; /* 让包含textarea的组占据剩余空间 */
  display: flex;
  flex-direction: column;
  min-height: 0;
  margin-bottom: 6px; /* 减少下边距 */
}

.form-textarea {
  width: 100%;
  height: 100%;
  padding: 10px 12px;
  background-color: #3c3c3c;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  color: #cccccc;
  font-size: 14px;
  font-family: inherit;
  transition: border-color 0.2s ease;
  resize: none;
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
  flex-shrink: 0; /* 确保按钮组不被压缩 */
  margin-top: 6px; /* 减少上边距 */
}

.btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
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

/* 清理控制组样式 */
.clear-control-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 为header中的clear-control-group添加样式 */
.feedback-header .clear-control-group .switch-label {
  display: flex !important;
  justify-content: flex-end;
  align-items: center;
  cursor: pointer;
  margin: 0;
  gap: 8px;
}

.feedback-header .clear-control-group .switch-text {
  font-size: 12px;
  color: #969696;
  font-weight: 400;
}

.feedback-header .clear-control-group .switch-container {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}

.feedback-header .clear-control-group .switch-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.feedback-header .clear-control-group .switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #3e3e42;
  border-radius: 20px;
  transition: all 0.3s ease;
}

.feedback-header .clear-control-group .switch-slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: #cccccc;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.feedback-header .clear-control-group .switch-input:checked + .switch-slider {
  background-color: #0e639c;
}

.feedback-header .clear-control-group .switch-input:checked + .switch-slider:before {
  transform: translateX(16px);
  background-color: white;
}

.feedback-header .clear-control-group .switch-slider:hover {
  box-shadow: 0 0 6px rgba(14, 99, 156, 0.3);
}

/* 编辑提示词按钮样式 */
.edit-prompt-btn {
  background: none;
  border: 1px solid #5a5a5a;
  border-radius: 4px;
  padding: 4px 6px;
  cursor: pointer;
  color: #cccccc;
  font-size: 12px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 28px;
  height: 24px;
}

.edit-prompt-btn:hover {
  background-color: #3e3e42;
  border-color: #0e639c;
  color: #ffffff;
}

.edit-prompt-btn:active {
  background-color: #2d2d30;
}

.edit-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
</style>
