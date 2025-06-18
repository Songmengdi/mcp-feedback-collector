/**
 * 统一快捷键管理服务
 * 负责动态快捷键绑定、模式切换、默认反馈内容获取
 */

import type { SceneMode } from '../types/app'
import { useAppStore } from '../stores/app'
import { useScenesStore } from '../stores/scenes'

export interface ShortcutBinding {
  key: string
  mode: SceneMode
  handler: () => void
}

class ShortcutService {
  private bindings: Map<string, ShortcutBinding> = new Map()
  private isListening = false

  /**
   * 初始化快捷键服务
   */
  init() {
    if (!this.isListening) {
      document.addEventListener('keydown', this.handleGlobalKeydown.bind(this))
      this.isListening = true
    }
  }

  /**
   * 销毁快捷键服务
   */
  destroy() {
    if (this.isListening) {
      document.removeEventListener('keydown', this.handleGlobalKeydown.bind(this))
      this.isListening = false
    }
    this.bindings.clear()
  }

  /**
   * 更新快捷键绑定
   * @param modes 当前场景的模式列表
   */
  updateBindings(modes: SceneMode[]) {
    this.bindings.clear()
    
    modes.forEach(mode => {
      if (mode.shortcut && /^[1-9]$/.test(mode.shortcut)) {
        this.bindings.set(mode.shortcut, {
          key: mode.shortcut,
          mode,
          handler: () => this.switchToMode(mode)
        })
      }
    })
  }

  /**
   * 获取当前快捷键绑定映射
   */
  getBindings(): Map<string, ShortcutBinding> {
    return new Map(this.bindings)
  }

  /**
   * 获取指定模式的默认反馈内容
   * @param mode 场景模式
   */
  getDefaultFeedback(mode: SceneMode): string {
    return mode.defaultFeedback || ''
  }

  /**
   * 获取当前模式的默认反馈内容
   */
  getCurrentModeDefaultFeedback(): string {
    const appStore = useAppStore()
    const scenesStore = useScenesStore()
    
    const currentMode = scenesStore.getCurrentMode()
    if (currentMode) {
      return this.getDefaultFeedback(currentMode)
    }
    
    // 回退到传统的硬编码默认反馈
    const defaultFeedbacks = {
      discuss: '对之前的所有过程,做一个整体的总结性的归纳,并且明确最近一段时间我们的核心聚焦点是什么,思考接下来我们需要做什么',
      edit: '根据之前步骤及需求,完成编码',
      search: '深入研究相关代码'
    }
    
    return defaultFeedbacks[appStore.currentPhraseMode as keyof typeof defaultFeedbacks] || ''
  }

  /**
   * 切换到指定模式
   * @param mode 目标模式
   */
  private switchToMode(mode: SceneMode) {
    const appStore = useAppStore()
    const scenesStore = useScenesStore()
    
    // 新的选择状态
    const newSelection = {
      sceneId: mode.sceneId,
      modeId: mode.id
    }
    
    // 向后兼容：同步更新传统模式状态
    appStore.setCurrentPhraseMode(mode.id)
    
    // 更新 scenesStore 状态（主要状态管理）
    scenesStore.setCurrentSelection(newSelection)
  }

  /**
   * 全局键盘事件处理
   * @param event 键盘事件
   */
  private handleGlobalKeydown(event: KeyboardEvent) {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
    const isCtrlOrCmd = isMac ? event.metaKey : event.ctrlKey
    
    // 检查是否是快捷键组合 (Ctrl/Cmd + 数字键)
    if (isCtrlOrCmd && /^[1-9]$/.test(event.key)) {
      // 检查当前焦点是否在反馈表单区域内
      const activeElement = document.activeElement
      const formElement = document.querySelector('.feedback-card')
      
      // 只有在反馈表单区域内才响应快捷键
      if (formElement && formElement.contains(activeElement)) {
        const binding = this.bindings.get(event.key)
        
        if (binding) {
          event.preventDefault()
          binding.handler()
        }
      }
    }
  }

  /**
   * 检查快捷键是否可用
   * @param key 快捷键
   * @param excludeModeId 排除的模式ID（用于编辑时检查冲突）
   */
  isShortcutAvailable(key: string, excludeModeId?: string): boolean {
    if (!/^[1-9]$/.test(key)) {
      return false
    }
    
    const binding = this.bindings.get(key)
    if (!binding) {
      return true
    }
    
    return excludeModeId ? binding.mode.id === excludeModeId : false
  }

  /**
   * 获取下一个可用的快捷键
   * @param excludeModeId 排除的模式ID
   */
  getNextAvailableShortcut(excludeModeId?: string): string | null {
    for (let i = 1; i <= 9; i++) {
      const key = i.toString()
      if (this.isShortcutAvailable(key, excludeModeId)) {
        return key
      }
    }
    return null
  }
}

// 创建单例实例
export const shortcutService = new ShortcutService()

// 默认导出
export default shortcutService 