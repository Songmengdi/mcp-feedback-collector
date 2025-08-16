<template>
  <div class="scene-selector-card">
    <div class="scene-header">
      <div class="scene-title">
        <SparklesIcon class="scene-icon" />
        <span class="scene-label">工作场景</span>
      </div>
      <div class="scene-header-right">
        <div 
          class="connection-status" 
          :class="{ connected: connectionStore.isConnected, disconnected: !connectionStore.isConnected }"
          :title="connectionStore.connectionStatus"
        >
          <div v-if="connectionStore.isConnected" class="status-dot connected"></div>
          <div v-else class="status-dot disconnected"></div>
        </div>
        <button 
          type="button" 
          class="scene-manage-btn" 
          @click="openSceneManagement" 
          :disabled="isLoading"
          title="管理场景设置"
        >
          <div v-if="isLoading" class="loading-spinner"></div>
          <Cog6ToothIcon v-else class="btn-icon" />
          <span class="btn-text">管理场景</span>
        </button>
      </div>
    </div>
    
    <!-- 场景选择区域 -->
    <div class="scene-selection">
      <!-- 自定义下拉选择器 -->
      <div class="custom-select" :class="{ disabled: isLoading || scenesLoading, open: dropdownOpen }">
        <div 
          class="select-trigger" 
          @click="toggleDropdown"
          :tabindex="isLoading || scenesLoading ? -1 : 0"
          @keydown.enter="toggleDropdown"
          @keydown.space.prevent="toggleDropdown"
          @keydown.escape="closeDropdown"
        >
          <div class="selected-option">
            <div class="option-main">
              <span v-if="scenesLoading" class="loading-text">加载场景中...</span>
              <span v-else-if="!hasScenes" class="empty-text">暂无可用场景</span>
              <span v-else class="scene-name">{{ currentScene?.name || '请选择场景' }}</span>
            </div>
            <div v-if="currentScene?.description" class="option-description">
              {{ currentScene.description }}
            </div>
          </div>
          <div class="select-arrow" :class="{ rotated: dropdownOpen }">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
              <path d="M2 4l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
        </div>
        
        <!-- 下拉选项 -->
        <div v-if="dropdownOpen && !scenesLoading && hasScenes" class="select-dropdown">
          <div 
            v-for="scene in sceneOptions" 
            :key="scene.value"
            class="select-option"
            :class="{ active: selectedSceneId === scene.value }"
            @click="selectScene(scene.value)"
            @keydown.enter="selectScene(scene.value)"
            tabindex="0"
          >
            <div class="option-main">
              <span class="scene-name">{{ scene.label }}</span>
              <span v-if="scene.isDefault" class="default-badge">默认</span>
            </div>
            <div v-if="scene.description" class="option-description">
              {{ scene.description }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useScenesStore } from '../stores/scenes'
import { useConnectionStore } from '../stores/connection'
import { SparklesIcon, Cog6ToothIcon } from '../components/icons'

// Store引用
const scenesStore = useScenesStore()
const connectionStore = useConnectionStore()

// 本地状态
const isLoading = ref(false)
const dropdownOpen = ref(false)
const selectedSceneId = ref('')

// 计算属性
const scenesLoading = computed(() => scenesStore.loading)
const hasScenes = computed(() => scenesStore.hasScenes)
const sceneOptions = computed(() => {
  return scenesStore.sceneOptions.map(option => ({
    ...option,
    description: scenesStore.scenes.find(s => s.id === option.value)?.description || '',
    isDefault: scenesStore.scenes.find(s => s.id === option.value)?.isDefault || false
  }))
})
const currentScene = computed(() => scenesStore.currentScene)
const currentSelection = computed(() => scenesStore.currentSelection)

// 方法
const toggleDropdown = () => {
  if (isLoading.value || scenesLoading.value || !hasScenes.value) return
  dropdownOpen.value = !dropdownOpen.value
}

const closeDropdown = () => {
  dropdownOpen.value = false
}

const selectScene = async (sceneId: string) => {
  if (isLoading.value || sceneId === selectedSceneId.value) return
  
  isLoading.value = true
  selectedSceneId.value = sceneId
  
  try {
    await scenesStore.switchToScene(sceneId)
  } catch (error) {
    console.error('场景切换失败:', error)
  } finally {
    isLoading.value = false
    closeDropdown()
  }
}

