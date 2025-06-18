# 反馈表单组件 (FeedbackForm.vue)

## 📋 组件概述

反馈表单组件是用户与系统交互的核心界面，提供了完整的反馈输入、图片上传、快捷语选择和提交功能。该组件集成了多个子组件，实现了现代化的用户体验。

- **文件路径**: `frontend/src/components/FeedbackForm.vue`
- **代码行数**: 622行
- **组件类型**: 复合业务组件
- **依赖组件**: PhraseModeSelector, ImageUpload

## 🎯 核心功能

### 1. 反馈内容输入
- **动态文本域**: 自适应高度的文本输入区域
- **占位符提示**: 显示当前模式的默认反馈内容
- **粘贴支持**: 处理文本和图片的粘贴操作
- **快捷键支持**: Cmd+Enter (Mac) / Ctrl+Enter (Windows) 快速提交

### 2. 快捷语模式集成
- **模式选择器**: 集成PhraseModeSelector组件
- **提示词应用**: 自动将快捷语应用到用户反馈
- **模板变量**: 支持`{{ feedback }}`占位符替换
- **默认反馈**: 空输入时使用当前模式的默认反馈

### 3. 图片上传功能
- **图片组件**: 集成ImageUpload组件
- **多文件支持**: 支持多张图片同时上传
- **可选附件**: 图片上传为可选功能

### 4. 表单验证与提交
- **内容验证**: 确保反馈内容或图片至少有一项
- **连接检查**: 验证Socket.IO连接状态
- **会话验证**: 检查MCP反馈会话的有效性
- **演示模式**: 无会话时的演示功能

## 🔧 技术实现

### Vue 3 Composition API
```typescript
// 主要的响应式状态
const feedbackText = ref('')
const isSubmitting = ref(false)
const textareaHeight = ref('120px')
const feedbackBodyRef = ref<HTMLElement>()
const textareaRef = ref<HTMLTextAreaElement>()

// 计算属性
const shortcutText = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '⌘⏎' : 'Ctrl+⏎'
})

const placeholderText = computed(() => {
  const defaultFeedback = getDefaultFeedback()
  return `默认反馈: "${defaultFeedback}"` || '请输入您对本次工作的反馈和建议...'
})
```

### Store集成
```typescript
// 多Store协作
const feedbackStore = useFeedbackStore()      // 反馈数据管理
const connectionStore = useConnectionStore()  // 连接状态管理
const appStore = useAppStore()                // 应用状态管理
const scenesStore = useScenesStore()          // 场景状态管理
```

### 快捷语处理逻辑
```typescript
// 应用快捷语到反馈内容
const applyQuickPhraseToFeedback = async (text: string): Promise<string> => {
  try {
    const quickPhrase = await getCustomQuickPhrase()
    
    if (!quickPhrase) {
      return text
    }
    
    // 检查提示词中是否包含 {{ feedback }} 占位符
    if (quickPhrase.includes('{{ feedback }}')) {
      // 替换占位符
      return quickPhrase.replace(/\{\{\s*feedback\s*\}\}/g, text)
    } else {
      // 提示词在前，反馈内容在后，用---分割
      return quickPhrase.trim() + '\n\n---\n' + text
    }
  } catch (error) {
    console.error('应用提示词失败，使用原始反馈内容:', error)
    return text
  }
}
```

## 🎨 UI设计特点

### 1. 响应式布局
- **弹性容器**: 使用flexbox布局
- **自适应高度**: 文本域根据内容自动调整
- **移动端适配**: 支持触屏设备操作

### 2. 深色主题
- **统一配色**: 与系统整体主题保持一致
- **高对比度**: 确保文本可读性
- **视觉层次**: 清晰的信息层级结构

### 3. 交互反馈
- **加载状态**: 提交过程中的视觉反馈
- **快捷键提示**: 按钮上显示快捷键信息
- **状态消息**: 操作结果的即时反馈

## 🔌 组件依赖

### 子组件
- **PhraseModeSelector**: 快捷语模式选择器
- **ImageUpload**: 图片上传组件

### 服务依赖
- **socketService**: Socket.IO通信服务
- **promptService**: 提示词管理服务
- **shortcutService**: 快捷键处理服务

### Store依赖
- **feedbackStore**: 反馈数据状态管理
- **connectionStore**: 连接状态管理
- **appStore**: 应用全局状态
- **scenesStore**: 场景管理状态

## 📊 性能优化

### 1. 防抖处理
- **输入防抖**: 避免频繁的状态更新
- **提交防护**: 防止重复提交

### 2. 异步处理
- **非阻塞操作**: 异步加载和提交
- **错误恢复**: 网络错误时的回退机制

### 3. 内存管理
- **事件清理**: 组件销毁时清理事件监听
- **引用释放**: 避免内存泄漏

## 🧪 使用示例

### 基本使用
```vue
<template>
  <FeedbackForm />
</template>

<script setup lang="ts">
import FeedbackForm from './components/FeedbackForm.vue'
</script>
```

### 与其他组件协作
```vue
<template>
  <div class="feedback-container">
    <WorkSummary />
    <FeedbackForm />
    <StatusMessage />
  </div>
</template>
```

## 🔍 调试信息

### 控制台输出
```typescript
// 提交反馈时的调试信息
console.log('提交反馈:', {
  text: processedText,
  images: feedbackStore.selectedImages.length,
  session: feedbackStore.currentFeedbackSession,
  connected: connectionStore.isConnected
})

// 演示模式的反馈信息
console.log('演示模式 - 反馈内容:', {
  text: processedText,
  images: feedbackStore.selectedImages.length,
  timestamp: new Date().toLocaleString()
})
```

## 🧭 相关文档

- **[快捷语模式选择器](./phrase-mode-selector.md)** - 模式选择组件详情
- **[图片上传组件](./image-upload.md)** - 图片处理功能
- **[反馈状态管理](../状态管理/index.md)** - 状态管理机制
- **[Socket通信服务](../服务/index.md)** - 通信服务详情

---

*反馈表单组件文档最后更新: 2024年1月* 