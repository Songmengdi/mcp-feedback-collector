<template>
  <!-- 反馈模式选择区域 -->
  <div class="phrase-mode-section">
    <!-- 场景选择区域 -->
    <div class="scene-selection-section">
      <div class="scene-header">
        <span class="scene-label">工作场景</span>
        <button type="button" class="scene-manage-btn" @click="openSceneManagement" :disabled="isLoading">
          <span v-if="isLoading">⏳</span>
          <span v-else>⚙️</span>
          管理场景
        </button>
      </div>
      
      <!-- 场景选择下拉框 -->
      <div class="scene-selector">
        <select 
          v-model="selectedSceneId" 
          @change="onSceneChange"
          class="scene-select"
          :disabled="isLoading || scenesLoading"
        >
          <option v-if="scenesLoading" value="">加载场景中...</option>
          <option v-else-if="!hasScenes" value="">暂无可用场景</option>
          <option 
            v-else
            v-for="scene in sceneOptions" 
            :key="scene.value"
            :value="scene.value"
          >
            {{ scene.label }}
          </option>
        </select>
        <div v-if="currentScene" class="scene-description">
          {{ currentScene.description }}
        </div>
      </div>
    </div>

    <!-- 模式选择区域 -->
    <div class="phrase-mode-header">
      <span class="phrase-mode-label">反馈模式</span>
      <button type="button" class="custom-btn" @click="showEditor" :disabled="isLoading">
        <span v-if="isLoading">⏳</span>
        <span v-else>⚙️</span>
        自定义提示
      </button>
    </div>
    
    <!-- 模式选择按钮组 -->
    <div class="mode-buttons">
      <button 
        v-for="mode in availableModes" 
        :key="mode.id"
        type="button" 
        class="mode-btn" 
        :class="{ active: currentModeId === mode.id }"
        @click="selectMode(mode.id)"
        :title="mode.shortcut ? `快捷键: ${shortcutPrefix}+${mode.shortcut}` : mode.description"
        :disabled="!mode.id"
      >
        <span class="mode-label">
          {{ mode.name }}
          <span v-if="mode.shortcut" class="mode-shortcut">{{ shortcutPrefix }}+{{ mode.shortcut }}</span>
        </span>
      </button>
    </div>
    
    <div class="mode-hint">
      <span class="hint-icon">💡</span>
      <span class="hint-text">{{ currentHintText }}</span>
    </div>

    <!-- 快捷语编辑器模态框 -->
    <div v-if="showModal" class="modal" @click="handleModalClick">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ currentModalTitle }}</h3>
          <button type="button" class="modal-close" @click="hideEditor">×</button>
        </div>
        <div class="modal-body">

          <textarea 
            v-model="customPhrase" 
            class="form-textarea" 
            rows="8" 
            placeholder="输入自定义的快捷语内容..."
            :disabled="isLoading"
          ></textarea>
          <div class="quick-phrase-hint">
            将使用 &#123;&#123; feedback &#125;&#125; 替换用户输入的反馈，如果提示词中没有 &#123;&#123; feedback &#125;&#125; 就默认添加在顶部
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="resetToDefault" :disabled="isLoading">
            <span v-if="isLoading">⏳</span>
            恢复默认
          </button>
          <button type="button" class="btn btn-primary" @click="savePhrase" :disabled="isLoading">
            <span v-if="isLoading">⏳</span>
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useAppStore } from '../stores/app'
import { useScenesStore } from '../stores/scenes'
import type { PhraseModeType } from '../types/app'
import promptService from '../services/promptService'

// Store引用
const appStore = useAppStore()
const scenesStore = useScenesStore()

// 本地状态
const showModal = ref(false)
const customPhrase = ref('')
const isLoading = ref(false)


// 场景选择状态
const selectedSceneId = ref('')

// 计算属性 - 场景相关
const scenesLoading = computed(() => scenesStore.loading)
const hasScenes = computed(() => scenesStore.hasScenes)
const sceneOptions = computed(() => scenesStore.sceneOptions)
const currentScene = computed(() => scenesStore.currentScene)
const currentSelection = computed(() => scenesStore.currentSelection)
const availableModes = computed(() => {
  if (scenesStore.hasModes) {
    return scenesStore.currentSceneModes
  }
  // 向后兼容：如果没有场景模式，使用传统模式
  return [
    { id: 'discuss', name: '探讨', description: '探讨模式：自动附加深入分析和建议的提示词', shortcut: '1' },
    { id: 'edit', name: '编辑', description: '编辑模式：自动附加代码修改和优化的提示词', shortcut: '2' },
    { id: 'search', name: '搜索', description: '搜索模式：自动附加信息查找和解决方案的提示词', shortcut: '3' }
  ]
})

// 计算属性 - 模式相关
const currentModeId = computed(() => {
  // 优先使用场景化选择
  if (scenesStore.hasScenes) {
    return currentSelection.value.modeId
  }
  // 向后兼容传统模式
  return appStore.currentPhraseMode
})

