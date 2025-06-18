<template>
  <div v-if="visible" class="confirm-dialog-overlay" @click="handleOverlayClick">
    <div class="confirm-dialog" @click.stop>
      <div class="confirm-dialog-header">
        <h3 class="confirm-dialog-title">{{ title }}</h3>
      </div>
      
      <div class="confirm-dialog-body">
        <div class="confirm-dialog-icon">
          <span v-if="type === 'warning'">⚠️</span>
          <span v-else-if="type === 'danger'">🗑️</span>
          <span v-else>❓</span>
        </div>
        <p class="confirm-dialog-message">{{ message }}</p>
      </div>
      
      <div class="confirm-dialog-footer">
        <button 
          class="confirm-btn secondary" 
          @click="handleCancel"
          :disabled="loading"
        >
          {{ cancelText }}
        </button>
        <button 
          class="confirm-btn primary" 
          :class="{ danger: type === 'danger' }"
          @click="handleConfirm"
          :disabled="loading"
        >
          <span v-if="loading">处理中...</span>
          <span v-else>{{ confirmText }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface ConfirmOptions {
  title?: string
  message: string
  type?: 'info' | 'warning' | 'danger'
  confirmText?: string
  cancelText?: string
}

// Props
const visible = ref(false)
const title = ref('')
const message = ref('')
const type = ref<'info' | 'warning' | 'danger'>('info')
const confirmText = ref('确认')
const cancelText = ref('取消')
const loading = ref(false)

// 内部状态
let resolvePromise: ((value: boolean) => void) | null = null

// 方法
const show = (options: ConfirmOptions): Promise<boolean> => {
  visible.value = true
  title.value = options.title || '确认操作'
  message.value = options.message
  type.value = options.type || 'info'
  confirmText.value = options.confirmText || '确认'
  cancelText.value = options.cancelText || '取消'
  loading.value = false
  
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const hide = () => {
  visible.value = false
  title.value = ''
  message.value = ''
  type.value = 'info'
  confirmText.value = '确认'
  cancelText.value = '取消'
  loading.value = false
  resolvePromise = null
}

const handleConfirm = () => {
  loading.value = true
  if (resolvePromise) {
    resolvePromise(true)
  }
  hide()
}

const handleCancel = () => {
  if (resolvePromise) {
    resolvePromise(false)
  }
  hide()
}

const handleOverlayClick = () => {
  handleCancel()
}

// 暴露方法给外部使用
defineExpose({
  show,
  hide
})
</script>

<style scoped>
.confirm-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  min-width: 400px;
  max-width: 500px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  animation: confirmDialogEnter 0.2s ease-out;
}

@keyframes confirmDialogEnter {
  from {
    opacity: 0;
    transform: scale(0.9) translateY(-20px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.confirm-dialog-header {
  padding: 20px 20px 0 20px;
}

.confirm-dialog-title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.confirm-dialog-body {
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.confirm-dialog-icon {
  font-size: 24px;
  flex-shrink: 0;
  margin-top: 2px;
}

.confirm-dialog-message {
  color: #cccccc;
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  flex: 1;
}

.confirm-dialog-footer {
  padding: 0 20px 20px 20px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.confirm-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 80px;
}

.confirm-btn.secondary {
  background: #3e3e42;
  color: #cccccc;
}

.confirm-btn.secondary:hover:not(:disabled) {
  background: #4a4a4f;
}

.confirm-btn.primary {
  background: #007acc;
  color: white;
}

.confirm-btn.primary:hover:not(:disabled) {
  background: #005a9e;
}

.confirm-btn.primary.danger {
  background: #d73a49;
}

.confirm-btn.primary.danger:hover:not(:disabled) {
  background: #b52d3a;
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style> 