# 提示词编辑器组件 (PromptEditor.vue)

## 📋 组件概述

提示词编辑器是一个专业的文本编辑组件，专门用于编辑和管理AI提示词模板。该组件提供了语法高亮、变量提示、实时预览等高级编辑功能。

- **文件路径**: `frontend/src/components/PromptEditor.vue`
- **代码行数**: 534行
- **组件类型**: 专业编辑器组件
- **主要功能**: 提示词编辑、模板预览、语法验证

## 🎯 核心功能

### 1. 高级文本编辑
- **语法高亮**: 支持Markdown和模板语法高亮
- **行号显示**: 可选的行号显示功能
- **代码折叠**: 支持长文本的折叠和展开
- **自动缩进**: 智能的自动缩进和格式化

### 2. 模板变量支持
- **变量识别**: 自动识别`{{ variable }}`格式的模板变量
- **变量提示**: 输入时提供变量名称的自动补全
- **变量验证**: 检查变量名称的有效性
- **变量高亮**: 特殊颜色显示模板变量

### 3. 实时预览
- **分屏预览**: 编辑器和预览区域并排显示
- **实时渲染**: 编辑时实时更新预览内容
- **变量替换**: 预览时使用示例数据替换变量
- **Markdown渲染**: 支持Markdown格式的预览

### 4. 编辑辅助
- **快捷键**: 丰富的键盘快捷键支持
- **查找替换**: 文本查找和批量替换功能
- **撤销重做**: 完整的编辑历史管理
- **自动保存**: 定时自动保存编辑内容

## 🔧 技术实现

### Vue 3 Composition API
```typescript
// 编辑器状态管理
const editorContent = ref('')
const previewContent = ref('')
const showPreview = ref(false)
const isFullscreen = ref(false)
const cursorPosition = ref({ line: 1, column: 1 })

// 计算属性
const hasContent = computed(() => editorContent.value.trim().length > 0)
const wordCount = computed(() => editorContent.value.trim().split(/\s+/).length)
const lineCount = computed(() => editorContent.value.split('\n').length)
```

### 模板变量处理
```typescript
// 变量提取和验证
const extractVariables = (content: string): string[] => {
  const variableRegex = /\{\{\s*(\w+)\s*\}\}/g
  const variables: string[] = []
  let match
  
  while ((match = variableRegex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1])
    }
  }
  
  return variables
}

// 变量替换预览
const renderPreview = (content: string, variables: Record<string, string>): string => {
  let rendered = content
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g')
    rendered = rendered.replace(regex, value)
  })
  
  return rendered
}
```

### 语法高亮
```typescript
// 语法高亮规则
const highlightRules = {
  // 模板变量
  variable: {
    pattern: /\{\{\s*\w+\s*\}\}/g,
    className: 'template-variable'
  },
  // Markdown标题
  heading: {
    pattern: /^#{1,6}\s+.+$/gm,
    className: 'markdown-heading'
  },
  // 代码块
  codeBlock: {
    pattern: /```[\s\S]*?```/g,
    className: 'code-block'
  },
  // 行内代码
  inlineCode: {
    pattern: /`[^`]+`/g,
    className: 'inline-code'
  }
}

// 应用语法高亮
const applyHighlight = (content: string): string => {
  let highlighted = content
  
  Object.values(highlightRules).forEach(rule => {
    highlighted = highlighted.replace(rule.pattern, (match) => {
      return `<span class="${rule.className}">${match}</span>`
    })
  })
  
  return highlighted
}
```

## 🎨 UI设计特点

### 1. 编辑器界面
- **Monaco Editor**: 基于VS Code的编辑器内核
- **深色主题**: 适合长时间编辑的深色主题
- **自定义主题**: 可配置的颜色主题
- **响应式布局**: 适配不同屏幕尺寸

### 2. 工具栏
- **格式化按钮**: 一键格式化文本
- **插入模板**: 快速插入常用模板片段
- **预览切换**: 切换预览模式
- **全屏编辑**: 全屏专注编辑模式

### 3. 状态栏
- **光标位置**: 显示当前光标的行列位置
- **字符统计**: 显示字符数和行数统计
- **语法状态**: 显示语法检查结果
- **保存状态**: 显示文档保存状态

## 📊 性能优化

### 1. 虚拟滚动
```typescript
// 大文档的虚拟滚动
const useVirtualScroll = (content: string) => {
  const lines = content.split('\n')
  const visibleLines = ref<string[]>([])
  const scrollTop = ref(0)
  const lineHeight = 20
  const containerHeight = 400
  
  const updateVisibleLines = () => {
    const startLine = Math.floor(scrollTop.value / lineHeight)
    const endLine = Math.min(
      startLine + Math.ceil(containerHeight / lineHeight) + 1,
      lines.length
    )
    
    visibleLines.value = lines.slice(startLine, endLine)
  }
  
  return { visibleLines, updateVisibleLines }
}
```

### 2. 防抖处理
```typescript
// 编辑防抖
const debouncedSave = debounce((content: string) => {
  saveContent(content)
}, 1000)

