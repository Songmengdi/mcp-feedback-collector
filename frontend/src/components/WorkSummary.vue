<template>
  <div class="report-card">
    <div class="card-header">
      <div class="card-title">
        <span>🤖</span>
        AI工作汇报
      </div>
      <div class="card-controls">
        <div class="refresh-status-text">
          {{ refreshStatusText }}
        </div>
        <button 
          class="refresh-btn" 
          @click="handleRefresh" 
          :disabled="isRefreshing"
          title="刷新最新工作汇报"
        >
          <span>{{ isRefreshing ? '刷新中...' : '刷新汇报' }}</span>
        </button>
      </div>
    </div>
    <div class="card-body">
      <!-- 默认状态：等待工作汇报 -->
      <div v-if="!hasWorkSummary" class="default-message">
        <div class="empty-state">
          <ClipboardIcon class="empty-icon" />
          <br><br>
          等待AI工作汇报...
          <br><br>
          <small>当AI调用 collect_feedback() 时，工作汇报内容将显示在这里</small>
          <br><br>
          <button @click="handleRefresh" class="refresh-button">
            <ArrowPathIcon class="btn-icon" />
            手动刷新
          </button>
        </div>
      </div>

      <!-- 有内容状态：显示工作汇报 -->
      <div v-else class="work-summary-content" v-html="formattedWorkSummary"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, inject } from 'vue'
import socketService from '../services/socket'
import { useConnectionStore } from '../stores/connection'
import { useFeedbackStore } from '../stores/feedback'
import { ClipboardIcon, ArrowPathIcon } from '../components/icons'

// Store引用
const feedbackStore = useFeedbackStore()
const connectionStore = useConnectionStore()

// 本地状态
const isRefreshing = ref(false)
const refreshStatusText = ref('')

// 注入全局状态消息方法
const showStatusMessage = inject<(type: string, message: string, autoRemove?: boolean) => string | undefined>('showStatusMessage')

// 计算属性
const hasWorkSummary = computed(() => {
  return feedbackStore.workSummary && feedbackStore.workSummary.trim() !== ''
})

const formattedWorkSummary = computed(() => {
  if (!feedbackStore.workSummary) return ''
  // 将换行符转换为HTML换行
  return feedbackStore.workSummary.replace(/\n/g, '<br>')
})

// 方法
const handleRefresh = () => {
  console.log('手动刷新工作汇报')

  if (!connectionStore.isConnected) {
    if (showStatusMessage) {
      showStatusMessage('error', '连接已断开，请刷新页面重试')
    }
    return
  }

  if (!socketService.getSocket()) {
    if (showStatusMessage) {
      showStatusMessage('error', 'Socket连接未初始化')
    }
    return
  }

  // 设置刷新状态
  isRefreshing.value = true
  refreshStatusText.value = '正在获取最新工作汇报...'

  // 请求最新的工作汇报
  socketService.requestLatestSummary()

  // 5秒后重置状态
  setTimeout(() => {
    isRefreshing.value = false
    refreshStatusText.value = ''
  }, 5000)
}
</script>

<style scoped>
/* 使用原始设计的卡片样式 */
.report-card {
  background-color: #252526;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.card-header {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  color: #ffffff;
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.refresh-status-text {
  font-size: 12px;
  color: #969696;
  min-width: 120px;
  text-align: right;
}

.refresh-btn {
  background: #0e639c;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  white-space: nowrap;
}

.refresh-btn:hover:not(:disabled) {
  background: #1177bb;
}

.refresh-btn:disabled {
  background: #5a5a5a;
  color: #969696;
  cursor: not-allowed;
}

.card-body {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.default-message {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-state {
  text-align: center;
  color: #969696;
  font-size: 14px;
  line-height: 1.6;
}

.empty-icon {
  width: 24px;
  height: 24px;
  display: block;
  margin: 0 auto 16px auto;
  color: #969696;
}

.refresh-button {
  background-color: #0e639c;
  color: #ffffff;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s ease;
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.refresh-button .btn-icon {
  width: 16px;
  height: 16px;
}

.refresh-button:hover {
  background-color: #1177bb;
}

.work-summary-content {
  background-color: #252526;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 20px;
  margin-bottom: 20px;
  max-height: 400px;
  overflow-y: auto;
  color: #cccccc;
  line-height: 1.6;
  font-size: 14px;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 滚动条样式 */
.work-summary-content::-webkit-scrollbar {
  width: 8px;
}

.work-summary-content::-webkit-scrollbar-track {
  background: #1e1e1e;
}

.work-summary-content::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 4px;
}

.work-summary-content::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}
</style>