const currentMode = computed(() => {
  return availableModes.value.find(mode => mode.id === currentModeId.value)
})

const currentModalTitle = computed(() => {
  if (currentScene.value && currentMode.value) {
    return `${currentScene.value.name} - ${currentMode.value.name} - 自定义提示词`
  }
  return `${currentMode.value?.name || '未知模式'} - 自定义提示词`
})

const currentHintText = computed(() => {
  if (currentMode.value?.description) {
    return currentMode.value.description
  }
  // 向后兼容的默认提示
  const hints = {
    discuss: '探讨模式：自动附加深入分析和建议的提示词',
    edit: '编辑模式：自动附加代码修改和优化的提示词', 
    search: '搜索模式：自动附加信息查找和解决方案的提示词'
  }
  return hints[currentModeId.value as PhraseModeType] || '当前模式的描述信息'
})

const shortcutPrefix = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '⌘' : 'Ctrl'
})

// 方法 - 场景管理
const onSceneChange = async () => {
  if (selectedSceneId.value && selectedSceneId.value !== currentSelection.value.sceneId) {
    await scenesStore.switchToScene(selectedSceneId.value)
    // 同步更新传统模式状态
    appStore.setCurrentPhraseMode(currentSelection.value.modeId)
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

// 方法 - 模式选择
const selectMode = async (modeId: string) => {
  if (scenesStore.hasScenes) {
    // 场景化模式切换
    scenesStore.switchToMode(modeId)
  } else {
    // 传统模式切换
    appStore.setCurrentPhraseMode(modeId as PhraseModeType)
  }
}

// 方法 - 编辑器管理
const showEditor = async () => {
  try {
    isLoading.value = true
    
    // 加载当前模式的快捷语内容
    customPhrase.value = await getCustomQuickPhrase()
    showModal.value = true
    
    // 延迟聚焦到文本区域，确保模态框完全显示后再聚焦
    setTimeout(() => {
      const textarea = document.querySelector('.modal .form-textarea') as HTMLTextAreaElement
      if (textarea) {
        textarea.focus()
        // 将光标移到文本末尾
        textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      }
    }, 100)
  } catch (error) {
    // 错误已通过全局错误处理器显示
  } finally {
    isLoading.value = false
  }
}

const hideEditor = () => {
  showModal.value = false
}

const handleModalClick = (e: Event) => {
  if (e.target === e.currentTarget) {
    hideEditor()
  }
}

const getCustomQuickPhrase = async (): Promise<string> => {
  try {
    // 使用场景化API获取提示词
    const prompt = await promptService.getUnifiedPrompt(currentSelection.value)
    return prompt
  } catch (error) {
    // 错误已通过全局错误处理器显示，网络错误时回退到默认提示词
    return currentMode.value?.description || '默认提示词'
  }
}

const savePhrase = async () => {
  try {
    isLoading.value = true
    
    // 使用场景化API保存提示词
    await promptService.saveUnifiedPrompt(currentSelection.value, customPhrase.value)
    
    showStatusMessage('success', '快捷语已保存')
    hideEditor()
  } catch (error) {
    // 错误已通过全局错误处理器显示
  } finally {
    isLoading.value = false
  }
}

const resetToDefault = async () => {
  try {
    isLoading.value = true
    
    // 场景化模式的重置
    const { sceneId, modeId } = currentSelection.value;
    
    // 删除自定义提示词，回退到默认提示词
    await promptService.saveUnifiedPrompt({ sceneId, modeId }, '');
    
    customPhrase.value = await getCustomQuickPhrase()
    showStatusMessage('info', '已恢复为默认快捷语')
  } catch (error) {
    // 错误已通过全局错误处理器显示
    
    // 重置失败时至少更新为本地默认值
    customPhrase.value = currentMode.value?.description || '默认提示词'
  } finally {
    isLoading.value = false
  }
}

// 显示状态消息（临时实现）
const showStatusMessage = (type: string, message: string) => {
  console.log(`[${type.toUpperCase()}] ${message}`)
  // TODO: 集成StatusMessage组件
}

// 生命周期
onMounted(async () => {
  // 初始化加载场景数据
  if (!scenesStore.hasScenes) {
    try {
      await scenesStore.loadScenes()
    } catch (error) {
      // 错误已通过全局错误处理器显示
    }
  }
  
  // 同步当前选择状态
  selectedSceneId.value = currentSelection.value.sceneId
})

// 监听器
watch(currentSelection, (newSelection) => {
  selectedSceneId.value = newSelection.sceneId
  // 同步更新传统模式状态
  appStore.setCurrentPhraseMode(newSelection.modeId)
}, { deep: true })

watch(currentModeId, async () => {
  if (showModal.value) {
    try {
      isLoading.value = true
      customPhrase.value = await getCustomQuickPhrase()
    } catch (error) {
      // 错误已通过全局错误处理器显示
      customPhrase.value = currentMode.value?.description || '默认提示词'
    } finally {
      isLoading.value = false
    }
  }
})
</script>

<style scoped>
.phrase-mode-section {
  margin-top: 16px;
}

/* 场景选择区域样式 */
.scene-selection-section {
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid #3e3e42;
}

.scene-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.scene-label {
  font-size: 14px;
  font-weight: 500;
  color: #cccccc;
}

.scene-manage-btn {
  padding: 4px 8px;
  border: 1px solid #007acc;
  border-radius: 3px;
  background: transparent;
  color: #007acc;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
}

.scene-manage-btn:hover {
  background: #007acc;
  color: white;
}

.scene-manage-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scene-manage-btn:disabled:hover {
  background: transparent;
  color: #007acc;
}

.scene-selector {
  margin-bottom: 8px;
}

.scene-select {
  width: 100%;
  padding: 8px 12px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.2s ease;
}

.scene-select:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 1px #007acc;
}

.scene-select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.scene-description {
  font-size: 11px;
  color: #969696;
  margin-top: 6px;
  line-height: 1.4;
  padding-left: 4px;
}

/* 原有样式保持不变 */
.phrase-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.phrase-mode-label {
  font-size: 14px;
  font-weight: 500;
  color: #cccccc;
}

.custom-btn {
  padding: 4px 8px;
  border: 1px solid #007acc;
  border-radius: 3px;
  background: transparent;
  color: #007acc;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: all 0.2s ease;
}

.custom-btn:hover {
  background: #007acc;
  color: white;
}

.custom-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.custom-btn:disabled:hover {
  background: transparent;
  color: #007acc;
}

/* 模式选择按钮组 */
.mode-buttons {
  display: flex;
  gap: 0;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 2px;
  margin-bottom: 12px;
}

.mode-btn {
  flex: 1;
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: #cccccc;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.mode-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.mode-label {
  font-size: 12px;
  font-weight: 500;
}

.mode-shortcut {
  font-size: 9px;
  opacity: 0.7;
  font-weight: 400;
}

.mode-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.mode-btn:hover:not(:disabled) .mode-shortcut {
  opacity: 1;
}

.mode-btn.active {
  background: #007acc;
  color: #ffffff;
}

.mode-btn.active .mode-shortcut {
  opacity: 0.9;
}

.mode-btn.active:hover {
  background: #005a9e;
}

.mode-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
  color: #969696;
  line-height: 1.4;
  padding: 6px 0;
}