// 预览更新防抖
const debouncedPreview = debounce((content: string) => {
  updatePreview(content)
}, 300)
```

### 3. 内存管理
- **事件清理**: 编辑器销毁时清理所有事件监听
- **缓存管理**: 合理使用缓存避免重复计算
- **延迟加载**: 按需加载编辑器功能模块

## 🔌 集成特性

### 与场景管理集成
```typescript
// 场景模式切换时更新编辑器内容
watch(() => scenesStore.currentSelection, async (newSelection) => {
  if (newSelection.sceneId && newSelection.modeId) {
    const prompt = await promptService.getScenePrompt(
      newSelection.sceneId, 
      newSelection.modeId
    )
    editorContent.value = prompt || ''
  }
}, { immediate: true })
```

### 与提示词服务集成
```typescript
// 保存提示词
const savePrompt = async () => {
  try {
    isSaving.value = true
    
    await promptService.saveScenePrompt(
      currentSelection.value.sceneId,
      currentSelection.value.modeId,
      editorContent.value
    )
    
    showSuccess('提示词保存成功')
  } catch (error) {
    showError('保存失败: ' + error.message)
  } finally {
    isSaving.value = false
  }
}
```

## 🛠️ 快捷键支持

### 编辑快捷键
```typescript
const shortcuts = {
  'Ctrl+S': () => savePrompt(),           // 保存
  'Ctrl+Z': () => undo(),                 // 撤销
  'Ctrl+Y': () => redo(),                 // 重做
  'Ctrl+F': () => showFindDialog(),       // 查找
  'Ctrl+H': () => showReplaceDialog(),    // 替换
  'F11': () => toggleFullscreen(),        // 全屏
  'Ctrl+P': () => togglePreview(),        // 预览
  'Ctrl+Shift+F': () => formatContent()  // 格式化
}
```

## 🔍 验证功能

### 模板语法验证
```typescript
// 验证模板语法
const validateTemplate = (content: string): ValidationResult => {
  const errors: ValidationError[] = []
  
  // 检查未闭合的变量
  const openBraces = (content.match(/\{\{/g) || []).length
  const closeBraces = (content.match(/\}\}/g) || []).length
  
  if (openBraces !== closeBraces) {
    errors.push({
      type: 'syntax',
      message: '模板变量括号不匹配',
      line: findUnmatchedBrace(content)
    })
  }
  
  // 检查变量名称格式
  const invalidVariables = content.match(/\{\{\s*[^}\w\s]+\s*\}\}/g)
  if (invalidVariables) {
    errors.push({
      type: 'variable',
      message: '无效的变量名称格式',
      details: invalidVariables
    })
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
```

## 🧪 使用示例

### 基本使用
```vue
<template>
  <PromptEditor 
    v-model="promptContent"
    :show-preview="true"
    :enable-syntax-highlight="true"
    @save="handleSave"
  />
</template>

<script setup lang="ts">
import PromptEditor from './components/PromptEditor.vue'

const promptContent = ref('')

const handleSave = (content: string) => {
  console.log('保存提示词:', content)
}
</script>
```

### 高级配置
```vue
<template>
  <PromptEditor 
    v-model="promptContent"
    :options="editorOptions"
    :variables="availableVariables"
    :theme="editorTheme"
    @change="handleContentChange"
    @validate="handleValidation"
  />
</template>

<script setup lang="ts">
const editorOptions = {
  lineNumbers: true,
  wordWrap: true,
  minimap: false,
  fontSize: 14
}

const availableVariables = ['feedback', 'user', 'timestamp']
const editorTheme = 'dark'
</script>
```

## 🧭 相关文档

- **[场景管理组件](./scene-management.md)** - 场景和模式管理
- **[快捷语模式选择器](./phrase-mode-selector.md)** - 模式选择功能
- **[提示词服务](../服务/index.md)** - 后端提示词管理
- **[场景状态管理](../状态管理/index.md)** - 状态同步机制

---

*提示词编辑器组件文档最后更新: 2024年1月* 