const openSceneManagement = () => {
  // 触发自定义事件，通知父组件切换到场景管理标签页
  const event = new CustomEvent('openSceneManagement', {
    bubbles: true,
    detail: { action: 'open-scene-management' }
  })
  document.dispatchEvent(event)
}

// 点击外部关闭下拉框
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as Element
  const selectElement = document.querySelector('.custom-select')
  if (selectElement && !selectElement.contains(target)) {
    closeDropdown()
  }
}

// 监听场景变化，同步选中状态
watch(currentSelection, (newSelection) => {
  if (newSelection.sceneId !== selectedSceneId.value) {
    selectedSceneId.value = newSelection.sceneId
  }
}, { immediate: true })

// 生命周期
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  // 初始化选中状态
  selectedSceneId.value = currentSelection.value.sceneId
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<style scoped>
.scene-selector-card {
  background-color: #252526;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 0; /* 移除margin，使用父容器gap */
  flex-shrink: 0; /* 防止压缩 */
  max-height: 140px; /* 压缩高度 */
}

.scene-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.scene-header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.connection-status {
  display: flex;
  align-items: center;
  font-size: 12px;
  cursor: help;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.connected {
  background-color: #22c55e;
}

.status-dot.disconnected {
  background-color: #ef4444;
}

.scene-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
}

.scene-icon {
  width: 18px;
  height: 18px;
  color: #007acc;
}

.scene-label {
  font-size: 16px;
}

.scene-manage-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid #007acc;
  border-radius: 4px;
  background: transparent;
  color: #007acc;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s ease;
}

.scene-manage-btn:hover:not(:disabled) {
  background: #007acc;
  color: white;
}

.scene-manage-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-text {
  font-weight: 500;
}

.btn-icon {
  width: 14px;
  height: 14px;
}

.loading-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid #3e3e42;
  border-top: 2px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.scene-selection {
  position: relative;
}

.custom-select {
  position: relative;
  width: 100%;
}

.custom-select.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  color: #cccccc;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: 60px;
}

.select-trigger:hover {
  border-color: #007acc;
}

.select-trigger:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2);
}

.custom-select.open .select-trigger {
  border-color: #007acc;
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
}

.selected-option {
  flex: 1;
  text-align: left;
}

.option-main {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.scene-name {
  font-size: 14px;
  font-weight: 500;
  color: #ffffff;
}

.loading-text, .empty-text {
  font-size: 14px;
  color: #969696;
  font-style: italic;
}

.option-description {
  font-size: 12px;
  color: #969696;
  line-height: 1.3;
  margin-top: 2px;
}

.default-badge {
  background: #007acc;
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.select-arrow {
  color: #969696;
  transition: transform 0.2s ease;
  margin-left: 8px;
}

.select-arrow.rotated {
  transform: rotate(180deg);
}

.select-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: #1e1e1e;
  border: 1px solid #007acc;
  border-top: none;
  border-bottom-left-radius: 6px;
  border-bottom-right-radius: 6px;
  max-height: 200px;
  overflow-y: auto;
  /* z-index层级规范: 下拉菜单 100-499, 悬浮面板/侧边栏 500-999, 模态框 2000+ */
  z-index: 400;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.select-option {
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid #3e3e42;
}

.select-option:last-child {
  border-bottom: none;
}

.select-option:hover {
  background: rgba(0, 122, 204, 0.1);
}

.select-option:focus {
  outline: none;
  background: rgba(0, 122, 204, 0.2);
}

.select-option.active {
  background: rgba(0, 122, 204, 0.15);
}

.select-option .scene-name {
  color: #cccccc;
}

.select-option:hover .scene-name,
.select-option.active .scene-name {
  color: #ffffff;
}

/* 滚动条样式 */
.select-dropdown::-webkit-scrollbar {
  width: 6px;
}

.select-dropdown::-webkit-scrollbar-track {
  background: #2d2d30;
}

.select-dropdown::-webkit-scrollbar-thumb {
  background: #5a5a5a;
  border-radius: 3px;
}

.select-dropdown::-webkit-scrollbar-thumb:hover {
  background: #6e6e6e;
}
</style> 