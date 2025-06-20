<template>
  <div class="modal-overlay" @click="handleOverlayClick">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h3 class="modal-title">
          <span class="modal-icon">🧹</span>
          编辑清理提示词
        </h3>
        <button class="close-button" @click="$emit('close')" :disabled="loading">
          <span class="close-icon">×</span>
        </button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label">
            清理提示词内容
            <span class="form-hint">当开启"清理之前对话"时，此提示词将在反馈内容前发送给AI</span>
          </label>
          <textarea
            v-model="editedPrompt"
            class="form-textarea"
            placeholder="请输入清理提示词..."
            rows="6"
            :disabled="loading"
          ></textarea>
        </div>
        
        <div class="prompt-stats">
          <span class="stats-item">字符数: {{ editedPrompt.length }}</span>
          <span class="stats-item">行数: {{ lineCount }}</span>
        </div>
        
        <div v-if="error" class="error-message">
          {{ error }}
        </div>
      </div>
      
      <div class="modal-footer">
        <button 
          class="btn btn-secondary" 
          @click="handleReset"
          :disabled="loading"
        >
          <span class="btn-text">{{ loading ? '重置中...' : '重置为默认' }}</span>
        </button>
        <div class="button-group-right">
          <button 
            class="btn btn-secondary" 
            @click="$emit('close')"
            :disabled="loading"
          >
            取消
          </button>
          <button 
            class="btn btn-primary" 
            @click="handleSave"
            :disabled="loading || !hasChanges"
          >
            <span class="btn-text">{{ loading ? '保存中...' : '保存' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useFeedbackStore } from '../stores/feedback'
import clearPromptService from '../services/clearPromptService'

interface Props {
  initialPrompt?: string
}

interface Emits {
  (e: 'close'): void
  (e: 'saved', prompt: string): void
}

const props = withDefaults(defineProps<Props>(), {
  initialPrompt: ''
})

const emit = defineEmits<Emits>()

// Store引用
const feedbackStore = useFeedbackStore()

// 本地状态
const editedPrompt = ref(props.initialPrompt)
const loading = ref(false)
const error = ref('')

// 计算属性
const lineCount = computed(() => {
  return editedPrompt.value.split('\n').length
})

const hasChanges = computed(() => {
  return editedPrompt.value !== props.initialPrompt
})

// 监听初始提示词变化
watch(() => props.initialPrompt, (newValue) => {
  editedPrompt.value = newValue
})

// 处理覆盖层点击
const handleOverlayClick = () => {
  if (!loading.value) {
    emit('close')
  }
}

// 处理保存
const handleSave = async () => {
  if (loading.value) return
  
  // 检查是否包含至少一个非空白字符
  const hasNonWhitespaceChar = /\S/.test(editedPrompt.value)
  if (!hasNonWhitespaceChar) {
    error.value = '提示词不能完全由空白字符组成'
    return
  }
  
  try {
    loading.value = true
    error.value = ''
    
    // 保存完整的用户输入（包括空白字符）
    await clearPromptService.saveClearPrompt(editedPrompt.value)
    
    // 更新store状态
    const updatedPrompt = await clearPromptService.getClearPrompt()
    feedbackStore.setClearPrompt(updatedPrompt)
    
    emit('saved', editedPrompt.value)
    emit('close')
  } catch (err) {
    error.value = err instanceof Error ? err.message : '保存失败'
  } finally {
    loading.value = false
  }
}

// 处理重置
const handleReset = async () => {
  if (loading.value) return
  
  try {
    loading.value = true
    error.value = ''
    
    const defaultPrompt = await clearPromptService.resetClearPrompt()
    editedPrompt.value = defaultPrompt
    
    // 更新store状态
    const updatedPrompt = await clearPromptService.getClearPrompt()
    feedbackStore.setClearPrompt(updatedPrompt)
    
  } catch (err) {
    error.value = err instanceof Error ? err.message : '重置失败'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(2px);
}

.modal-content {
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #3e3e42;
  background: #2d2d30;
}

.modal-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #cccccc;
}

.modal-icon {
  font-size: 20px;
}

.close-button {
  background: none;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #cccccc;
  transition: all 0.2s;
}

.close-button:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  color: #ffffff;
}

.close-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.close-icon {
  font-size: 24px;
  line-height: 1;
}

.modal-body {
  padding: 24px 28px;
  flex: 1;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #cccccc;
  font-size: 14px;
}

.form-hint {
  display: block;
  font-weight: 400;
  color: #969696;
  font-size: 12px;
  margin-top: 4px;
}

.form-textarea {
  width: 100%;
  padding: 16px;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  font-size: 14px;
  line-height: 1.6;
  resize: vertical;
  min-height: 120px;
  background: #1e1e1e;
  color: #cccccc;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  transition: border-color 0.2s;
}

.form-textarea:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 1px #007acc;
}

.form-textarea:disabled {
  background: #2d2d30;
  color: #969696;
  cursor: not-allowed;
}

.prompt-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #969696;
  margin-top: 8px;
}

.stats-item {
  display: flex;
  align-items: center;
}

.error-message {
  background: #3c1e1e;
  border: 1px solid #5a3e3e;
  color: #ff6b6b;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
  margin-top: 12px;
}

.modal-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid #3e3e42;
  background: #2d2d30;
}

.button-group-right {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: #007acc;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #005a9e;
}

.btn-secondary {
  background: #3e3e42;
  color: #cccccc;
}

.btn-secondary:hover:not(:disabled) {
  background: #4a4a4f;
}

.btn-text {
  white-space: nowrap;
}
</style> 