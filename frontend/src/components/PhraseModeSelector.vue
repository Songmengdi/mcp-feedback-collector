<template>
  <!-- 反馈模式选择区域 -->
  <div class="phrase-mode-section">
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
        <span class="mode-label">{{ mode.name }}</span>
        <span v-if="mode.shortcut" class="mode-shortcut">{{ shortcutPrefix }}+{{ mode.shortcut }}</span>
        <span v-else class="mode-shortcut">无快捷键</span>
      </button>
    </div>
    
    <div class="mode-hint">
      <LightBulbIcon class="hint-icon" />
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
import shortcutService from '../services/shortcutService'
import { LightBulbIcon } from '../components/icons'

// Store引用
const appStore = useAppStore()
const scenesStore = useScenesStore()

// 本地状态
const showModal = ref(false)
const customPhrase = ref('')
const isLoading = ref(false)


// 计算属性 - 模式相关
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

const currentSelection = computed(() => scenesStore.currentSelection)

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
  const currentScene = scenesStore.currentScene
  if (currentScene && currentMode.value) {
    return `${currentScene.name} - ${currentMode.value.name} - 自定义提示词`
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
    console.log('[PhraseModeSelector] 获取自定义提示词，当前选择:', {
      sceneId: currentSelection.value.sceneId,
      modeId: currentSelection.value.modeId,
      sceneName: scenesStore.currentScene?.name,
      modeName: currentMode.value?.name
    })
    
    // 使用场景化API获取提示词
    const prompt = await promptService.getUnifiedPrompt(currentSelection.value)
    
    console.log('[PhraseModeSelector] 成功获取提示词，长度:', prompt.length)
    return prompt
  } catch (error) {
    console.error('[PhraseModeSelector] 获取提示词失败:', error)
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
  
  // 确保快捷键服务已初始化（只在这里初始化一次，避免与FeedbackForm重复）
  // shortcutService.init() // 注释掉，由FeedbackForm统一初始化
  
  // 监听场景模式变化，更新快捷键绑定
  const updateShortcutBindings = () => {
    if (scenesStore.hasModes && scenesStore.currentSceneModes.length > 0) {
      shortcutService.updateBindings(scenesStore.currentSceneModes)
    }
  }
  
  // 等待场景数据加载完成后再初始化快捷键绑定
  if (scenesStore.hasModes && scenesStore.currentSceneModes.length > 0) {
    updateShortcutBindings()
  }
  
  // 监听模式变化
  scenesStore.$subscribe(() => {
    updateShortcutBindings()
  })
})

// 监听器
watch(currentSelection, (newSelection) => {
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
  margin-top: 8px; /* 减少上边距 */
  flex-shrink: 0; /* 防止被压缩 */
}

/* 模式选择样式 */
.phrase-mode-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px; /* 减少下边距 */
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
  padding: 1px; /* 减少内边距 */
  margin-bottom: 6px; /* 减少下边距 */
}

.mode-btn {
  flex: 1;
  padding: 4px 8px; /* 减少内边距 */
  border: none;
  background: transparent;
  color: #cccccc;
  font-size: 11px; /* 减小字体 */
  font-weight: 500;
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px; /* 减少间距 */
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
  gap: 4px; /* 减少间距 */
  font-size: 10px; /* 减小字体 */
  color: #969696;
  line-height: 1.2; /* 减少行高 */
  padding: 6px 0;
}

.hint-icon {
  width: 16px;
  height: 16px;
  margin-top: 1px;
  flex-shrink: 0;
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