.hint-icon {
  margin-top: 1px;
}

.hint-text {
  flex: 1;
}

/* 模态框样式保持不变 */
.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  width: 95%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #cccccc;
}

.modal-close {
  background: none;
  border: none;
  color: #cccccc;
  font-size: 20px;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.1);
}

.modal-body {
  padding: 24px 28px;
  overflow-y: auto;
  flex: 1;
}



.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  background: #2d2d30;
  border-top: 1px solid #3e3e42;
}

.form-textarea {
  width: 100%;
  min-height: 350px;
  padding: 16px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  font-size: 14px;
  line-height: 1.6;
  resize: none;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  margin-bottom: 12px;
}

.form-textarea:focus {
  outline: none;
  border-color: #007acc;
  box-shadow: 0 0 0 1px #007acc;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary {
  background: #3e3e42;
  color: #cccccc;
}

.btn-secondary:hover {
  background: #4a4a4f;
}

.btn-primary {
  background: #007acc;
  color: white;
}

.btn-primary:hover {
  background: #005a9e;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn:disabled:hover {
  background: inherit;
}

.quick-phrase-hint {
  font-size: 12px;
  color: #969696;
  line-height: 1.5;
  padding: 8px 12px;
  background: #1e1e1e;
  border-radius: 4px;
  border-left: 3px solid #007acc;
}

/* 响应式适配 */
@media (min-width: 1200px) {
  .modal-content {
    max-width: 1100px;
  }
  
  .form-textarea {
    min-height: 400px;
    font-size: 15px;
  }
}

@media (max-width: 768px) {
  .modal-content {
    width: 98%;
    max-width: none;
    max-height: 95vh;
    margin: 0 auto;
  }
  
  .modal-body {
    padding: 16px 20px;
  }
  
  .form-textarea {
    min-height: 280px;
    font-size: 16px;
    padding: 12px;
  }
  
  .modal-header {
    padding: 12px 16px;
  }
  
  .modal-footer {
    padding: 12px 16px;
  }
}

@media (max-width: 480px) {
  .modal-content {
    width: 100%;
    height: 100vh;
    max-height: 100vh;
    border-radius: 0;
  }
  
  .form-textarea {
    min-height: 250px;
  }
  
  .scene-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
  
  .scene-manage-btn {
    align-self: flex-end;
  }
}
</style>
