<template>
  <div id="app">
    <!-- 主容器 -->
    <div class="container">
      <!-- 工作汇报内容区域 -->
      <div class="content-area">
        <!-- 两栏布局 -->
        <div class="two-column-layout">
          <!-- 左栏：Tab界面 -->
          <div class="left-column">
            <LeftPanelTabs />
          </div>

          <!-- 右栏：用户反馈 -->
          <div class="right-column">
            <SceneSelector />
            <FeedbackForm />
          </div>
        </div>
      </div>
    </div>

    <!-- 全局状态消息组件 -->
    <StatusMessage ref="statusMessageRef" />
    
    <!-- 全局确认对话框组件 -->
    <ConfirmDialog ref="confirmDialogRef" />
    
    <!-- Stagewise开发工具栏 (仅在开发环境显示) -->
    <StagewiseToolbar v-if="isDevelopment" :config="stagewiseConfig" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, provide, ref } from 'vue'
import FeedbackForm from './components/FeedbackForm.vue'
import LeftPanelTabs from './components/LeftPanelTabs.vue'
import StatusMessage from './components/StatusMessage.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import SceneSelector from './components/SceneSelector.vue'
import socketService from './services/socket'
import { useAppStore } from './stores/app'
import { useScenesStore } from './stores/scenes'
import errorHandler from './services/errorHandler'
// @ts-ignore - stagewise可能没有完整的TypeScript定义
import { StagewiseToolbar } from '@stagewise/toolbar-vue'

// stagewise配置
const stagewiseConfig = {
  plugins: []
}

// 是否为开发环境
const isDevelopment = import.meta.env.DEV

const appStore = useAppStore()
const scenesStore = useScenesStore()

// 组件引用
const statusMessageRef = ref<InstanceType<typeof StatusMessage>>()
const confirmDialogRef = ref<InstanceType<typeof ConfirmDialog>>()

// 反馈成功倒计时相关状态
const feedbackSuccessMessageId = ref<string | null>(null)

// 默认提示词加载逻辑已移除，现在使用场景化模式管理



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

// 处理prompt通知事件
const handlePromptNotification = (event: Event) => {
  const customEvent = event as CustomEvent
  const { prompt, sessionId, source, timestamp } = customEvent.detail
  
  showStatusMessage('info', `收到来自${source}的prompt`, true)
  
  console.log('收到prompt通知:', { prompt, sessionId, source, timestamp })
}

// 提供全局状态消息方法
provide('showStatusMessage', showStatusMessage)

// 初始化应用
onMounted(async () => {
  console.log('Vue应用初始化开始')
  
  // 初始化场景数据
  try {
    await scenesStore.loadScenes()
    console.log('场景数据加载完成')
  } catch (error) {
    console.error('场景数据加载失败:', error)
  }
  
  // 设置确认对话框引用到store
  if (confirmDialogRef.value) {
    appStore.setConfirmDialogRef(confirmDialogRef.value)
  }
  
  // 初始化全局错误处理器
  errorHandler.init(showStatusMessage)
  
  // 初始化Socket连接
  socketService.initializeSocket()
  
  // 添加反馈成功相关的事件监听器
  window.addEventListener('showFeedbackSuccess', handleFeedbackSuccess)
  window.addEventListener('updateFeedbackCountdown', handleCountdownUpdate)
  window.addEventListener('closeFeedbackPage', handlePageClose)
  
  // 添加prompt通知事件监听器
  window.addEventListener('showPromptNotification', handlePromptNotification)
  
  console.log('Vue应用初始化完成')
})

// 组件卸载时清理事件监听器
onUnmounted(() => {
  window.removeEventListener('showFeedbackSuccess', handleFeedbackSuccess)
  window.removeEventListener('updateFeedbackCountdown', handleCountdownUpdate)
  window.removeEventListener('closeFeedbackPage', handlePageClose)
  window.removeEventListener('showPromptNotification', handlePromptNotification)
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



.two-column-layout {
  display: flex;
  gap: 20px;
  flex: 1;
  align-items: stretch;
  overflow: hidden;
  min-height: 0;
  /* 确保两栏高度一致 */
  height: 100%;
}

.left-column,
.right-column {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  height: 100%;
  /* 设置最小高度确保两栏高度一致 */
  min-height: 600px;
}

.right-column {
  gap: 12px; /* 组件间距 */
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
