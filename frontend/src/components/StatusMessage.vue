<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast" tag="div">
        <div
          v-for="message in messages"
          :key="message.id"
          :class="['toast', `toast-${message.type}`]"
          @click="removeMessage(message.id)"
        >
          <component :is="getStatusIcon(message.type)" class="toast-icon" />
          <div class="toast-content">
            <div class="toast-message">{{ message.text }}</div>
          </div>
          <button class="toast-close" @click.stop="removeMessage(message.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { provide, ref } from 'vue'
import type { MessageType } from '../types/app'
import { 
  CheckCircleIconSolid,
  XCircleIconSolid,
  ExclamationTriangleIconSolid,
  InformationCircleIconSolid 
} from '../components/icons'

// 消息接口
interface ToastMessage {
  id: string
  type: MessageType
  text: string
  autoRemove: boolean
  timer?: number
}

// 消息列表
const messages = ref<ToastMessage[]>([])

// 显示消息
const showMessage = (type: MessageType, text: string, autoRemove = true) => {
  const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
  
  const message: ToastMessage = {
    id,
    type,
    text,
    autoRemove
  }

  messages.value.push(message)

  // 自动移除
  if (autoRemove) {
    const duration = type === 'error' ? 5000 : 3000
    message.timer = window.setTimeout(() => {
      removeMessage(id)
    }, duration)
  }

  return id // 返回消息ID，用于后续更新
}

// 更新消息内容
const updateMessage = (id: string, newText: string) => {
  const message = messages.value.find(msg => msg.id === id)
  if (message) {
    message.text = newText
  }
}

// 移除消息
const removeMessage = (id: string) => {
  const index = messages.value.findIndex(msg => msg.id === id)
  if (index > -1) {
    const message = messages.value[index]
    if (message.timer) {
      clearTimeout(message.timer)
    }
    messages.value.splice(index, 1)
  }
}

// 清空所有消息
const clearAllMessages = () => {
  messages.value.forEach(message => {
    if (message.timer) {
      clearTimeout(message.timer)
    }
  })
  messages.value = []
}

// 获取状态图标
const getStatusIcon = (type: MessageType) => {
  const icons = {
    success: CheckCircleIconSolid,
    error: XCircleIconSolid,
    warning: ExclamationTriangleIconSolid,
    info: InformationCircleIconSolid
  }
  return icons[type]
}

// 提供给子组件使用
provide('showStatusMessage', showMessage)
provide('clearAllStatusMessages', clearAllMessages)

// 暴露方法给外部使用
defineExpose({
  showMessage,
  updateMessage,
  removeMessage,
  clearAllMessages
})
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 10000;
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 300px;
  max-width: 500px;
  padding: 12px 16px;
  margin-bottom: 8px;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  cursor: pointer;
  pointer-events: auto;
  font-size: 13px;
  line-height: 1.4;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.toast-success {
  background: rgba(34, 197, 94, 0.9);
  color: white;
}

.toast-error {
  background: rgba(239, 68, 68, 0.9);
  color: white;
}

.toast-warning {
  background: rgba(245, 158, 11, 0.9);
  color: white;
}

.toast-info {
  background: rgba(59, 130, 246, 0.9);
  color: white;
}

.toast-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-message {
  word-wrap: break-word;
  font-weight: 500;
}

.toast-close {
  background: none;
  border: none;
  color: inherit;
  font-size: 16px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;
  flex-shrink: 0;
}

.toast-close:hover {
  opacity: 1;
  background: rgba(255, 255, 255, 0.1);
}

/* 动画效果 */
.toast-enter-active {
  transition: all 0.3s ease;
}

.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.toast-move {
  transition: transform 0.3s ease;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .toast-container {
    top: 10px;
    right: 10px;
    left: 10px;
  }
  
  .toast {
    min-width: auto;
    max-width: none;
  }
}
</style>
