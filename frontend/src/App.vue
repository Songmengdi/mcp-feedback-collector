<template>
  <div id="app">
    <!-- 主容器 -->
    <div class="container">
      <!-- 工作汇报内容区域 -->
      <div class="content-area">
        <!-- 工作汇报控制栏 -->
        <div class="report-controls">
          <button 
            class="refresh-btn" 
            @click="refreshWorkSummary" 
            :disabled="isRefreshing"
            title="刷新最新工作汇报"
          >
            <span>{{ isRefreshing ? '刷新中...' : '刷新最新汇报' }}</span>
          </button>
          <div class="control-right">
            <!-- 状态文字显示 -->
            <div class="refresh-status-text">
              {{ refreshStatusText }}
            </div>
            <!-- 连接状态 -->
            <div 
              class="connection-status" 
              :class="{ connected: connectionStore.isConnected, disconnected: !connectionStore.isConnected }"
            >
              {{ connectionStore.connectionStatus }}
            </div>
          </div>
        </div>

        <!-- 两栏布局 -->
        <div class="two-column-layout">
          <!-- 左栏：AI工作汇报 -->
          <div class="left-column">
            <WorkSummary />
          </div>

          <!-- 右栏：用户反馈 -->
          <div class="right-column">
            <FeedbackForm />
          </div>
        </div>
      </div>
    </div>

    <!-- 全局状态消息组件 -->
    <StatusMessage ref="statusMessageRef" />
    
    <!-- Stagewise开发工具栏 (仅在开发环境显示) -->
    <StagewiseToolbar v-if="isDevelopment" :config="stagewiseConfig" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import FeedbackForm from './components/FeedbackForm.vue'
import StatusMessage from './components/StatusMessage.vue'
import WorkSummary from './components/WorkSummary.vue'
import socketService from './services/socket'
import { useAppStore } from './stores/app'
import { useConnectionStore } from './stores/connection'
// @ts-ignore - stagewise可能没有完整的TypeScript定义
import { StagewiseToolbar } from '@stagewise/toolbar-vue'

// stagewise配置
const stagewiseConfig = {
  plugins: []
}

// 是否为开发环境
const isDevelopment = import.meta.env.DEV

// Store引用
const connectionStore = useConnectionStore()
const appStore = useAppStore()

// 组件引用
const statusMessageRef = ref<InstanceType<typeof StatusMessage>>()

// 本地状态
const isRefreshing = ref(false)
const refreshStatusText = ref('')

// 反馈成功倒计时相关状态
const feedbackSuccessMessageId = ref<string | null>(null)

// 加载默认提示词
const loadDefaultPhrases = async () => {
  try {
    const modes = ['discuss', 'edit', 'search']
    const phrases: Record<string, string> = {}
    
    for (const mode of modes) {
      const response = await fetch(`/prompts/${mode}.txt`)
      if (response.ok) {
        phrases[mode] = await response.text()
      } else {
        console.warn(`无法加载 ${mode} 模式的默认提示词`)
        // 如果文件加载失败，使用备用的默认内容
        phrases[mode] = `\n\n---\n请基于以上工作内容提供${mode === 'discuss' ? '深入探讨和分析' : mode === 'edit' ? '具体修改建议' : '相关信息查找'}。`
      }
    }
    
    appStore.setDefaultPhrases(phrases)
    console.log('默认提示词加载完成:', phrases)
  } catch (error) {
    console.error('加载默认提示词失败:', error)
    // 使用备用的默认内容
    const fallbackPhrases = {
      discuss: '\n\n---\n请基于以上工作内容进行深入探讨和分析，提供建设性的意见和建议。',
      edit: '\n\n---\n请基于以上工作内容提供具体的修改建议，包括代码优化、功能改进等方面的指导。',
      search: '\n\n---\n请基于以上工作内容帮助我查找相关信息、解决方案或最佳实践。'
    }
    appStore.setDefaultPhrases(fallbackPhrases)
  }
}

// 刷新工作汇报
const refreshWorkSummary = () => {
  if (!connectionStore.isConnected) {
    showStatusMessage('error', '连接已断开，请刷新页面重试')
    return
  }

  isRefreshing.value = true
  refreshStatusText.value = '正在获取最新工作汇报...'
  
  socketService.requestLatestSummary()

  // 5秒后重置状态
  setTimeout(() => {
    isRefreshing.value = false
    refreshStatusText.value = ''
  }, 5000)
}

