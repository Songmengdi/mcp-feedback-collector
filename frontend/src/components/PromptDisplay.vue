<template>
  <div class="prompt-display">
    <div class="prompt-header">
      <h3>收到的Prompt</h3>
      <div class="prompt-meta">
        <span v-if="receivedPrompt?.metadata?.source" class="source-tag">
          来源: {{ receivedPrompt.metadata.source }}
        </span>
        <span v-if="receivedPrompt?.timestamp" class="timestamp">
          {{ formatTimestamp(receivedPrompt.timestamp) }}
        </span>
      </div>
    </div>

    <div v-if="receivedPrompt" class="prompt-content">
      <!-- Prompt文本 -->
      <div class="prompt-text">
        <div class="text-content">{{ receivedPrompt.prompt }}</div>
      </div>

      <!-- 模型信息 -->
      <div v-if="receivedPrompt.model" class="prompt-model">
        <label>模型:</label>
        <span>{{ receivedPrompt.model }}</span>
      </div>

      <!-- 模式信息 -->
      <div v-if="receivedPrompt.mode" class="prompt-mode">
        <label>模式:</label>
        <span>{{ receivedPrompt.mode }}</span>
      </div>

      <!-- 文件列表 -->
      <div v-if="receivedPrompt.files && receivedPrompt.files.length > 0" class="prompt-files">
        <label>相关文件:</label>
        <ul>
          <li v-for="(file, index) in receivedPrompt.files" :key="index">
            {{ file }}
          </li>
        </ul>
      </div>

      <!-- 图片信息 -->
      <div v-if="receivedPrompt.images && receivedPrompt.images.length > 0" class="prompt-images">
        <label>图片:</label>
        <span>{{ receivedPrompt.images.length }} 张图片</span>
      </div>

    </div>

    <!-- 操作按钮 - 移到外层，固定在底部 -->
    <div v-if="receivedPrompt" class="prompt-actions">
      <button @click="copyPrompt" class="btn btn-primary">
        复制Prompt
      </button>
      <button @click="clearPrompt" class="btn btn-secondary">
        清除
      </button>
    </div>

    <div v-else class="no-prompt">
      <p>暂无收到的Prompt</p>
      <p class="hint">当Toolbar发送prompt时，内容将在此处显示</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useAppStore } from '../stores/app'

const appStore = useAppStore()

// 注入全局状态消息方法
const showStatusMessage = inject<(type: 'success' | 'error' | 'warning' | 'info', message: string, autoRemove?: boolean) => string | undefined>('showStatusMessage')

// 获取接收到的prompt
const receivedPrompt = computed(() => appStore.receivedPrompt)

// 格式化时间戳
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}



// 复制prompt到剪贴板
const copyPrompt = async () => {
  if (receivedPrompt.value?.prompt) {
    try {
      await navigator.clipboard.writeText(receivedPrompt.value.prompt)
      // 显示成功提示
      showStatusMessage?.('success', 'Prompt已成功复制到剪贴板！')
      console.log('Prompt已复制到剪贴板')
    } catch (error) {
      console.error('复制失败:', error)
      try {
        // 回退方案：使用传统的复制方法
        const textArea = document.createElement('textarea')
        textArea.value = receivedPrompt.value.prompt
        document.body.appendChild(textArea)
        textArea.select()
        const successful = document.execCommand('copy')
        document.body.removeChild(textArea)
        
        if (successful) {
          // 回退方案成功时也显示成功提示
          showStatusMessage?.('success', 'Prompt已成功复制到剪贴板！')
        } else {
          // 复制失败时显示错误提示
          showStatusMessage?.('error', '复制失败，请手动选择文本进行复制')
        }
      } catch (fallbackError) {
        console.error('回退复制方案也失败:', fallbackError)
        showStatusMessage?.('error', '复制失败，请手动选择文本进行复制')
      }
    }
  } else {
    // 没有prompt内容时的提示
    showStatusMessage?.('warning', '没有可复制的Prompt内容')
  }
}

// 清除prompt
const clearPrompt = () => {
  appStore.clearReceivedPrompt()
}
</script>

<style scoped>
.prompt-display {
  background: #252526;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  border: 1px solid #3e3e42;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.prompt-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 1px solid #3e3e42;
}

.prompt-header h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 18px;
}

.prompt-meta {
  display: flex;
  gap: 10px;
  align-items: center;
}

.source-tag {
  background: #0e639c;
  color: #ffffff;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.timestamp {
  color: #a0aec0;
  font-size: 12px;
}

.prompt-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.prompt-text {
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.prompt-text label,
.prompt-model label,
.prompt-mode label,
.prompt-files label,
.prompt-images label,
.prompt-session label {
  font-weight: 600;
  color: #e2e8f0;
  font-size: 14px;
}

.text-content {
  background: #3c3c3c;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 12px;
  white-space: pre-wrap;
  word-wrap: break-word;
  flex: 1;
  overflow-y: auto;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  color: #e2e8f0;
}



.prompt-model,
.prompt-mode,
.prompt-images {
  display: flex;
  gap: 8px;
  align-items: center;
}

.prompt-model span,
.prompt-mode span,
.prompt-images span {
  color: #a0aec0;
}

.prompt-files ul {
  margin: 0;
  padding-left: 20px;
}

.prompt-files li {
  margin: 4px 0;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  color: #a0aec0;
}

.session-id {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 12px;
  background: #3c3c3c;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #3e3e42;
  color: #a0aec0;
}

.prompt-actions {
  display: flex;
  gap: 10px;
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #3e3e42;
  flex-shrink: 0;
  justify-content: flex-end;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: all 0.2s ease;
  min-width: 100px;
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



.no-prompt {
  text-align: center;
  padding: 40px 20px;
  color: #a0aec0;
}

.no-prompt p {
  margin: 10px 0;
}

.hint {
  font-size: 14px;
  color: #718096;
}
</style> 