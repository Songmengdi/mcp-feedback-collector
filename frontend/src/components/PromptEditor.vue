<template>
  <div v-if="visible" class="prompt-editor-overlay" @click="handleOverlayClick">
    <div class="prompt-editor-dialog" @click.stop>
      <div class="prompt-editor-header">
        <div class="header-info">
          <h3>编辑提示词</h3>
          <div class="mode-info">
            <span class="scene-name">{{ sceneName }}</span>
            <span class="mode-name">{{ modeName }}</span>
          </div>
        </div>
        <button class="close-btn" @click="handleCancel">×</button>
      </div>
      
      <div class="prompt-editor-body">
        <!-- 提示词模板编辑区 -->
        <div class="editor-section">
          <div class="editor-toolbar">
            <div class="toolbar-left">
              <span class="editor-label">提示词模板</span>
              <span class="variable-hint">支持变量: &#123;&#123; feedback &#125;&#125;</span>
            </div>
            <div class="toolbar-right">
              <button 
                class="toolbar-btn" 
                @click="insertVariable"
                :disabled="loading"
                title="插入反馈变量"
              >
                插入变量
              </button>
            </div>
          </div>
          
          <div class="editor-container">
            <textarea
              ref="editorTextarea"
              v-model="promptContent"
              class="prompt-textarea"
              placeholder="请输入提示词模板内容..."
              :disabled="loading"
              @keydown="handleKeydown"
            ></textarea>
          </div>
        </div>

        <!-- 默认反馈内容编辑区 -->
        <div class="editor-section">
          <div class="editor-toolbar">
            <div class="toolbar-left">
              <span class="editor-label">默认反馈内容</span>
              <span class="variable-hint">用户未输入反馈时的默认内容</span>
            </div>
          </div>
          
          <div class="editor-container">
            <textarea
              ref="feedbackTextarea"
              v-model="defaultFeedbackContent"
              class="feedback-textarea"
              placeholder="请输入该模式的默认反馈内容..."
              :disabled="loading"
              @keydown="handleKeydown"
            ></textarea>
          </div>
        </div>
        
        <div class="editor-status">
          <div class="status-left">
            <span class="char-count">提示词: {{ promptContent.length }} 字符</span>
            <span class="char-count">默认反馈: {{ defaultFeedbackContent.length }} 字符</span>
          </div>
          <span v-if="lastSaved" class="last-saved">
            最后保存: {{ formatTime(lastSaved) }}
          </span>
        </div>
      </div>
      
      <div class="prompt-editor-footer">
        <button 
          class="btn secondary" 
          @click="handleCancel"
          :disabled="loading"
        >
          取消
        </button>
        <button 
          class="btn primary" 
          @click="handleSave"
          :disabled="loading || !hasChanges"
        >
          <span v-if="loading">保存中...</span>
          <span v-else>保存</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import type { Scene, SceneMode } from '../types/app'

interface PromptEditorOptions {
  scene: Scene
  mode: SceneMode
  initialPrompt?: string
  initialDefaultFeedback?: string
}

// Props
const visible = ref(false)
const scene = ref<Scene | null>(null)
const mode = ref<SceneMode | null>(null)
const promptContent = ref('')
const defaultFeedbackContent = ref('')
const originalPromptContent = ref('')
const originalDefaultFeedbackContent = ref('')
const loading = ref(false)
const lastSaved = ref<number | null>(null)

// Refs
const editorTextarea = ref<HTMLTextAreaElement>()
const feedbackTextarea = ref<HTMLTextAreaElement>()

// 内部状态
let resolvePromise: ((saved: boolean) => void) | null = null

// 计算属性
const sceneName = computed(() => scene.value?.name || '')
const modeName = computed(() => mode.value?.name || '')
const hasChanges = computed(() => 
  promptContent.value !== originalPromptContent.value || 
  defaultFeedbackContent.value !== originalDefaultFeedbackContent.value
)