// 显示状态消息
const showStatusMessage = (type: 'success' | 'error' | 'warning' | 'info', message: string, autoRemove = true) => {
  return statusMessageRef.value?.showMessage(type, message, autoRemove)
}

// 处理反馈成功事件
const handleFeedbackSuccess = (event: Event) => {
  const customEvent = event as CustomEvent
  const { countdown } = customEvent.detail
  const messageId = showStatusMessage('success', `反馈提交成功！感谢您的宝贵意见。页面将在 ${countdown} 秒后自动关闭...`, false)
  feedbackSuccessMessageId.value = messageId || null
}

// 处理倒计时更新事件
const handleCountdownUpdate = (event: Event) => {
  const customEvent = event as CustomEvent
  const { countdown } = customEvent.detail
  if (feedbackSuccessMessageId.value && statusMessageRef.value) {
    statusMessageRef.value.updateMessage(feedbackSuccessMessageId.value, `反馈提交成功！感谢您的宝贵意见。页面将在 ${countdown} 秒后自动关闭...`)
  }
}

// 处理页面关闭事件
const handlePageClose = () => {
  if (feedbackSuccessMessageId.value && statusMessageRef.value) {
    statusMessageRef.value.updateMessage(feedbackSuccessMessageId.value, '反馈提交成功！正在关闭页面...')
  }
}

// 提供全局状态消息方法
provide('showStatusMessage', showStatusMessage)

// 初始化应用
onMounted(async () => {
  console.log('Vue应用初始化开始')
  
  // 加载默认提示词
  await loadDefaultPhrases()
  
  // 初始化快捷语模式
  appStore.setCurrentPhraseMode('discuss')
  
  // 初始化Socket连接
  socketService.initializeSocket()
  
  // 添加反馈成功相关的事件监听器
  window.addEventListener('showFeedbackSuccess', handleFeedbackSuccess)
  window.addEventListener('updateFeedbackCountdown', handleCountdownUpdate)
  window.addEventListener('closeFeedbackPage', handlePageClose)
  
  console.log('Vue应用初始化完成')
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  window.removeEventListener('showFeedbackSuccess', handleFeedbackSuccess)
  window.removeEventListener('updateFeedbackCountdown', handleCountdownUpdate)
  window.removeEventListener('closeFeedbackPage', handlePageClose)
})
</script>

<style>
/* 全局样式 - 参考原始设计 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  background-color: #1e1e1e;
  color: #cccccc;
  line-height: 1.6;
  height: 100vh;
  overflow: hidden;
  box-sizing: border-box;
}

#app {
  height: 100%;
}

.container {
  max-width: none;
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.content-area {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.report-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  margin-bottom: 16px;
  border-bottom: 1px solid #3e3e42;
  min-height: 44px;
}

.refresh-btn {
  background: #0e639c;
  color: white;
  border: none;
  padding: 10px 16px;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s ease;
  display: flex;
  align-items: center;
  height: 40px;
}

.refresh-btn:hover:not(:disabled) {
  background: #1177bb;
}

.refresh-btn:disabled {
  background: #5a5a5a;
  color: #969696;
  cursor: not-allowed;
}

.control-right {
  display: flex;
  align-items: center;
  gap: 16px;
  height: 100%;
}

.refresh-status-text {
  font-size: 12px;
  color: #969696;
}

.connection-status {
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  z-index: 1000;
  display: flex;
  align-items: center;
  height: 32px;
}

.connection-status.connected {
  background-color: #0e639c;
  color: #ffffff;
}

.connection-status.disconnected {
  background-color: #f14c4c;
  color: #ffffff;
}

.two-column-layout {
  display: flex;
  gap: 20px;
  flex: 1;
  align-items: stretch;
  overflow: hidden;
}

.left-column,
.right-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 响应式设计 */
@media (max-width: 1024px) {
  .two-column-layout {
    flex-direction: column;
    gap: 16px;
  }
  
  .control-right {
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
}

@media (max-width: 768px) {
  body {
    padding: 10px;
  }

  .report-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .control-right {
    justify-content: space-between;
  }
}

/* 滚动条样式 */
::-webkit-scrollbar {
  width: 14px;
}

::-webkit-scrollbar-track {
  background: #1e1e1e;
}

::-webkit-scrollbar-thumb {
  background: #424242;
  border-radius: 7px;
  border: 3px solid #1e1e1e;
}

::-webkit-scrollbar-thumb:hover {
  background: #4f4f4f;
}
</style>
