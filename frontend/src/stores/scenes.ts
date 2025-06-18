import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Scene, SceneMode, CurrentSelection, SceneRequest, SceneModeRequest } from '../types/app'
import { promptService } from '../services/promptService'

export const useScenesStore = defineStore('scenes', () => {
  // ===== 基础状态 =====
  
  // 所有场景
  const scenes = ref<Scene[]>([])
  
  // 当前选择的场景和模式
  const currentSelection = ref<CurrentSelection>({
    sceneId: 'default',
    modeId: 'discuss'
  })
  
  // 当前场景下的模式列表
  const currentSceneModes = ref<SceneMode[]>([])
  
  // 加载状态
  const loading = ref<boolean>(false)
  const error = ref<string | null>(null)
  
  // 操作状态
  const saving = ref<boolean>(false)
  const deleting = ref<boolean>(false)
  
  // ===== 计算属性 =====
  
  // 当前场景
  const currentScene = computed(() => 
    scenes.value.find(scene => scene.id === currentSelection.value.sceneId) || null
  )
  
  // 当前模式
  const currentMode = computed(() =>
    currentSceneModes.value.find(mode => mode.id === currentSelection.value.modeId) || null
  )
  
  // 场景选项（用于下拉框）
  const sceneOptions = computed(() =>
    scenes.value.map(scene => ({
      value: scene.id,
      label: scene.name,
      description: scene.description
    }))
  )
  
  // 当前场景的模式选项
  const modeOptions = computed(() =>
    currentSceneModes.value.map(mode => ({
      value: mode.id,
      label: mode.name,
      description: mode.description,
      isDefault: mode.isDefault
    }))
  )
  
  // 是否有数据
  const hasScenes = computed(() => scenes.value.length > 0)
  const hasModes = computed(() => currentSceneModes.value.length > 0)
  
  // ===== 场景管理方法 =====
  
  /**
   * 加载所有场景
   */
  const loadScenes = async (): Promise<void> => {
    if (loading.value) return
    
    loading.value = true
    error.value = null
    
    try {
      const scenesData = await promptService.getAllScenes()
      scenes.value = scenesData
      
      // 如果当前选择的场景不存在，切换到第一个场景
      if (!scenes.value.find(s => s.id === currentSelection.value.sceneId)) {
        if (scenes.value.length > 0) {
          await switchToScene(scenes.value[0].id)
        }
      } else {
        // 加载当前场景的模式
        await loadSceneModes(currentSelection.value.sceneId)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载场景失败'
      error.value = errorMessage
      console.error('[ScenesStore] 加载场景失败:', err)
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 加载指定场景的模式
   */
  const loadSceneModes = async (sceneId: string): Promise<void> => {
    try {
      const modes = await promptService.getSceneModes(sceneId)
      // 按快捷键排序
      currentSceneModes.value = sortSceneModes(modes)
      
      // 如果当前选择的模式不存在，切换到默认模式或第一个模式
      if (!currentSceneModes.value.find(m => m.id === currentSelection.value.modeId)) {
        const defaultMode = currentSceneModes.value.find(m => m.isDefault) || currentSceneModes.value[0]
        if (defaultMode) {
          currentSelection.value.modeId = defaultMode.id
        }
      }
    } catch (err) {
      console.error(`[ScenesStore] 加载场景模式失败 (${sceneId}):`, err)
      currentSceneModes.value = []
    }
  }
  
  /**
   * 创建新场景
   */
  const createScene = async (sceneData: SceneRequest): Promise<Scene> => {
    saving.value = true
    
    try {
      const newScene = await promptService.createScene(sceneData)
      scenes.value.push(newScene)
      return newScene
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '创建场景失败'
      error.value = errorMessage
      throw err
    } finally {
      saving.value = false
    }
  }
  
  /**
   * 更新场景
   */
  const updateScene = async (sceneId: string, sceneData: Partial<SceneRequest>): Promise<Scene> => {
    saving.value = true
    
    try {
      const updatedScene = await promptService.updateScene(sceneId, sceneData)
      const index = scenes.value.findIndex(s => s.id === sceneId)
      if (index !== -1) {
        scenes.value[index] = updatedScene
      }
      return updatedScene
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新场景失败'
      error.value = errorMessage
      throw err
    } finally {
      saving.value = false
    }
  }
  
  /**
   * 删除场景
   */
  const deleteScene = async (sceneId: string): Promise<void> => {
    deleting.value = true
    
    try {
      await promptService.deleteScene(sceneId)
      scenes.value = scenes.value.filter(s => s.id !== sceneId)
      
      // 如果删除的是当前场景，切换到第一个可用场景
      if (currentSelection.value.sceneId === sceneId) {
        if (scenes.value.length > 0) {
          await switchToScene(scenes.value[0].id)
        } else {
          currentSelection.value = { sceneId: '', modeId: '' }
          currentSceneModes.value = []
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除场景失败'
      error.value = errorMessage
      throw err
    } finally {
      deleting.value = false
    }
  }
  
  // ===== 场景模式管理方法 =====
  
  /**
   * 为场景添加新模式
   */
  const addSceneMode = async (sceneId: string, modeData: SceneModeRequest): Promise<SceneMode> => {
    saving.value = true
    
    try {
      // 如果设置了快捷键，检查冲突并处理
      if (modeData.shortcut && /^\d$/.test(modeData.shortcut)) {
        await handleShortcutConflict(sceneId, modeData.shortcut, null)
      }
      
      // 如果要设置为默认模式，先在本地状态中清除所有模式的默认状态
      if (modeData.isDefault === true && sceneId === currentSelection.value.sceneId) {
        currentSceneModes.value.forEach(mode => {
          mode.isDefault = false
        })
      }
      
      const newMode = await promptService.addSceneMode(sceneId, modeData)
      
      // 如果是当前场景，更新模式列表并保持排序
      if (sceneId === currentSelection.value.sceneId) {
        currentSceneModes.value.push(newMode)
        // 重新排序，确保按快捷键排序
        currentSceneModes.value = sortSceneModes(currentSceneModes.value)
      }
      
      return newMode
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '添加模式失败'
      error.value = errorMessage
      throw err
    } finally {
      saving.value = false
    }
  }
  
  /**
   * 更新场景模式
   */
  const updateSceneMode = async (sceneId: string, modeId: string, modeData: Partial<SceneModeRequest>): Promise<SceneMode> => {
    saving.value = true
    
    try {
      // 如果更新了快捷键，检查冲突并处理
      if (modeData.shortcut !== undefined && modeData.shortcut && /^\d$/.test(modeData.shortcut)) {
        await handleShortcutConflict(sceneId, modeData.shortcut, modeId)
      }
      
      const updatedMode = await promptService.updateSceneMode(sceneId, modeId, modeData)
      
      // 如果是当前场景，更新模式列表
      if (sceneId === currentSelection.value.sceneId) {
        const index = currentSceneModes.value.findIndex(m => m.id === modeId)
        if (index !== -1) {
          // 如果更新了默认状态，需要同步本地状态
          if (modeData.isDefault !== undefined) {
            // 先清除所有模式的默认状态
            currentSceneModes.value.forEach(mode => {
              mode.isDefault = false
            })
            // 设置当前模式的默认状态为服务器返回的值
            currentSceneModes.value[index] = updatedMode
          } else {
            // 其他更新直接替换
            currentSceneModes.value[index] = updatedMode
          }
          
          // 如果更新了快捷键，需要重新排序
          if (modeData.shortcut !== undefined) {
            currentSceneModes.value = sortSceneModes(currentSceneModes.value)
          }
        }
      }
      
      return updatedMode
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '更新模式失败'
      error.value = errorMessage
      throw err
    } finally {
      saving.value = false
    }
  }
  
  /**
   * 删除场景模式
   */
  const deleteSceneMode = async (sceneId: string, modeId: string): Promise<void> => {
    deleting.value = true
    
    try {
      await promptService.deleteSceneMode(sceneId, modeId)
      
      // 如果是当前场景，更新模式列表
      if (sceneId === currentSelection.value.sceneId) {
        currentSceneModes.value = currentSceneModes.value.filter(m => m.id !== modeId)
        
        // 如果删除的是当前模式，切换到默认模式或第一个模式
        if (currentSelection.value.modeId === modeId) {
          const defaultMode = currentSceneModes.value.find(m => m.isDefault) || currentSceneModes.value[0]
          if (defaultMode) {
            currentSelection.value.modeId = defaultMode.id
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '删除模式失败'
      error.value = errorMessage
      throw err
    } finally {
      deleting.value = false
    }
  }
  
  // ===== 选择管理方法 =====
  
  /**
   * 切换到指定场景
   */
  const switchToScene = async (sceneId: string): Promise<void> => {
    if (currentSelection.value.sceneId === sceneId) return
    
    currentSelection.value.sceneId = sceneId
    await loadSceneModes(sceneId)
  }
  
  /**
   * 切换到指定模式
   */
  const switchToMode = (modeId: string): void => {
    if (currentSceneModes.value.find(m => m.id === modeId)) {
      currentSelection.value.modeId = modeId
    }
  }
  
  /**
   * 设置当前选择
   */
  const setCurrentSelection = async (selection: CurrentSelection): Promise<void> => {
    const needLoadModes = selection.sceneId !== currentSelection.value.sceneId
    
    currentSelection.value = { ...selection }
    
    if (needLoadModes) {
      await loadSceneModes(selection.sceneId)
    }
  }
  
  // ===== 快捷键冲突处理 =====
  
  /**
   * 处理快捷键冲突
   */
  const handleShortcutConflict = async (sceneId: string, shortcut: string, excludeModeId: string | null): Promise<void> => {
    try {
      // 获取场景下所有模式
      const allModes = await promptService.getSceneModes(sceneId)
      
      // 查找使用相同快捷键的模式（排除当前编辑的模式）
      const conflictMode = allModes.find(mode => 
        mode.shortcut === shortcut && mode.id !== excludeModeId
      )
      
      if (conflictMode) {
        // 找到下一个可用的快捷键数字
        const usedShortcuts = new Set(
          allModes
            .filter(mode => mode.id !== excludeModeId && mode.shortcut && /^\d$/.test(mode.shortcut))
            .map(mode => parseInt(mode.shortcut!))
        )
        
        // 添加即将使用的快捷键
        usedShortcuts.add(parseInt(shortcut))
        
        // 找到下一个可用数字（1-9）
        let nextShortcut = 1
        while (nextShortcut <= 9 && usedShortcuts.has(nextShortcut)) {
          nextShortcut++
        }
        
        if (nextShortcut <= 9) {
          // 更新冲突模式的快捷键
          await promptService.updateSceneMode(sceneId, conflictMode.id, {
            shortcut: nextShortcut.toString()
          })
          
          console.log(`快捷键冲突已解决：模式"${conflictMode.name}"的快捷键从"${shortcut}"改为"${nextShortcut}"`)
        } else {
          // 如果1-9都被占用，清除冲突模式的快捷键
          await promptService.updateSceneMode(sceneId, conflictMode.id, {
            shortcut: ''
          })
          
          console.log(`快捷键冲突已解决：模式"${conflictMode.name}"的快捷键已清除（1-9已全部占用）`)
        }
      }
    } catch (err) {
      console.error('处理快捷键冲突失败:', err)
      // 不抛出错误，避免影响主要操作
    }
  }
  
    // ===== 工具方法 =====

  /**
   * 按快捷键排序模式列表
   */
  const sortSceneModes = (modes: SceneMode[]): SceneMode[] => {
    return [...modes].sort((a, b) => {
      const aHasShortcut = a.shortcut && /^\d$/.test(a.shortcut)
      const bHasShortcut = b.shortcut && /^\d$/.test(b.shortcut)
      
      if (aHasShortcut && bHasShortcut) {
        // 都有快捷键，按数字排序
        return parseInt(a.shortcut!) - parseInt(b.shortcut!)
      } else if (aHasShortcut && !bHasShortcut) {
        // a有快捷键，b没有，a排前面
        return -1
      } else if (!aHasShortcut && bHasShortcut) {
        // a没有快捷键，b有，b排前面
        return 1
      } else {
        // 都没有快捷键，按sort_order排序
        return a.sortOrder - b.sortOrder
      }
    })
  }

  /**
   * 清除错误状态
   */
  const clearError = (): void => {
    error.value = null
  }
  
  /**
   * 重置状态
   */
  const reset = (): void => {
    scenes.value = []
    currentSelection.value = { sceneId: 'default', modeId: 'discuss' }
    currentSceneModes.value = []
    loading.value = false
    error.value = null
    saving.value = false
    deleting.value = false
  }
  
  /**
   * 获取场景详情
   */
  const getSceneById = (sceneId: string): Scene | undefined => {
    return scenes.value.find(s => s.id === sceneId)
  }
  
  /**
   * 获取模式详情
   */
  const getModeById = (modeId: string): SceneMode | undefined => {
    return currentSceneModes.value.find(m => m.id === modeId)
  }

  /**
   * 获取当前模式对象
   */
  const getCurrentMode = (): SceneMode | null => {
    return currentSceneModes.value.find(m => m.id === currentSelection.value.modeId) || null
  }

  return {
    // ===== 状态 =====
    scenes,
    currentSelection,
    currentSceneModes,
    loading,
    error,
    saving,
    deleting,
    
    // ===== 计算属性 =====
    currentScene,
    currentMode,
    sceneOptions,
    modeOptions,
    hasScenes,
    hasModes,
    
    // ===== 场景管理方法 =====
    loadScenes,
    loadSceneModes,
    createScene,
    updateScene,
    deleteScene,
    
    // ===== 场景模式管理方法 =====
    addSceneMode,
    updateSceneMode,
    deleteSceneMode,
    
    // ===== 选择管理方法 =====
    switchToScene,
    switchToMode,
    setCurrentSelection,
    
    // ===== 工具方法 =====
    clearError,
    reset,
    getSceneById,
    getModeById,
    getCurrentMode
  }
}) 