// 方法
const show = (options: PromptEditorOptions): Promise<boolean> => {
  visible.value = true
  scene.value = options.scene
  mode.value = options.mode
  promptContent.value = options.initialPrompt || ''
  defaultFeedbackContent.value = options.initialDefaultFeedback || ''
  originalPromptContent.value = options.initialPrompt || ''
  originalDefaultFeedbackContent.value = options.initialDefaultFeedback || ''
  loading.value = false
  lastSaved.value = null
  
  // 聚焦到提示词编辑器
  nextTick(() => {
    if (editorTextarea.value) {
      editorTextarea.value.focus()
    }
  })
  
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const hide = () => {
  visible.value = false
  scene.value = null
  mode.value = null
  promptContent.value = ''
  defaultFeedbackContent.value = ''
  originalPromptContent.value = ''
  originalDefaultFeedbackContent.value = ''
  loading.value = false
  lastSaved.value = null
  resolvePromise = null
}

const handleSave = async () => {
  if (!hasChanges.value || !scene.value || !mode.value) return
  
  loading.value = true
  try {
    // 触发保存提示词事件
    if (promptContent.value !== originalPromptContent.value) {
      const promptEvent = new CustomEvent('savePrompt', {
        detail: {
          sceneId: scene.value.id,
          modeId: mode.value.id,
          prompt: promptContent.value
        }
      })
      window.dispatchEvent(promptEvent)
    }
    
    // 触发保存默认反馈事件
    if (defaultFeedbackContent.value !== originalDefaultFeedbackContent.value) {
      const feedbackEvent = new CustomEvent('saveDefaultFeedback', {
        detail: {
          sceneId: scene.value.id,
          modeId: mode.value.id,
          defaultFeedback: defaultFeedbackContent.value
        }
      })
      window.dispatchEvent(feedbackEvent)
    }
    
    // 等待保存完成的确认
    await new Promise((resolve) => {
      let promptSaved = promptContent.value === originalPromptContent.value
      let feedbackSaved = defaultFeedbackContent.value === originalDefaultFeedbackContent.value
      
      const handlePromptSaveComplete = () => {
        promptSaved = true
        checkAllSaved()
      }
      
      const handleFeedbackSaveComplete = () => {
        feedbackSaved = true
        checkAllSaved()
      }
      
      const checkAllSaved = () => {
        if (promptSaved && feedbackSaved) {
          window.removeEventListener('promptSaveComplete', handlePromptSaveComplete)
          window.removeEventListener('defaultFeedbackSaveComplete', handleFeedbackSaveComplete)
          resolve(true)
        }
      }
      
      window.addEventListener('promptSaveComplete', handlePromptSaveComplete)
      window.addEventListener('defaultFeedbackSaveComplete', handleFeedbackSaveComplete)
      
      // 5秒超时
      setTimeout(() => {
        window.removeEventListener('promptSaveComplete', handlePromptSaveComplete)
        window.removeEventListener('defaultFeedbackSaveComplete', handleFeedbackSaveComplete)
        resolve(false)
      }, 5000)
      
      // 如果没有变化，立即完成
      checkAllSaved()
    })
    
    originalPromptContent.value = promptContent.value
    originalDefaultFeedbackContent.value = defaultFeedbackContent.value
    lastSaved.value = Date.now()
    
    if (resolvePromise) {
      resolvePromise(true)
    }
    hide()
  } catch (error) {
    // 错误已通过全局错误处理器显示
  } finally {
    loading.value = false
  }
}

const handleCancel = () => {
  if (resolvePromise) {
    resolvePromise(false)
  }
  hide()
}

const handleOverlayClick = () => {
  if (!hasChanges.value) {
    handleCancel()
  }
}

const insertVariable = () => {
  if (!editorTextarea.value) return
  
  const textarea = editorTextarea.value
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const variable = '{{ feedback }}'
  
  const newContent = promptContent.value.substring(0, start) + 
                    variable + 
                    promptContent.value.substring(end)
  
  promptContent.value = newContent
  
  // 设置光标位置
  nextTick(() => {
    const newPosition = start + variable.length
    textarea.setSelectionRange(newPosition, newPosition)
    textarea.focus()
  })
}

const handleKeydown = (event: KeyboardEvent) => {
  // Ctrl/Cmd + S 保存
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault()
    if (hasChanges.value) {
      handleSave()
    }
  }
  
  // Esc 取消
  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  }
}

const formatTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  })
}

// 暴露方法给外部使用
defineExpose({
  show,
  hide
})
</script>

<style scoped>
.prompt-editor-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
  backdrop-filter: blur(4px);
}

.prompt-editor-dialog {
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  width: 90%;
  max-width: 800px;
  height: 80vh;
  max-height: 600px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  animation: promptEditorEnter 0.2s ease-out;
}

@keyframes promptEditorEnter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.prompt-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #252526;
  border-bottom: 1px solid #3e3e42;
}

.header-info h3 {
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
}

.mode-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.scene-name {
  color: #007acc;
  font-weight: 500;
}

.mode-name {
  color: #969696;
}

.scene-name::after {
  content: ' / ';
  color: #969696;
}

.close-btn {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 20px;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.prompt-editor-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-bottom: 1px solid #3e3e42;
}

.editor-section:last-child {
  border-bottom: none;
}

.editor-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #1e1e1e;
  border-bottom: 1px solid #3e3e42;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.editor-label {
  font-size: 13px;
  font-weight: 500;
  color: #ffffff;
}

.variable-hint {
  font-size: 12px;
  color: #969696;
  background: #2d2d30;
  padding: 2px 6px;
  border-radius: 3px;
}

.toolbar-btn {
  background: #3e3e42;
  border: none;
  color: #cccccc;
  padding: 4px 8px;
  border-radius: 3px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: #4a4a4f;
}

.toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-container {
  flex: 1;
  padding: 20px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.prompt-textarea,
.feedback-textarea {
  flex: 1;
  width: 100%;
  padding: 12px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  color: #cccccc;
  font-size: 14px;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  line-height: 1.5;
  resize: none;
  outline: none;
  transition: border-color 0.2s ease;
  min-height: 120px;
}

.prompt-textarea:focus,
.feedback-textarea:focus {
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.prompt-textarea:disabled,
.feedback-textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.editor-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: #2d2d30;
  border-top: 1px solid #3e3e42;
  flex-shrink: 0;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.char-count {
  font-size: 12px;
  color: #969696;
}

.last-saved {
  font-size: 12px;
  color: #4ec9b0;
}

.prompt-editor-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  background: #252526;
  border-top: 1px solid #3e3e42;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.btn.secondary {
  background: #3e3e42;
  color: #cccccc;
}

.btn.secondary:hover:not(:disabled) {
  background: #4a4a4f;
}

.btn.primary {
  background: #007acc;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #005a9e;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .prompt-editor-dialog {
    width: 95%;
    height: 90vh;
  }
  
  .editor-toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .toolbar-left,
  .toolbar-right {
    justify-content: center;
  }
}
</style> 