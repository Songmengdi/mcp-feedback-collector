<template>
  <!-- 反馈模式选择区域 -->
  <div class="phrase-mode-section">
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
        v-for="mode in modes" 
        :key="mode.key"
        type="button" 
        class="mode-btn" 
        :class="{ active: currentMode === mode.key }"
        @click="selectMode(mode.key)"
        :title="`快捷键: ${shortcutPrefix}+${mode.shortcut}`"
      >
        <span class="mode-label">{{ mode.label }} <span class="mode-shortcut">{{ shortcutPrefix }}+{{ mode.shortcut }}</span></span>
        
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
          <h3>{{ currentModeLabel }} - 自定义提示词</h3>
          <button type="button" class="modal-close" @click="hideEditor">×</button>
        </div>
        <div class="modal-body">
          <div v-if="errorMessage" class="error-message">
            ❌ {{ errorMessage }}
          </div>
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
import { computed, ref, watch } from 'vue'
import { useAppStore } from '../stores/app'
import type { PhraseModeType } from '../types/app'
import promptService from '../services/promptService'

// Store引用
const appStore = useAppStore()

// 本地状态
const showModal = ref(false)
const customPhrase = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

// 模式配置
const modes = [
  { key: 'discuss' as PhraseModeType, label: '探讨', shortcut: '1' },
  { key: 'edit' as PhraseModeType, label: '编辑', shortcut: '2' },
  { key: 'search' as PhraseModeType, label: '搜索', shortcut: '3' }
]

// 计算属性
const currentMode = computed(() => appStore.currentPhraseMode)

const currentModeLabel = computed(() => {
  const modeNames = {
    discuss: '探讨模式',
    edit: '编辑模式',
    search: '搜索模式'
  }
  return modeNames[currentMode.value as PhraseModeType]
})

const currentHintText = computed(() => {
  const hints = {
    discuss: '探讨模式：自动附加深入分析和建议的提示词',
    edit: '编辑模式：自动附加代码修改和优化的提示词', 
    search: '搜索模式：自动附加信息查找和解决方案的提示词'
  }
  return hints[currentMode.value as PhraseModeType]
})

const shortcutPrefix = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '⌘' : 'Ctrl'
})

// 方法
const selectMode = (mode: PhraseModeType) => {
  appStore.setCurrentPhraseMode(mode)
}

const showEditor = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
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
    console.error('加载提示词失败:', error)
    errorMessage.value = error instanceof Error ? error.message : '加载提示词失败'
    showStatusMessage('error', errorMessage.value)
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
    // 优先从API获取（包含缓存逻辑）
    const prompt = await promptService.getPrompt(currentMode.value)
    return prompt || appStore.defaultPhrases[currentMode.value]
  } catch (error) {
    console.error('获取提示词失败，使用默认提示词:', error)
    // 网络错误时回退到默认提示词
    return appStore.defaultPhrases[currentMode.value]
  }
}

const savePhrase = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    // 调用API保存提示词
    await promptService.savePrompt(currentMode.value, customPhrase.value)
    
    showStatusMessage('success', '快捷语已保存')
    hideEditor()
  } catch (error) {
    console.error('保存提示词失败:', error)
    errorMessage.value = error instanceof Error ? error.message : '保存提示词失败'
    showStatusMessage('error', errorMessage.value)
  } finally {
    isLoading.value = false
  }
}

const resetToDefault = async () => {
  try {
    isLoading.value = true
    errorMessage.value = ''
    
    // 调用API重置到默认提示词
    await promptService.resetToDefault(currentMode.value)
    
    // 重新加载提示词内容
    customPhrase.value = await getCustomQuickPhrase()
    
    showStatusMessage('info', '已恢复为默认快捷语')
  } catch (error) {
    console.error('重置提示词失败:', error)
    errorMessage.value = error instanceof Error ? error.message : '重置提示词失败'
    showStatusMessage('error', errorMessage.value)
    
    // 重置失败时至少更新为本地默认值
    customPhrase.value = appStore.defaultPhrases[currentMode.value]
  } finally {
    isLoading.value = false
  }
}

// 显示状态消息（临时实现）
const showStatusMessage = (type: string, message: string) => {
  console.log(`[${type.toUpperCase()}] ${message}`)
  // TODO: 集成StatusMessage组件
}

// 监听模式变化，更新编辑器内容
watch(currentMode, async () => {
  if (showModal.value) {
    try {
      isLoading.value = true
      customPhrase.value = await getCustomQuickPhrase()
    } catch (error) {
      console.error('切换模式时加载提示词失败:', error)
      customPhrase.value = appStore.defaultPhrases[currentMode.value]
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

.mode-label {
  font-size: 12px;
  font-weight: 500;
}

.mode-shortcut {
  font-size: 9px;
  opacity: 0.7;
  font-weight: 400;
}

.mode-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #ffffff;
}

.mode-btn:hover .mode-shortcut {
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

/* 模态框样式 */
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

.error-message {
  background: #2d1b1b;
  border: 1px solid #d73a49;
  border-radius: 4px;
  padding: 8px 12px;
  margin-bottom: 12px;
  color: #f97583;
  font-size: 12px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 16px 20px;
  background: #2d2d30;
  border-top: 1px solid #3e3e42;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #cccccc;
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
}
</style>
