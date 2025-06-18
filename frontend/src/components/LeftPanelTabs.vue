<template>
  <div class="left-panel-tabs">
    <!-- Tab头部 -->
    <div class="tab-header">
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'work-summary' }"
        @click="activeTab = 'work-summary'"
        title="AI工作汇报"
      >
        🤖
      </button>
      <button 
        v-if="appStore.receivedPrompt"
        class="tab-button"
        :class="{ active: activeTab === 'prompt' }"
        @click="activeTab = 'prompt'"
        title="收到的Prompt"
      >
        📝
      </button>
      <button 
        class="tab-button"
        :class="{ active: activeTab === 'scene-management' }"
        @click="activeTab = 'scene-management'"
        title="场景管理"
      >
        🎭
      </button>
    </div>

    <!-- Tab内容 -->
    <div class="tab-content">
      <!-- AI工作汇报Tab -->
      <div v-if="activeTab === 'work-summary'" class="tab-pane">
        <WorkSummary />
      </div>
      
      <!-- Prompt显示Tab -->
      <div v-if="activeTab === 'prompt' && appStore.receivedPrompt" class="tab-pane">
        <PromptDisplay />
      </div>
      
      <!-- 场景管理Tab -->
      <div v-if="activeTab === 'scene-management'" class="tab-pane">
        <SceneManagement />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useAppStore } from '../stores/app'
import PromptDisplay from './PromptDisplay.vue'
import WorkSummary from './WorkSummary.vue'
import SceneManagement from './SceneManagement.vue'

// Store引用
const appStore = useAppStore()

// Tab状态管理
const activeTab = ref<'work-summary' | 'prompt' | 'scene-management'>('work-summary')

// 监听prompt状态变化
watch(
  () => appStore.receivedPrompt,
  (newPrompt, oldPrompt) => {
    // 首次收到prompt时自动跳转到prompt Tab
    if (newPrompt && !oldPrompt) {
      activeTab.value = 'prompt'
    }
    // 当prompt被清除时切换回AI工作汇报Tab
    else if (!newPrompt && activeTab.value === 'prompt') {
      activeTab.value = 'work-summary'
    }
  }
)

// 处理场景管理跳转事件
const handleOpenSceneManagement = () => {
  activeTab.value = 'scene-management'
}

// 生命周期
onMounted(() => {
  document.addEventListener('openSceneManagement', handleOpenSceneManagement)
})

onUnmounted(() => {
  document.removeEventListener('openSceneManagement', handleOpenSceneManagement)
})
</script>

<style scoped>
.left-panel-tabs {
  display: flex;
  flex-direction: row;
  height: 100%;
}

.tab-header {
  display: flex;
  flex-direction: column;
  background-color: #1e1e1e;
  border-right: 1px solid #3e3e42;
  flex-shrink: 0;
  width: 50px;
}

.tab-button {
  background: none;
  border: none;
  color: #cccccc;
  padding: 16px 8px;
  cursor: pointer;
  font-size: 18px;
  font-weight: 500;
  transition: all 0.2s ease;
  border-right: 3px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 50px;
  position: relative;
}

.tab-button:hover {
  background-color: #2d2d30;
  color: #ffffff;
}

.tab-button.active {
  color: #ffffff;
  background-color: #252526;
  border-right-color: #0e639c;
}

.tab-button:hover {
  background-color: #2d2d30;
  color: #ffffff;
}

.tab-button[title]:hover::after {
  content: attr(title);
  position: absolute;
  left: 60px;
  top: 50%;
  transform: translateY(-50%);
  background: #2d2d30;
  color: #ffffff;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  z-index: 1000;
  border: 1px solid #3e3e42;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.tab-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.tab-pane {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style> 