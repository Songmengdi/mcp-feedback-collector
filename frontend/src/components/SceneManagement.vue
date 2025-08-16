<template>
  <div class="scene-management">
    <!-- 头部工具栏 -->
    <div class="management-header">
      <div class="header-left">
        <h2 class="page-title">场景管理</h2>
        <span class="scene-count">{{ sceneCount }}</span>
      </div>
      <div class="header-actions">
        <button 
          class="action-btn primary" 
          @click="openCreateSceneDialog"
          :disabled="loading"
        >
          <span>➕</span>
          新建场景
        </button>
        <button 
          class="action-btn secondary" 
          @click="exportConfig"
          :disabled="loading"
        >
          <span>📤</span>
          导出配置
        </button>
        <button 
          class="action-btn secondary" 
          @click="openImportDialog"
          :disabled="loading"
        >
          <span>📥</span>
          导入配置
        </button>
      </div>
    </div>



    <!-- 加载状态 -->
    <div v-if="loading && !hasScenes" class="loading-state">
      <div class="loading-spinner"></div>
      <p>加载场景数据中...</p>
    </div>

    <!-- 空状态 -->
    <div v-else-if="!loading && !hasScenes" class="empty-state">
      <SparklesIcon class="empty-icon" />
      <h3>暂无场景</h3>
      <p>创建您的第一个工作场景，开始个性化的AI协作体验</p>
      <button class="action-btn primary" @click="openCreateSceneDialog">
        创建第一个场景
      </button>
    </div>

    <!-- 场景列表 -->
    <div v-else class="scene-list-container">
      <VueDraggable
        v-model="sortedScenes"
        class="scene-grid"
        :animation="200"
        ghostClass="scene-ghost"
        chosenClass="scene-chosen"
        :disabled="saving"
        @end="handleSceneReorder"
      >
        <div 
          v-for="scene in sortedScenes" 
          :key="scene.id"
          class="scene-card"
          :class="{ 
            active: managementSelectedScene?.id === scene.id,
            default: scene.isDefault 
          }"
          @click="selectSceneSelection(scene)"
        >
          <!-- 场景卡片头部 -->
          <div class="scene-card-header">
            <div class="scene-info">
              <h3 class="scene-name">
                <!-- 拖拽句柄 -->
                <div class="drag-handle" title="拖拽排序">⋮⋮</div>
                {{ scene.name }}
                <span v-if="scene.isDefault" class="default-badge">默认</span>
              </h3>
              <p class="scene-description">{{ scene.description }}</p>
            </div>
            <div class="scene-actions">
              <button 
                class="icon-btn detail" 
                @click.stop="openSceneDetail(scene)"
                title="查看详情"
              >
                <EyeIcon class="icon" />
              </button>
              <button 
                class="icon-btn" 
                @click.stop="editScene(scene)"
                title="编辑场景"
              >
                <PencilIcon class="icon" />
              </button>
              <button 
                class="icon-btn" 
                @click.stop="duplicateScene(scene)"
                title="复制场景"
              >
                <DocumentDuplicateIcon class="icon" />
              </button>
              <button 
                v-if="!scene.isDefault"
                class="icon-btn delete" 
                @click.stop="deleteScene(scene)"
                title="删除场景"
              >
                <TrashIcon class="icon" />
              </button>
            </div>
          </div>

          <!-- 模式统计 -->
          <div class="scene-stats">
            <div class="stat-item">
              <span class="stat-label">模式数量</span>
              <span class="stat-value">{{ getSceneModeCount(scene.id) }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">创建时间</span>
              <span class="stat-value">{{ formatDate(scene.createdAt) }}</span>
            </div>
          </div>

          <!-- 模式预览 -->
          <div v-if="getSceneModes(scene.id).length > 0" class="modes-preview">
            <div class="modes-header">
              <span class="modes-title">模式列表</span>
              <button 
                class="add-mode-btn" 
                @click.stop="addModeToScene(scene)"
                title="添加新模式"
              >
                <PlusIcon class="icon" />
              </button>
            </div>
            <div class="modes-list">
              <div 
                v-for="mode in getSceneModes(scene.id).slice(0, 3)" 
                :key="mode.id"
                class="mode-chip"
                :class="{ default: mode.isDefault }"
              >
                <span class="mode-name">{{ mode.name }}</span>
                <span v-if="mode.isDefault" class="mode-default">默认</span>
              </div>
              <div 
                v-if="getSceneModes(scene.id).length > 3" 
                class="mode-chip more"
              >
                +{{ getSceneModes(scene.id).length - 3 }}
              </div>
            </div>
          </div>
          <div v-else class="no-modes">
            <span class="no-modes-text">暂无模式</span>
            <button 
              class="add-mode-btn small" 
              @click.stop="addModeToScene(scene)"
            >
              添加模式
            </button>
          </div>
        </div>
      </VueDraggable>
    </div>

    <!-- 侧边栏遮罩层 -->
    <div v-if="showDetailSidebar" class="sidebar-overlay" @click="handleSidebarClick">
      <!-- 场景详情侧边栏 -->
      <div v-if="managementSelectedScene" class="scene-detail-sidebar" :class="{ open: showDetailSidebar }">
        <div class="sidebar-header">
          <h3>{{ managementSelectedScene.name }}</h3>
          <button class="close-sidebar" @click="closeDetailSidebar">×</button>
        </div>
        
        <div class="sidebar-content">
          <!-- 场景基本信息 -->
          <div class="detail-section">
            <h4>基本信息</h4>
            <div class="info-grid">
              <div class="info-item">
                <label>场景名称</label>
                <span>{{ managementSelectedScene.name }}</span>
              </div>
              <div class="info-item">
                <label>描述</label>
                <span>{{ managementSelectedScene.description }}</span>
              </div>
              <div class="info-item">
                <label>创建时间</label>
                <span>{{ formatDateTime(managementSelectedScene.createdAt) }}</span>
              </div>
              <div class="info-item">
                <label>更新时间</label>
                <span>{{ formatDateTime(managementSelectedScene.updatedAt) }}</span>
              </div>
            </div>
          </div>

          <!-- 模式管理 -->
          <div class="detail-section">
            <div class="section-header">
              <h4>模式管理</h4>
              <button 
                class="action-btn small primary" 
                @click="addModeToScene(managementSelectedScene)"
              >
                添加模式
              </button>
            </div>
            
            <div v-if="currentModesList.length === 0" class="empty-modes">
              <p>此场景暂无模式</p>
            </div>
            <div v-else class="modes-detail-list">
              {{ currentModesList.length }}
              <VueDraggable
                v-model="currentModesList"
                :animation="200"
                ghostClass="mode-ghost"
                chosenClass="mode-chosen"
                :disabled="saving"
                @end="handleModeReorder"
              >
                <div 
                  v-for="mode in currentModesList" 
                  :key="mode.id"
                  class="mode-detail-item"
                >
                  <div class="drag-handle" title="拖拽排序">⋮⋮</div>
                  <div class="mode-info">
                    <div class="mode-header">
                      <span class="mode-name">{{ mode.name }}</span>
                      <div class="mode-badges">
                        <span v-if="mode.isDefault" class="badge default">默认</span>
                        <span v-if="mode.shortcut" class="badge shortcut">{{ mode.shortcut }}</span>
                      </div>
                    </div>
                    <p class="mode-description">{{ mode.description }}</p>
                  </div>
                  <div class="mode-actions">
                    <button 
                      class="icon-btn small" 
                      @click="editMode(managementSelectedScene, mode)"
                      title="编辑模式"
                    >
                      <PencilIcon class="icon" />
                    </button>
                    <button 
                      class="icon-btn small" 
                      @click="editModePrompt(managementSelectedScene, mode)"
                      title="编辑提示词"
                    >
                      <DocumentTextIcon class="icon" />
                    </button>
                    <button 
                      class="icon-btn small delete" 
                      @click="deleteMode(managementSelectedScene, mode)"
                      title="删除模式"
                    >
                      <TrashIcon class="icon" />
                    </button>
                  </div>
                </div>
              </VueDraggable>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 创建/编辑场景对话框 -->
    <div v-if="showSceneDialog" class="modal" @click="handleModalClick">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingScene ? '编辑场景' : '创建场景' }}</h3>
          <button class="modal-close" @click="closeSceneDialog">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="sceneName">场景名称 *</label>
            <input 
              id="sceneName"
              v-model="sceneForm.name" 
              type="text" 
              class="form-input"
              placeholder="输入场景名称，如：编码场景、设计场景等"
              :disabled="saving"
            />
          </div>
          <div class="form-group">
            <label for="sceneDescription">场景描述</label>
            <textarea 
              id="sceneDescription"
              v-model="sceneForm.description" 
              class="form-textarea"
              rows="3"
              placeholder="描述这个场景的用途和特点"
              :disabled="saving"
            ></textarea>
          </div>
          <div class="form-group">
            <label class="switch-label">
              <span class="switch-text">设置为默认场景</span>
              <div class="switch-container">
                <input 
                  v-model="sceneForm.isDefault" 
                  type="checkbox"
                  class="switch-input"
                  :disabled="saving"
                />
                <span class="switch-slider"></span>
              </div>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" @click="closeSceneDialog" :disabled="saving">
            取消
          </button>
          <button class="btn primary" @click="saveScene" :disabled="saving || !sceneForm.name.trim()">
            <span v-if="saving">保存中...</span>
            <span v-else>{{ editingScene ? '更新' : '创建' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 创建/编辑模式对话框 -->
    <div v-if="showModeDialog" class="modal" @click="handleModalClick">
      <div class="modal-content">
        <div class="modal-header">
          <h3>{{ editingMode ? '编辑模式' : '创建模式' }}</h3>
          <button class="modal-close" @click="closeModeDialog">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="modeName">模式名称 *</label>
            <input 
              id="modeName"
              v-model="modeForm.name" 
              type="text" 
              class="form-input"
              placeholder="输入模式名称，如：探讨、编辑、搜索等"
              :disabled="saving"
            />
          </div>
          <div class="form-group">
            <label for="modeDescription">模式描述</label>
            <textarea 
              id="modeDescription"
              v-model="modeForm.description" 
              class="form-textarea"
              rows="3"
              placeholder="描述这个模式的功能和用途"
              :disabled="saving"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="modeDefaultFeedback">默认反馈内容</label>
            <textarea 
              id="modeDefaultFeedback"
              v-model="modeForm.defaultFeedback" 
              class="form-textarea"
              rows="4"
              placeholder="用户未输入反馈时的默认内容，如：对之前的所有过程做一个整体总结..."
              :disabled="saving"
            ></textarea>
          </div>
          <div class="form-group">
            <label for="modeShortcut">快捷键</label>
            <div class="shortcut-display">
              <span class="shortcut-value">{{ modeForm.shortcut || '无' }}</span>
              <span class="shortcut-note">
                {{ modeForm.shortcut ? '自动分配' : '已达到最大数量(9个)' }}
              </span>
            </div>
          </div>
          <div class="form-group">
            <label class="switch-label">
              <span class="switch-text">设置为默认模式</span>
              <div class="switch-container">
                <input 
                  v-model="modeForm.isDefault" 
                  type="checkbox"
                  class="switch-input"
                  :disabled="saving"
                />
                <span class="switch-slider"></span>
              </div>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" @click="closeModeDialog" :disabled="saving">
            取消
          </button>
          <button class="btn primary" @click="saveMode" :disabled="saving || !modeForm.name.trim()">
            <span v-if="saving">保存中...</span>
            <span v-else>{{ editingMode ? '更新' : '创建' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 导入配置对话框 -->
    <div v-if="showImportDialog" class="modal" @click="handleModalClick">
      <div class="modal-content">
        <div class="modal-header">
          <h3>导入场景配置</h3>
          <button class="modal-close" @click="closeImportDialog">×</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label for="configFile">选择配置文件</label>
            <input 
              id="configFile"
              ref="fileInput"
              type="file" 
              accept=".json"
              @change="handleFileSelect"
              class="form-file"
            />
          </div>
          <div v-if="importPreview" class="import-preview">
            <h4>导入预览</h4>
            <div class="preview-stats">
              <div class="stat">场景: {{ importPreview.scenes.length }}</div>
              <div class="stat">模式: {{ importPreview.modes.length }}</div>
              <div class="stat">提示词: {{ importPreview.prompts.length }}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" @click="closeImportDialog" :disabled="importing">
            取消
          </button>
          <button 
            class="btn primary" 
            @click="importConfig" 
            :disabled="importing || !importPreview"
          >
            <span v-if="importing">导入中...</span>
            <span v-else>确认导入</span>
          </button>
        </div>
      </div>
    </div>
    
    <!-- 提示词编辑器 -->
    <PromptEditor ref="promptEditorRef" />

    <!-- 状态消息组件 -->
    <StatusMessage ref="localStatusMessageRef" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, nextTick } from 'vue'
import { useScenesStore } from '../stores/scenes'
import { useAppStore } from '../stores/app'
import type { Scene, SceneMode, SceneRequest, SceneModeRequest, SceneConfigExport } from '../types/app'
import { promptService } from '../services/promptService'
import PromptEditor from './PromptEditor.vue'
import { VueDraggable } from 'vue-draggable-plus'
import StatusMessage from './StatusMessage.vue'
import { 
  EyeIcon,
  PencilIcon,
  DocumentDuplicateIcon,
  TrashIcon,
  PlusIcon,
  SparklesIcon,
  DocumentTextIcon
} from '../components/icons'

// Store引用
const scenesStore = useScenesStore()
const appStore = useAppStore()

// 计算属性
const scenes = computed(() => scenesStore.scenes)
const hasScenes = computed(() => scenesStore.hasScenes)
const loading = computed(() => scenesStore.loading)


const sceneCount = computed(() => {
  const count = scenes.value.length
  return count > 0 ? `${count} 个场景` : '暂无场景'
})

// 本地状态
const saving = ref(false)
const deleting = ref(false)
const importing = ref(false)

// 选中的场景和侧边栏状态 - 场景管理页面专用，与主页面状态独立
const managementSelectedScene = ref<Scene | null>(null)
const showDetailSidebar = ref(false)

// 响应式场景模式数据存储（替代复杂缓存机制）
const sceneModeData = ref<Map<string, SceneMode[]>>(new Map())
const loadingSceneModes = ref<Set<string>>(new Set())

// 对话框状态
const showSceneDialog = ref(false)
const showModeDialog = ref(false)
const showImportDialog = ref(false)

// 编辑状态
const editingScene = ref<Scene | null>(null)
const editingMode = ref<SceneMode | null>(null)
const editingModeScene = ref<Scene | null>(null)

// 表单数据
const sceneForm = ref<SceneRequest>({
  name: '',
  description: '',
  isDefault: false
})

const modeForm = ref<SceneModeRequest>({
  name: '',
  description: '',
  shortcut: '',
  isDefault: false,
  sortOrder: 999,
  defaultFeedback: ''
})

// 导入相关
const fileInput = ref<HTMLInputElement>()
const importPreview = ref<SceneConfigExport | null>(null)

// 提示词编辑器相关
const promptEditorRef = ref<InstanceType<typeof PromptEditor>>()

// 状态消息组件相关
const localStatusMessageRef = ref<InstanceType<typeof StatusMessage>>()

// 拖拽相关 - 为拖拽组件提供的响应式数据
const currentModesList = computed({
  get: () => {
    if (!managementSelectedScene.value) return []
    return getSceneModes(managementSelectedScene.value.id)
  },
  set: (newList: SceneMode[]) => {
    // vue-draggable-plus会自动更新这个值，我们在@end事件中处理业务逻辑
    if (managementSelectedScene.value) {
      const newMap = new Map(sceneModeData.value)
      newMap.set(managementSelectedScene.value.id, newList)
      sceneModeData.value = newMap
    }
  }
})

// 场景排序 - 为场景拖拽组件提供的响应式数据
const sortedScenes = computed({
  get: () => {
    return [...scenes.value].sort((a, b) => a.sortOrder - b.sortOrder)
  },
  set: (newList: Scene[]) => {
    // vue-draggable-plus会自动更新这个值，我们在@end事件中处理业务逻辑
    scenes.value.splice(0, scenes.value.length, ...newList)
  }
})

// 方法

const selectSceneSelection = (scene: Scene) => {
  managementSelectedScene.value = scene
}

const openSceneDetail = async (scene: Scene) => {
  console.log('[SceneManagement] 打开场景详情:', scene.id, scene.name)
  
  managementSelectedScene.value = scene
  showDetailSidebar.value = true
  
  // 确保场景模式数据已加载
  await loadSceneModes(scene.id, true) // 强制重新加载
  
  // 强制触发响应式更新
  await nextTick()
  
  console.log('[SceneManagement] 场景详情已打开，模式数量:', getSceneModes(scene.id).length)
}

const closeDetailSidebar = () => {
  showDetailSidebar.value = false
  // 注意：不清空 managementSelectedScene.value，保持场景的选中状态
}

// 加载场景模式数据
const loadSceneModes = async (sceneId: string, forceReload: boolean = false): Promise<void> => {
  console.log('[SceneManagement] loadSceneModes 开始:', { sceneId, forceReload, isLoading: loadingSceneModes.value.has(sceneId) })
  
  if (!forceReload && loadingSceneModes.value.has(sceneId)) {
    console.log('[SceneManagement] 跳过重复加载:', sceneId)
    return // 避免重复加载
  }
  
  loadingSceneModes.value.add(sceneId)
  
  try {
    // 直接从API获取最新数据，确保数据一致性
    const modes = await promptService.getSceneModes(sceneId)
    
    // 按快捷键排序：有快捷键的按数字排序，没有快捷键的按sort_order排序并放在最后
    const sortedModes = modes.sort((a, b) => {
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
    
    // 更新响应式数据 - 创建新的Map实例确保响应式更新
    const newMap = new Map(sceneModeData.value)
    newMap.set(sceneId, sortedModes)
    sceneModeData.value = newMap
    
    console.log('[SceneManagement] 场景模式数据已更新:', { sceneId, modesCount: sortedModes.length })
  } catch (error) {
    // 错误已通过全局错误处理器显示
    const newMap = new Map(sceneModeData.value)
    newMap.set(sceneId, [])
    sceneModeData.value = newMap
  } finally {
    loadingSceneModes.value.delete(sceneId)
  }
}

// 获取场景模式数据（同步访问响应式数据）
const getSceneModes = (sceneId: string): SceneMode[] => {
  const modes = sceneModeData.value.get(sceneId)
  
  if (!modes && !loadingSceneModes.value.has(sceneId)) {
    // 如果没有数据且没在加载中，触发加载
    console.log('[SceneManagement] 触发异步加载场景模式:', sceneId)
    loadSceneModes(sceneId)
  }
  
  const result = modes || []
  console.log('[SceneManagement] getSceneModes:', { sceneId, modesCount: result.length, hasData: !!modes })
  return result
}

const getSceneModeCount = (sceneId: string): number => {
  return getSceneModes(sceneId).length
}

const formatDate = (timestamp: number): string => {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

const formatDateTime = (timestamp: number): string => {
  return new Date(timestamp).toLocaleString('zh-CN')
}

// 场景管理方法
const openCreateSceneDialog = () => {
  editingScene.value = null
  sceneForm.value = {
    name: '',
    description: '',
    isDefault: false
  }
  showSceneDialog.value = true
}

const editScene = (scene: Scene) => {
  editingScene.value = scene
  sceneForm.value = {
    name: scene.name,
    description: scene.description,
    isDefault: scene.isDefault
  }
  showSceneDialog.value = true
}

const closeSceneDialog = () => {
  showSceneDialog.value = false
  editingScene.value = null
}

const saveScene = async () => {
  if (!sceneForm.value.name.trim()) return
  
  saving.value = true
  
  try {
    if (editingScene.value) {
      await scenesStore.updateScene(editingScene.value.id, sceneForm.value)
      localStatusMessageRef.value?.showMessage('success', `场景"${sceneForm.value.name}"已更新`)
    } else {
      const newScene = await scenesStore.createScene(sceneForm.value)
      localStatusMessageRef.value?.showMessage('success', `场景"${sceneForm.value.name}"已创建`)
      // 为新场景初始化空的模式数据
      const newMap = new Map(sceneModeData.value)
      newMap.set(newScene.id, [])
      sceneModeData.value = newMap
    }
    closeSceneDialog()
  } catch (error) {
    const operation = editingScene.value ? '更新' : '创建'
    localStatusMessageRef.value?.showMessage('error', `${operation}场景失败，请重试`)
  } finally {
    saving.value = false
  }
}

const duplicateScene = async (scene: Scene) => {
  const newSceneData: SceneRequest = {
    name: `${scene.name} (副本)`,
    description: scene.description,
    isDefault: false
  }
  
  saving.value = true
  try {
    const duplicatedScene = await scenesStore.createScene(newSceneData)
    // 为复制的场景初始化空的模式数据
    const newMap = new Map(sceneModeData.value)
    newMap.set(duplicatedScene.id, [])
    sceneModeData.value = newMap
  } catch (error) {
    // 错误已通过全局错误处理器显示
  } finally {
    saving.value = false
  }
}

const deleteScene = async (scene: Scene) => {
  const confirmed = await appStore.showConfirm({
    title: '删除场景',
    message: `确定要删除场景"${scene.name}"吗？此操作不可恢复。`,
    type: 'danger',
    confirmText: '删除',
    cancelText: '取消'
  })
  
  if (!confirmed) {
    return
  }
  
  deleting.value = true
  try {
    await scenesStore.deleteScene(scene.id)
    // 清理场景模式数据
    const newMap = new Map(sceneModeData.value)
    newMap.delete(scene.id)
    sceneModeData.value = newMap
    if (managementSelectedScene.value?.id === scene.id) {
      closeDetailSidebar()
    }
  } catch (error) {
    // 错误已通过全局错误处理器显示
  } finally {
    deleting.value = false
  }
}

// 模式管理方法
const addModeToScene = async (scene: Scene) => {
  editingModeScene.value = scene
  editingMode.value = null
  
  // 强制重新加载场景模式数据，确保快捷键分配准确
  await loadSceneModes(scene.id, true)
  
  // 自动分配下一个可用的快捷键
  const existingModes = getSceneModes(scene.id)
  const usedShortcuts = new Set(
    existingModes
      .filter(mode => mode.shortcut && /^\d$/.test(mode.shortcut))
      .map(mode => parseInt(mode.shortcut!))
  )
  
  // 找到下一个可用数字（1-9）
  let nextShortcut = 1
  while (nextShortcut <= 9 && usedShortcuts.has(nextShortcut)) {
    nextShortcut++
  }
  
  modeForm.value = {
    name: '',
    description: '',
    shortcut: nextShortcut <= 9 ? nextShortcut.toString() : '',
    isDefault: false,
    defaultFeedback: ''
  }
  showModeDialog.value = true
}

const editMode = async (scene: Scene, mode: SceneMode) => {
  editingModeScene.value = scene
  editingMode.value = mode
  
  // 从最新数据中获取当前模式的真实状态
  const sceneModes = getSceneModes(scene.id)
  const currentMode = sceneModes.find(m => m.id === mode.id) || mode
  console.log('currentMode', currentMode)
  modeForm.value = {
    name: currentMode.name,
    description: currentMode.description,
    shortcut: currentMode.shortcut || '',
    isDefault: currentMode.isDefault,
    sortOrder: currentMode.sortOrder || 999,
    defaultFeedback: currentMode.defaultFeedback || ''
  }
  showModeDialog.value = true
}

const closeModeDialog = () => {
  showModeDialog.value = false
  editingMode.value = null
  editingModeScene.value = null
}

/**
 * 保存模式 - 编辑/新建场景专用方法
 * 职责：处理模式的编辑和新建操作，包括默认状态的设置和更改
 * 数据传递：传递完整的modeForm数据，包含isDefault字段，允许后端处理默认状态逻辑
 * 使用场景：模式编辑对话框的保存操作
 */
const saveMode = async () => {
  console.log('[SceneManagement] saveMode 编辑场景调用:', {
    操作类型: editingMode.value ? '更新模式' : '新建模式',
    模式名称: modeForm.value.name,
    场景ID: editingModeScene.value?.id,
    模式ID: editingMode.value?.id,
    默认状态: modeForm.value.isDefault ? '是' : '否'
  })
  
  if (!modeForm.value.name.trim() || !editingModeScene.value) {
    console.log('[SceneManagement] saveMode 验证失败，提前返回')
    return
  }
  
  saving.value = true
  
  try {
    const sceneId = editingModeScene.value.id
    
    if (editingMode.value) {
      // 更新模式 - 传递完整的modeForm数据，包括isDefault字段
      console.log(`[SceneManagement] 编辑更新模式，传递完整数据（包含isDefault: ${modeForm.value.isDefault}）`)
      const updatedMode = await scenesStore.updateSceneMode(
        sceneId, 
        editingMode.value.id, 
        modeForm.value
      )
      localStatusMessageRef.value?.showMessage('success', `模式"${modeForm.value.name}"已更新`)
      
      // 如果更新了默认状态，需要同步表单数据以保持UI一致性
      if (modeForm.value.isDefault !== undefined) {
        modeForm.value.isDefault = updatedMode.isDefault
        console.log(`[SceneManagement] 默认状态已同步: ${updatedMode.isDefault}`)
      }
    } else {
      // 创建新模式 - 传递完整的modeForm数据，包括isDefault字段
      console.log(`[SceneManagement] 新建模式，传递完整数据（包含isDefault: ${modeForm.value.isDefault}）`)
      await scenesStore.addSceneMode(sceneId, modeForm.value)
      localStatusMessageRef.value?.showMessage('success', `模式"${modeForm.value.name}"已创建`)
    }
    
    closeModeDialog()
    
    // 强制重新加载场景模式数据以获取最新状态
    await loadSceneModes(sceneId, true)
    console.log(`[SceneManagement] saveMode 编辑场景完成`)
  } catch (error) {
    console.error('[SceneManagement] saveMode 编辑场景失败:', error)
    const operation = editingMode.value ? '更新' : '创建'
    localStatusMessageRef.value?.showMessage('error', `${operation}模式失败，请重试`)
  } finally {
    saving.value = false
  }
}

const deleteMode = async (scene: Scene, mode: SceneMode) => {
  // 构建确认消息
  let message = `确定要删除模式"${mode.name}"吗？此操作不可恢复。`
  
  if (mode.isDefault) {
    message += '\n\n⚠️ 您正在删除默认模式，删除后系统将自动选择其他模式作为默认模式。'
  }
  
  // 检查是否是场景中的最后一个模式
  const sceneModes = getSceneModes(scene.id)
  if (sceneModes.length <= 1) {
    message += '\n\n⚠️ 删除此模式后，该场景将没有可用模式。'
  }
  
  const confirmed = await appStore.showConfirm({
    title: '删除模式',
    message,
    type: 'danger',
    confirmText: '删除',
    cancelText: '取消'
  })
  
  if (!confirmed) {
    return
  }
  
  deleting.value = true
  try {
    await scenesStore.deleteSceneMode(scene.id, mode.id)
    
    // 强制重新加载场景模式数据以获取最新状态
    await loadSceneModes(scene.id, true)
  } catch (error) {
    // 错误已通过全局错误处理器显示
  } finally {
    deleting.value = false
  }
}

const editModePrompt = async (scene: Scene, mode: SceneMode) => {
  if (!promptEditorRef.value) return
  
  try {
    // 获取当前提示词
    const currentPrompt = await promptService.getUnifiedPrompt({
      sceneId: scene.id,
      modeId: mode.id
    })
    
    // 显示提示词编辑器
    const saved = await promptEditorRef.value.show({
      scene,
      mode,
      initialPrompt: currentPrompt
    })
    
    if (saved) {
      console.log(`提示词编辑完成: ${scene.name} / ${mode.name}`)
      // 重新加载场景模式数据以获取最新的默认反馈内容
      await loadSceneModes(scene.id, true)
    }
  } catch (error) {
    // 错误已通过全局错误处理器显示
  }
}

// 配置导出导入
const exportConfig = async () => {
  try {
    const config = await promptService.exportSceneConfig()
    
    // 创建下载文件
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scene-config-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    // 显示成功消息
    const totalItems = config.scenes.length + config.modes.length + config.prompts.length
    localStatusMessageRef.value?.showMessage('success', `场景配置导出成功！共导出 ${totalItems} 项数据`)
    
    console.log('[SceneManagement] 场景配置导出完成')
  } catch (error) {
    console.error('[SceneManagement] 导出场景配置失败:', error)
    // 错误已通过全局错误处理器显示
  }
}

const openImportDialog = () => {
  importPreview.value = null
  showImportDialog.value = true
  nextTick(() => {
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  })
}

const closeImportDialog = () => {
  showImportDialog.value = false
  importPreview.value = null
}

const handleFileSelect = (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  
  // 验证文件类型
  if (!file.name.endsWith('.json')) {
    localStatusMessageRef.value?.showMessage('error', '请选择JSON格式的配置文件')
    return
  }
  
  // 验证文件大小（限制为5MB）
  if (file.size > 5 * 1024 * 1024) {
    localStatusMessageRef.value?.showMessage('error', '配置文件过大，请选择小于5MB的文件')
    return
  }
  
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const rawConfig = JSON.parse(e.target?.result as string)
      
      // 验证配置文件的基本结构
      const validationErrors: string[] = []
      
      if (!rawConfig || typeof rawConfig !== 'object') {
        validationErrors.push('无效的JSON格式')
      } else {
        // 检查是否包含必要的字段
        if (!Array.isArray(rawConfig.scenes)) {
          validationErrors.push('缺少scenes数组')
        }
        if (!Array.isArray(rawConfig.modes)) {
          validationErrors.push('缺少modes数组') 
        }
        if (!Array.isArray(rawConfig.prompts)) {
          validationErrors.push('缺少prompts数组')
        }
        
        // 验证数据完整性
        if (rawConfig.scenes && rawConfig.scenes.length > 0) {
          const invalidScenes = rawConfig.scenes.filter((scene: any) => 
            !scene.id || !scene.name || typeof scene.name !== 'string'
          )
          if (invalidScenes.length > 0) {
            validationErrors.push(`${invalidScenes.length}个场景数据不完整`)
          }
        }
        
        if (rawConfig.modes && rawConfig.modes.length > 0) {
          const invalidModes = rawConfig.modes.filter((mode: any) => 
            !mode.id || !mode.name || !mode.sceneId || typeof mode.name !== 'string'
          )
          if (invalidModes.length > 0) {
            validationErrors.push(`${invalidModes.length}个模式数据不完整`)
          }
        }
      }
      
      if (validationErrors.length > 0) {
        localStatusMessageRef.value?.showMessage('error', `配置文件验证失败: ${validationErrors.join(', ')}`)
        return
      }
      
      // 设置预览数据
      importPreview.value = {
        version: rawConfig.version || '2.0',
        exportedAt: rawConfig.exportedAt || Date.now(),
        scenes: rawConfig.scenes || [],
        modes: rawConfig.modes || [],
        prompts: rawConfig.prompts || []
      }
      
      console.log('[SceneManagement] 配置文件验证通过，预览数据已设置')
    } catch (error) {
      console.error('[SceneManagement] 解析配置文件失败:', error)
      localStatusMessageRef.value?.showMessage('error', '配置文件格式错误，请检查JSON语法')
    }
  }
  
  reader.onerror = () => {
    localStatusMessageRef.value?.showMessage('error', '读取文件失败，请重试')
  }
  
  reader.readAsText(file)
}

const importConfig = async () => {
  if (!importPreview.value) return
  
  importing.value = true
  
  try {
    await promptService.importSceneConfig(importPreview.value)
    
    // 重新加载场景数据
    await scenesStore.loadScenes()
    
    // 清空现有数据，重新按需加载
    sceneModeData.value = new Map()
    await preloadVisibleSceneModes()
    
    // 显示成功消息
    const totalItems = importPreview.value.scenes.length + importPreview.value.modes.length + importPreview.value.prompts.length
    localStatusMessageRef.value?.showMessage('success', `场景配置导入成功！共导入 ${totalItems} 项数据`)
    
    closeImportDialog()
    
    console.log('[SceneManagement] 场景配置导入完成，数据已刷新')
  } catch (error) {
    console.error('[SceneManagement] 导入场景配置失败:', error)
    // 显示详细的错误信息
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    localStatusMessageRef.value?.showMessage('error', `导入失败: ${errorMessage}`)
  } finally {
    importing.value = false
  }
}

const handleModalClick = (e: Event) => {
  if (e.target === e.currentTarget) {
    if (showSceneDialog.value) closeSceneDialog()
    if (showModeDialog.value) closeModeDialog()
    if (showImportDialog.value) closeImportDialog()
  }
}

const handleSidebarClick = (e: Event) => {
  // 如果点击的是遮罩层本身（而不是侧边栏内容），则关闭侧边栏
  if (e.target === e.currentTarget) {
    closeDetailSidebar()
  }
}

// 提示词保存处理
const handlePromptSave = async (event: Event) => {
  const customEvent = event as CustomEvent
  const { sceneId, modeId, prompt } = customEvent.detail
  
  try {
    await promptService.saveUnifiedPrompt({ sceneId, modeId }, prompt)
    localStatusMessageRef.value?.showMessage('success', '提示词已保存')
    
    // 触发保存完成事件
    window.dispatchEvent(new CustomEvent('promptSaveComplete'))
  } catch (error) {
    localStatusMessageRef.value?.showMessage('error', '保存提示词失败，请重试')
    throw error
  }
}

// 默认反馈保存处理
const handleDefaultFeedbackSave = async (event: Event) => {
  const customEvent = event as CustomEvent
  const { sceneId, modeId, defaultFeedback } = customEvent.detail
  
  console.log('[SceneManagement] handleDefaultFeedbackSave 调用:', { sceneId, modeId, defaultFeedback })
  
  try {
    // 获取当前模式的完整信息，确保包含name和description
    const currentMode = getSceneModes(sceneId).find(m => m.id === modeId)
    if (!currentMode) {
      throw new Error(`找不到模式: ${modeId}`)
    }
    
    // 更新模式的默认反馈内容，包含所有必需字段
    await scenesStore.updateSceneMode(sceneId, modeId, {
      name: currentMode.name,           // 必须包含name
      description: currentMode.description, // 必须包含description
      shortcut: currentMode.shortcut,
      isDefault: currentMode.isDefault,
      sortOrder: currentMode.sortOrder,
      defaultFeedback // 更新目标字段
    })
    
    // 触发保存完成事件
    window.dispatchEvent(new CustomEvent('defaultFeedbackSaveComplete'))
  } catch (error) {
    // 错误已通过全局错误处理器显示
    throw error
  }
}

// 拖拽排序完成处理
const handleModeReorder = async (event: any) => {
  if (!managementSelectedScene.value) return
  
  const { oldIndex, newIndex } = event
  const startTime = performance.now()
  console.log(`[handleModeReorder] 拖拽事件: oldIndex=${oldIndex}, newIndex=${newIndex}`)
  
  if (oldIndex === newIndex) {
    console.log('[handleModeReorder] 位置未变化，跳过更新')
    return
  }
  
  saving.value = true
  try {
    const sceneId = managementSelectedScene.value.id
    const newOrderedModes = currentModesList.value
    
    // 重新分配快捷键和sortOrder
    const updates = reassignShortcutsAndOrder(newOrderedModes)
    
    if (updates.length > 0) {
      // 批量更新 - 使用拖拽后的数据，并获取最新数据
      const latestModes = await batchUpdateModes(sceneId, newOrderedModes, updates)
      
      // 直接更新本地缓存，避免重复API调用
      const newMap = new Map(sceneModeData.value)
      newMap.set(sceneId, latestModes)
      sceneModeData.value = newMap
      
      const endTime = performance.now()
      console.log(`[handleModeReorder] 排序更新完成，耗时: ${(endTime - startTime).toFixed(2)}ms，更新数量: ${updates.length}`)
      localStatusMessageRef.value?.showMessage('success', `模式排序已更新，共更新 ${updates.length} 个模式`)
    } else {
      const endTime = performance.now()
      console.log(`[handleModeReorder] 排序未发生变化，跳过更新，耗时: ${(endTime - startTime).toFixed(2)}ms`)
      localStatusMessageRef.value?.showMessage('info', '模式排序未发生变化')
    }
  } catch (error) {
    const endTime = performance.now()
    console.error(`[handleModeReorder] 排序更新失败，耗时: ${(endTime - startTime).toFixed(2)}ms`, error)
    localStatusMessageRef.value?.showMessage('error', '排序更新失败，请重试')
    
    // 错误时重新加载数据恢复状态
    if (managementSelectedScene.value) {
      await loadSceneModes(managementSelectedScene.value.id, true)
    }
  } finally {
    saving.value = false
  }
}

// 场景拖拽排序完成处理
const handleSceneReorder = async (event: any) => {
  const { oldIndex, newIndex } = event
  if (oldIndex === newIndex) {
    return
  }
  
  saving.value = true
  try {
    const newOrderedScenes = [...scenes.value] 
    
    // 重新分配sortOrder
    const updates = reassignSceneOrder(newOrderedScenes)
    if (updates.length > 0) {
      // 批量更新场景排序
      await batchUpdateScenes(newOrderedScenes, updates)
      localStatusMessageRef.value?.showMessage('success', `场景排序已更新，共更新 ${updates.length} 个场景`)
    } else {
      localStatusMessageRef.value?.showMessage('info', '场景排序未发生变化')
    }
  } catch (error) {
    localStatusMessageRef.value?.showMessage('error', '排序更新失败，请重试')
    // 错误时重新加载数据恢复状态
    await scenesStore.loadScenes()
  } finally {
    saving.value = false
  }
}

// 重新分配场景排序
const reassignSceneOrder = (scenes: Scene[]) => {
  const updates: Array<{
    sceneId: string
    sortOrder: number
  }> = []
  
  // 只更新实际发生sortOrder变化的场景，避免不必要的API调用
  scenes.forEach((scene, index) => {
    const newSortOrder = index
    
    // 仅当sortOrder实际发生变化时才添加到更新列表
    if (scene.sortOrder !== newSortOrder) {
      updates.push({
        sceneId: scene.id,
        sortOrder: newSortOrder
      })
    }
  })
  
  console.log(`[reassignSceneOrder] 检查 ${scenes.length} 个场景，需要更新 ${updates.length} 个场景的排序:`, updates)
  
  return updates
}

// 批量更新场景排序
const batchUpdateScenes = async (
  scenes: Scene[],
  updates: Array<{
    sceneId: string
    sortOrder: number
  }>
): Promise<void> => {
  console.log(`[batchUpdateScenes] 开始场景排序更新，更新数量: ${updates.length}`)
  
  // 使用并行单个更新
  const updatePromises = updates.map(update => {
    const currentScene = scenes.find(s => s.id === update.sceneId)
    if (!currentScene) {
      throw new Error(`找不到场景: ${update.sceneId}`)
    }
    
    console.log(`[batchUpdateScenes] 更新场景排序 ${currentScene.name}:`, {
      sceneId: update.sceneId,
      sortOrder: update.sortOrder
    })
    
    return scenesStore.updateScene(update.sceneId, {
      sortOrder: update.sortOrder
    })
  })
  
  await Promise.all(updatePromises)
  console.log('[batchUpdateScenes] 场景排序更新完成')
  
  // 重新加载场景数据确保UI与数据库同步
  await scenesStore.loadScenes()
}

// 重新分配快捷键和排序
const reassignShortcutsAndOrder = (modes: SceneMode[]) => {
  const updates: Array<{
    modeId: string
    shortcut: string | undefined
    sortOrder: number
  }> = []
  
  modes.forEach((mode, index) => {
    const newShortcut = index < 9 ? (index + 1).toString() : undefined
    const newSortOrder = index
    
    // 只有当快捷键或排序实际发生变化时才更新
    if (mode.shortcut !== newShortcut || mode.sortOrder !== newSortOrder) {
      updates.push({
        modeId: mode.id,
        shortcut: newShortcut,
        sortOrder: newSortOrder
      })
    }
  })
  
  console.log(`[reassignShortcutsAndOrder] 检查 ${modes.length} 个模式，需要更新 ${updates.length} 个模式的快捷键和排序:`, updates)
  
  return updates
}

/**
 * 批量处理快捷键冲突 - 拖拽排序后的统一冲突解决
 * 职责：在批量更新完成后，统一检查和解决快捷键冲突，避免重复API调用
 * 使用场景：batchUpdateModes完成后调用
 * @returns 返回冲突处理后的最新模式数据
 */
const handleBatchShortcutConflicts = async (
  sceneId: string,
  updates: Array<{
    modeId: string
    shortcut: string | undefined
    sortOrder: number
  }>
): Promise<SceneMode[]> => {
  // 获取涉及快捷键更新的模式
  const shortcutUpdates = updates.filter(update => 
    update.shortcut && /^\d$/.test(update.shortcut)
  )
  
  if (shortcutUpdates.length === 0) {
    console.log('[handleBatchShortcutConflicts] 无快捷键更新，跳过冲突检查')
    // 仍需获取最新数据返回
    return await promptService.getSceneModes(sceneId)
  }
  
  console.log(`[handleBatchShortcutConflicts] 检查 ${shortcutUpdates.length} 个快捷键更新的冲突`)
  
  // 获取最新的场景模式数据（第一次调用）
  const allModes = await promptService.getSceneModes(sceneId)
  
  // 构建快捷键使用情况映射
  const shortcutMap = new Map<string, string>() // shortcut -> modeId
  allModes.forEach(mode => {
    if (mode.shortcut && /^\d$/.test(mode.shortcut)) {
      const existingModeId = shortcutMap.get(mode.shortcut)
      if (existingModeId && existingModeId !== mode.id) {
        // 发现冲突，需要解决
        console.log(`[handleBatchShortcutConflicts] 发现快捷键冲突: ${mode.shortcut} 被模式 ${existingModeId} 和 ${mode.id} 同时使用`)
      }
      shortcutMap.set(mode.shortcut, mode.id)
    }
  })
  
  // 检查是否有重复的快捷键，如有则解决冲突
  const conflictResolutions: Promise<void>[] = []
  const usedShortcuts = new Set<string>()
  
  // 遍历所有模式，解决冲突
  allModes.forEach(mode => {
    if (mode.shortcut && /^\d$/.test(mode.shortcut)) {
      if (usedShortcuts.has(mode.shortcut)) {
        // 发现冲突，为后面的模式分配新快捷键
        const conflictResolution = resolveShortcutConflict(sceneId, mode, usedShortcuts)
        conflictResolutions.push(conflictResolution)
      } else {
        usedShortcuts.add(mode.shortcut)
      }
    }
  })
  
  // 等待所有冲突解决完成
  if (conflictResolutions.length > 0) {
    await Promise.all(conflictResolutions)
    console.log(`[handleBatchShortcutConflicts] 已解决 ${conflictResolutions.length} 个快捷键冲突`)
    // 如果有冲突解决，需要重新获取最新数据
    return await promptService.getSceneModes(sceneId)
  } else {
    console.log('[handleBatchShortcutConflicts] 无快捷键冲突需要解决')
    // 无冲突时直接返回之前获取的数据
    return allModes
  }
}

/**
 * 解决单个模式的快捷键冲突
 */
const resolveShortcutConflict = async (
  sceneId: string, 
  conflictMode: SceneMode, 
  usedShortcuts: Set<string>
): Promise<void> => {
  // 找到下一个可用的快捷键数字
  let nextShortcut = 1
  while (nextShortcut <= 9 && usedShortcuts.has(nextShortcut.toString())) {
    nextShortcut++
  }
  
  const newShortcut = nextShortcut <= 9 ? nextShortcut.toString() : ''
  
  // 更新冲突模式的快捷键
  await scenesStore.updateSceneMode(sceneId, conflictMode.id, {
    name: conflictMode.name,
    description: conflictMode.description,
    shortcut: newShortcut,
    isDefault: conflictMode.isDefault,
    sortOrder: conflictMode.sortOrder,
    defaultFeedback: conflictMode.defaultFeedback
  }, true) // 跳过冲突检查，避免递归
  
  if (newShortcut) {
    usedShortcuts.add(newShortcut)
    console.log(`快捷键冲突已解决：模式"${conflictMode.name}"的快捷键从"${conflictMode.shortcut}"改为"${newShortcut}"`)
  } else {
    console.log(`快捷键冲突已解决：模式"${conflictMode.name}"的快捷键已清除（1-9已全部占用）`)
  }
}

/**
 * 批量更新模式 - 拖拽排序专用方法
 * @returns 返回批量更新后的最新模式数据
 */
const batchUpdateModes = async (
  sceneId: string, 
  modes: SceneMode[], // 传入完整的模式数据，确保数据一致性
  updates: Array<{
    modeId: string
    shortcut: string | undefined
    sortOrder: number
  }>
): Promise<SceneMode[]> => {
  console.log(`[batchUpdateModes] 开始拖拽排序更新，场景: ${sceneId}, 更新数量: ${updates.length}`)
  
  // 由于后端暂无批量更新API，使用并行单个更新
  const updatePromises = updates.map(update => {
    // 从传入的modes数组中获取当前模式的完整信息，确保数据一致性
    const currentMode = modes.find(m => m.id === update.modeId)
    if (!currentMode) {
      throw new Error(`找不到模式: ${update.modeId}`)
    }
    
    // 构建更新数据 - 拖拽排序时不传递isDefault，避免后端重复清除默认状态
    const updateData: any = {
      name: currentMode.name,           // 必须包含name
      description: currentMode.description, // 必须包含description
      shortcut: update.shortcut,
      sortOrder: update.sortOrder,
      defaultFeedback: currentMode.defaultFeedback
    }
    
    console.log(`[batchUpdateModes] 拖拽排序更新模式 ${currentMode.name}:`, {
      modeId: update.modeId,
      shortcut: update.shortcut,
      sortOrder: update.sortOrder,
      保持默认状态: currentMode.isDefault ? '是' : '否'
    })
    
    // 批量操作时跳过快捷键冲突检查，由外层统一处理
    return scenesStore.updateSceneMode(sceneId, update.modeId, updateData, true)
  })
  
  await Promise.all(updatePromises)
  
  // 批量更新完成后，进行统一的快捷键冲突检查和解决，并获取最新数据
  try {
    const latestModes = await handleBatchShortcutConflicts(sceneId, updates)
    console.log(`[batchUpdateModes] 拖拽排序更新完成，场景: ${sceneId}`)
    return latestModes
  } catch (error) {
    console.warn('[batchUpdateModes] 快捷键冲突解决失败:', error)
    // 发生错误时，仍需返回最新数据，通过直接调用API获取
    console.log(`[batchUpdateModes] 错误恢复：重新获取场景模式数据`)
    return await promptService.getSceneModes(sceneId)
  }
}

// 生命周期
onMounted(async () => {
  if (!hasScenes.value) {
    await scenesStore.loadScenes()
  }
  
  // 添加提示词保存事件监听器
  window.addEventListener('savePrompt', handlePromptSave)
  // 添加默认反馈保存事件监听器
  window.addEventListener('saveDefaultFeedback', handleDefaultFeedbackSave)
  
  // 预加载可见场景的模式数据
  await preloadVisibleSceneModes()
})

// 预加载所有场景的模式数据（按需加载，无需预加载）
const preloadVisibleSceneModes = async () => {
  try {
    // 只预加载当前可见的场景数据，优化性能
    for (const scene of scenes.value.slice(0, 6)) { // 只预加载前6个场景
      await loadSceneModes(scene.id)
    }
  } catch (error) {
    // 错误已通过全局错误处理器显示
  }
}
</script>

<style scoped>
.scene-management {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 0 20px;
}

/* 头部工具栏 */
.management-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 0 16px 0;
  border-bottom: 1px solid #3e3e42;
  margin-bottom: 20px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.page-title {
  font-size: 20px;
  font-weight: 600;
  color: #ffffff;
  margin: 0;
}

.scene-count {
  font-size: 12px;
  color: #969696;
  background: #2d2d30;
  padding: 4px 8px;
  border-radius: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn.primary {
  background: #007acc;
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: #005a9e;
}

.action-btn.secondary {
  background: #3e3e42;
  color: #cccccc;
}

.action-btn.secondary:hover:not(:disabled) {
  background: #4a4a4f;
}

.action-btn.small {
  padding: 4px 8px;
  font-size: 11px;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}



/* 加载和空状态 */
.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  text-align: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #3e3e42;
  border-top: 3px solid #007acc;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.empty-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 16px;
  color: #969696;
}

.empty-state h3 {
  color: #ffffff;
  margin-bottom: 8px;
}

.empty-state p {
  color: #969696;
  margin-bottom: 20px;
}

/* 场景列表 */
.scene-list-container {
  flex: 1;
  overflow-y: auto;
}

.scene-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  padding-right: 8px;
}

.scene-card {
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  padding: 16px;
  transition: all 0.2s ease;
  position: relative;
}

.scene-card .drag-handle {
  cursor: grab;
  color: #666666;
  font-size: 14px;
  padding: 4px;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
  margin-right: 8px;
  flex-shrink: 0;
}

.scene-card:hover .drag-handle {
  opacity: 1;
}

.scene-card .drag-handle:hover {
  color: #007acc;
  background: rgba(0, 122, 204, 0.1);
}

.scene-card .drag-handle:active {
  cursor: grabbing;
}

.scene-card:hover {
  border-color: #007acc;
  box-shadow: 0 2px 8px rgba(0, 122, 204, 0.2);
}

.scene-card.active {
  border-color: #007acc;
  background: #1e2a3a;
}


.scene-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.scene-info {
  flex: 1;
  min-width: 0;
}

.scene-name {
  font-size: 16px;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 4px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.default-badge {
  font-size: 10px;
  background: #f39c12;
  color: #1e1e1e;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 500;
}

.scene-description {
  font-size: 13px;
  color: #969696;
  margin: 0;
  line-height: 1.4;
}

.scene-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.scene-card:hover .scene-actions {
  opacity: 1;
}

.icon-btn {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.2s ease;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn .icon {
  width: 16px;
  height: 16px;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.icon-btn.detail:hover {
  background: #007acc;
  color: white;
}

.icon-btn.delete:hover {
  background: #d73a49;
  color: white;
}

.icon-btn.small {
  padding: 2px;
  font-size: 10px;
}

.icon-btn.small .icon {
  width: 14px;
  height: 14px;
}

.scene-stats {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  padding: 8px 0;
  border-top: 1px solid #3e3e42;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.stat-label {
  font-size: 10px;
  color: #969696;
  text-transform: uppercase;
}

.stat-value {
  font-size: 12px;
  color: #cccccc;
  font-weight: 500;
}

/* 模式预览 */
.modes-preview {
  border-top: 1px solid #3e3e42;
  padding-top: 12px;
}

.modes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.modes-title {
  font-size: 12px;
  color: #969696;
  font-weight: 500;
}

.add-mode-btn {
  background: none;
  border: 1px solid #007acc;
  color: #007acc;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-mode-btn .icon {
  width: 12px;
  height: 12px;
}

.add-mode-btn:hover {
  background: #007acc;
  color: white;
}

.add-mode-btn.small {
  padding: 4px 8px;
  font-size: 11px;
}

.modes-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mode-chip {
  background: #3e3e42;
  color: #cccccc;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mode-chip.default {
  background: #007acc;
  color: white;
}

.mode-chip.more {
  background: #2d2d30;
  color: #969696;
}

.mode-default {
  font-size: 8px;
  opacity: 0.8;
}

.no-modes {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-top: 1px solid #3e3e42;
  color: #969696;
  font-size: 12px;
}

/* 侧边栏遮罩层 */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.3);
  z-index: 999;
  transition: opacity 0.3s ease;
}

/* 侧边栏 */
.scene-detail-sidebar {
  position: fixed;
  top: 0;
  right: -400px;
  width: 400px;
  height: 100vh;
  background: #252526;
  border-left: 1px solid #3e3e42;
  transition: right 0.3s ease;
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.scene-detail-sidebar.open {
  right: 0;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #3e3e42;
  background: #2d2d30;
}

.sidebar-header h3 {
  color: #ffffff;
  margin: 0;
  font-size: 16px;
}

.close-sidebar {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.detail-section {
  margin-bottom: 24px;
}

.detail-section h4 {
  color: #ffffff;
  margin: 0 0 12px 0;
  font-size: 14px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.info-grid {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 11px;
  color: #969696;
  text-transform: uppercase;
  font-weight: 500;
}

.info-item span {
  font-size: 13px;
  color: #cccccc;
}

.empty-modes {
  text-align: center;
  padding: 20px;
  color: #969696;
  font-size: 13px;
}

.modes-detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-detail-item {
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 6px;
  padding: 12px;
  display: flex;
  align-items: flex-start;
  transition: all 0.2s ease;
  cursor: grab;
}

.mode-detail-item:active {
  cursor: grabbing;
}

.mode-detail-item:hover {
  border-color: #007acc;
  background: #2d2d30;
}

/* 拖拽手柄样式 */
.drag-handle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 40px;
  color: #969696;
  cursor: grab;
  margin-right: 8px;
  font-size: 12px;
  line-height: 1;
  user-select: none;
  flex-shrink: 0;
}

.drag-handle:hover {
  color: #007acc;
}

.drag-handle:active {
  cursor: grabbing;
}

/* vue-draggable-plus提供的样式类 */
.mode-ghost {
  opacity: 0.5;
  background: #2d2d30;
  border: 2px dashed #007acc;
}

.mode-chosen {
  background: #1e2a3a;
  border-color: #007acc;
  transform: scale(0.98);
}

/* 场景拖拽样式 */
.scene-ghost {
  opacity: 0.5;
  background: #2d2d30;
  border: 2px dashed #007acc;
  transform: scale(0.98);
}

.scene-chosen {
  background: #1e2a3a;
  border-color: #007acc;
  transform: scale(0.98);
  box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
}

.mode-info {
  flex: 1;
  min-width: 0;
}

.mode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.mode-name {
  font-size: 14px;
  color: #ffffff;
  font-weight: 500;
}

.mode-badges {
  display: flex;
  gap: 4px;
}

.badge {
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 8px;
  font-weight: 500;
}

.badge.default {
  background: #f39c12;
  color: #1e1e1e;
}

.badge.shortcut {
  background: #007acc;
  color: white;
}

.mode-description {
  font-size: 12px;
  color: #969696;
  margin: 0;
  line-height: 1.4;
}

.mode-actions {
  display: flex;
  gap: 4px;
  margin-left: 8px;
  flex-shrink: 0;
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
  z-index: 2000;
}

.modal-content {
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 8px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #2d2d30;
  border-bottom: 1px solid #3e3e42;
}

.modal-header h3 {
  margin: 0;
  font-size: 16px;
  color: #ffffff;
}

.modal-close {
  background: none;
  border: none;
  color: #cccccc;
  cursor: pointer;
  font-size: 18px;
  padding: 4px;
}

.modal-body {
  padding: 20px;
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

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #cccccc;
  font-weight: 500;
}

.form-input, .form-textarea {
  width: 100%;
  padding: 8px 12px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  font-size: 13px;
  transition: border-color 0.2s ease;
}

.form-input:focus, .form-textarea:focus {
  outline: none;
  border-color: #007acc;
}

.form-textarea {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

.form-file {
  width: 100%;
  padding: 8px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
  color: #cccccc;
  font-size: 13px;
}

.checkbox-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.checkbox-label input[type="checkbox"] {
  width: auto;
  margin: 0;
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

.btn.primary {
  background: #007acc;
  color: white;
}

.btn.primary:hover:not(:disabled) {
  background: #005a9e;
}

.btn.secondary {
  background: #3e3e42;
  color: #cccccc;
}

.btn.secondary:hover:not(:disabled) {
  background: #4a4a4f;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 快捷键显示样式 */
.shortcut-display {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: #2d2d30;
  border: 1px solid #3e3e42;
  border-radius: 4px;
}

.shortcut-value {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  min-width: 20px;
}

.shortcut-note {
  font-size: 12px;
  color: #969696;
}

.import-preview {
  margin-top: 16px;
  padding: 12px;
  background: #1e1e1e;
  border: 1px solid #3e3e42;
  border-radius: 4px;
}

.import-preview h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  color: #ffffff;
}

.preview-stats {
  display: flex;
  gap: 12px;
}

.stat {
  font-size: 12px;
  color: #969696;
  background: #2d2d30;
  padding: 4px 8px;
  border-radius: 4px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .management-header {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  
  .header-actions {
    justify-content: space-between;
  }
  
  .scene-grid {
    grid-template-columns: 1fr;
  }
  
  .scene-detail-sidebar {
    width: 100%;
    right: -100%;
  }
  
  .modal-content {
    width: 95%;
    margin: 20px;
  }
}

/* 开关样式 */
.switch-label {
  display: flex !important;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  margin: 0;
}

.switch-text {
  font-size: 13px;
  color: #cccccc;
  font-weight: 500;
}

.switch-container {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.switch-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.switch-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #3e3e42;
  border-radius: 24px;
  transition: all 0.3s ease;
}

.switch-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: #cccccc;
  border-radius: 50%;
  transition: all 0.3s ease;
}

.switch-input:checked + .switch-slider {
  background-color: #007acc;
}

.switch-input:checked + .switch-slider:before {
  transform: translateX(20px);
  background-color: white;
}

.switch-input:disabled + .switch-slider {
  opacity: 0.6;
  cursor: not-allowed;
}

.switch-slider:hover {
  box-shadow: 0 0 8px rgba(0, 122, 204, 0.3);
}
</style> 