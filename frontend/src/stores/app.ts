import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Scene, SceneMode, CurrentSelection } from '../types/app'

// 确认对话框选项接口
interface ConfirmOptions {
  title?: string
  message: string
  type?: 'info' | 'warning' | 'danger'
  confirmText?: string
  cancelText?: string
}

export const useAppStore = defineStore('app', () => {
  // 当前标签页
  const currentTab = ref<string>('report')
  
  // ===== 场景化状态管理 =====
  
  // 当前选择的场景和模式
  const currentSelection = ref<CurrentSelection>({
    sceneId: 'default',
    modeId: 'discuss'
  })
  
  // 所有可用场景
  const scenes = ref<Scene[]>([])
  
  // 当前场景
  const currentScene = ref<Scene | null>(null)
  
  // 当前场景下的模式列表
  const currentSceneModes = ref<SceneMode[]>([])
  
  // 场景数据加载状态
  const scenesLoading = ref<boolean>(false)
  const scenesError = ref<string | null>(null)
  
  // ===== 确认对话框状态管理 =====
  
  // 确认对话框引用
  const confirmDialogRef = ref<any>(null)
  
  // 设置确认对话框引用
  const setConfirmDialogRef = (ref: any) => {
    confirmDialogRef.value = ref
  }
  
  // 显示确认对话框
  const showConfirm = async (options: ConfirmOptions): Promise<boolean> => {
    if (!confirmDialogRef.value) {
      console.error('确认对话框组件未初始化')
      return false
    }
    return await confirmDialogRef.value.show(options)
  }
  
  // ===== 向后兼容的模式管理 =====
  
  // 当前快捷语模式 (向后兼容)
  const currentPhraseMode = ref<string>('discuss')
  
  // 默认快捷语内容 (向后兼容)
  const defaultPhrases = ref<Record<string, string>>({
    discuss: '对之前的所有过程,做一个整体的总结性的归纳,并且明确最近一段时间我们的核心聚焦点是什么,思考接下来我们需要做什么',
    edit: '根据之前步骤及需求,完成编码',
    search: '深入研究相关代码'
  })
  
  // ===== 其他状态保持不变 =====
  
  // 自动刷新相关状态
  const autoRefreshInterval = ref<number | null>(null)
  const autoRefreshCountdown = ref<number>(10)
  const autoRefreshTimer = ref<number | null>(null)
  const lastWorkSummary = ref<string | null>(null)
  
  // 接收到的prompt状态
  const receivedPrompt = ref<{
    sessionId: string;
    prompt: string;
    model?: string;
    files?: any[];
    images?: any[];
    mode?: string;
    metadata?: any;
    timestamp: number;
  } | null>(null)
  
  // ===== 基础方法 =====
  
  // 切换标签页
  const setCurrentTab = (tab: string) => {
    currentTab.value = tab
  }
  
  // ===== 场景化管理方法 =====
  
  // 设置当前选择（场景+模式）
  const setCurrentSelection = (selection: CurrentSelection) => {
    currentSelection.value = selection
    // 同步更新向后兼容的currentPhraseMode
    currentPhraseMode.value = selection.modeId
  }
  
  // 设置当前场景
  const setCurrentScene = (scene: Scene | null) => {
    currentScene.value = scene
    if (scene) {
      currentSelection.value.sceneId = scene.id
    }
  }
  
  // 设置场景列表
  const setScenes = (sceneList: Scene[]) => {
    scenes.value = sceneList
  }
  
  // 设置当前场景下的模式列表
  const setCurrentSceneModes = (modes: SceneMode[]) => {
    currentSceneModes.value = modes
  }
  
  // 设置场景加载状态
  const setScenesLoading = (loading: boolean) => {
    scenesLoading.value = loading
  }
  
  // 设置场景错误状态
  const setScenesError = (error: string | null) => {
    scenesError.value = error
  }
  
  // 切换到指定场景
  const switchToScene = (sceneId: string) => {
    const scene = scenes.value.find(s => s.id === sceneId)
    if (scene) {
      setCurrentScene(scene)
      // 自动选择该场景的默认模式
      const defaultMode = currentSceneModes.value.find(m => m.isDefault) || currentSceneModes.value[0]
      if (defaultMode) {
        setCurrentSelection({
          sceneId: scene.id,
          modeId: defaultMode.id
        })
      }
    }
  }
  
  // 切换到指定模式
  const switchToMode = (modeId: string) => {
    const mode = currentSceneModes.value.find(m => m.id === modeId)
    if (mode) {
      setCurrentSelection({
        sceneId: currentSelection.value.sceneId,
        modeId: mode.id
      })
    }
  }
  
  // 获取当前模式对象
  const getCurrentMode = (): SceneMode | null => {
    return currentSceneModes.value.find(m => m.id === currentSelection.value.modeId) || null
  }
  
  // ===== 向后兼容方法 =====
  
  // 设置快捷语模式 (向后兼容)
  const setCurrentPhraseMode = (mode: string) => {
    currentPhraseMode.value = mode
    // 同步更新场景化选择
    currentSelection.value.modeId = mode
  }
  
  // 设置默认快捷语 (向后兼容)
  const setDefaultPhrases = (phrases: Record<string, string>) => {
    defaultPhrases.value = phrases
  }
  
  // ===== 其他方法保持不变 =====
  
  // 设置自动刷新倒计时
  const setAutoRefreshCountdown = (countdown: number) => {
    autoRefreshCountdown.value = countdown
  }
  
  // 设置最后的工作汇报
  const setLastWorkSummary = (summary: string | null) => {
    lastWorkSummary.value = summary
  }
  
  // 设置接收到的prompt
  const setReceivedPrompt = (prompt: typeof receivedPrompt.value) => {
    receivedPrompt.value = prompt
  }
  
  // 清除接收到的prompt
  const clearReceivedPrompt = () => {
    receivedPrompt.value = null
  }

  return {
    // ===== 场景化状态 =====
    currentSelection,
    scenes,
    currentScene,
    currentSceneModes,
    scenesLoading,
    scenesError,
    
    // ===== 确认对话框状态 =====
    confirmDialogRef,
    
    // ===== 向后兼容状态 =====
    currentTab,
    currentPhraseMode,
    defaultPhrases,
    autoRefreshInterval,
    autoRefreshCountdown,
    autoRefreshTimer,
    lastWorkSummary,
    receivedPrompt,
    
    // ===== 场景化方法 =====
    setCurrentSelection,
    setCurrentScene,
    setScenes,
    setCurrentSceneModes,
    setScenesLoading,
    setScenesError,
    switchToScene,
    
    // ===== 确认对话框方法 =====
    setConfirmDialogRef,
    showConfirm,
    switchToMode,
    getCurrentMode,
    
    // ===== 向后兼容方法 =====
    setCurrentTab,
    setCurrentPhraseMode,
    setDefaultPhrases,
    setAutoRefreshCountdown,
    setLastWorkSummary,
    setReceivedPrompt,
    clearReceivedPrompt
  }
})
