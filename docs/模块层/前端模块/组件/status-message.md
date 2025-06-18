# 状态消息组件 (StatusMessage.vue)

## 📋 组件概述

状态消息组件负责显示系统的各种状态信息，包括成功、错误、警告和普通信息提示。该组件提供了统一的消息展示体验。

- **文件路径**: `frontend/src/components/StatusMessage.vue`
- **代码行数**: 240行
- **组件类型**: 通用UI组件
- **主要功能**: 状态消息展示、自动消失、动画效果

## 🎯 核心功能

### 1. 多种消息类型
- **成功消息**: 操作成功的绿色提示
- **错误消息**: 错误信息的红色警告
- **警告消息**: 注意事项的黄色提醒
- **信息消息**: 普通信息的蓝色通知

### 2. 显示控制
- **自动消失**: 可配置的自动消失时间
- **手动关闭**: 用户主动关闭消息
- **持久显示**: 重要消息的持久显示选项
- **队列管理**: 多条消息的队列显示

### 3. 动画效果
- **淡入淡出**: 平滑的淡入淡出动画
- **滑动效果**: 从顶部滑入的动画
- **弹跳效果**: 吸引注意的弹跳动画
- **进度条**: 自动消失的进度指示

## 🔧 技术实现

### Vue 3 Composition API
```typescript
// 消息状态管理
const messages = ref<StatusMessage[]>([])
const nextId = ref(1)

// 消息类型定义
interface StatusMessage {
  id: number
  type: 'success' | 'error' | 'warning' | 'info'
  title?: string
  content: string
  duration?: number
  persistent?: boolean
  timestamp: number
}

// 显示消息
const showMessage = (options: Omit<StatusMessage, 'id' | 'timestamp'>) => {
  const message: StatusMessage = {
    id: nextId.value++,
    timestamp: Date.now(),
    duration: 3000,
    persistent: false,
    ...options
  }
  
  messages.value.push(message)
  
  // 自动移除非持久消息
  if (!message.persistent && message.duration) {
    setTimeout(() => {
      removeMessage(message.id)
    }, message.duration)
  }
}
```

### 消息管理
```typescript
// 移除消息
const removeMessage = (id: number) => {
  const index = messages.value.findIndex(msg => msg.id === id)
  if (index > -1) {
    messages.value.splice(index, 1)
  }
}

// 清空所有消息
const clearAllMessages = () => {
  messages.value = []
}

// 消息类型快捷方法
const showSuccess = (content: string, options?: Partial<StatusMessage>) => {
  showMessage({ type: 'success', content, ...options })
}

const showError = (content: string, options?: Partial<StatusMessage>) => {
  showMessage({ type: 'error', content, persistent: true, ...options })
}

const showWarning = (content: string, options?: Partial<StatusMessage>) => {
  showMessage({ type: 'warning', content, ...options })
}

const showInfo = (content: string, options?: Partial<StatusMessage>) => {
  showMessage({ type: 'info', content, ...options })
}
```

### 动画实现
```typescript
// 进入动画
const enterAnimation = (el: Element) => {
  el.style.opacity = '0'
  el.style.transform = 'translateY(-20px)'
  
  requestAnimationFrame(() => {
    el.style.transition = 'all 0.3s ease-out'
    el.style.opacity = '1'
    el.style.transform = 'translateY(0)'
  })
}

// 离开动画
const leaveAnimation = (el: Element, done: () => void) => {
  el.style.transition = 'all 0.3s ease-in'
  el.style.opacity = '0'
  el.style.transform = 'translateX(100%)'
  
  setTimeout(done, 300)
}
```

## 🎨 UI设计特点

### 1. 视觉设计
- **颜色系统**: 语义化的颜色区分不同消息类型
- **图标系统**: 每种类型配备相应的图标
- **阴影效果**: 轻微阴影提升视觉层次
- **圆角设计**: 现代化的圆角边框

### 2. 布局设计
- **固定定位**: 固定在页面顶部或右上角
- **层级管理**: 高z-index确保消息显示在最前
- **响应式**: 在不同屏幕尺寸下的适配
- **堆叠显示**: 多条消息的垂直堆叠

### 3. 交互设计
- **悬停暂停**: 鼠标悬停时暂停自动消失
- **点击关闭**: 点击消息或关闭按钮关闭
- **键盘支持**: ESC键关闭所有消息
- **触摸支持**: 移动端的滑动关闭

## 📊 性能优化

### 1. 消息队列管理
```typescript
// 限制同时显示的消息数量
const MAX_MESSAGES = 5

const addMessage = (message: StatusMessage) => {
  messages.value.push(message)
  
  // 如果超过最大数量，移除最旧的消息
  if (messages.value.length > MAX_MESSAGES) {
    messages.value.splice(0, messages.value.length - MAX_MESSAGES)
  }
}

// 消息去重
const isDuplicateMessage = (newMessage: StatusMessage): boolean => {
  return messages.value.some(msg => 
    msg.type === newMessage.type && 
    msg.content === newMessage.content &&
    Date.now() - msg.timestamp < 1000 // 1秒内的重复消息
  )
}
```

### 2. 内存管理
```typescript
// 定期清理过期消息
const cleanupExpiredMessages = () => {
  const now = Date.now()
  messages.value = messages.value.filter(msg => {
    if (msg.persistent) return true
    return now - msg.timestamp < (msg.duration || 3000) + 1000
  })
}

// 组件销毁时清理
onUnmounted(() => {
  clearAllMessages()
})
```

## 🔌 全局集成

### 提供全局方法
```typescript
// 在main.ts中注册全局方法
app.config.globalProperties.$message = {
  success: showSuccess,
  error: showError,
  warning: showWarning,
  info: showInfo
}

// 在组件中使用
const { proxy } = getCurrentInstance()
proxy?.$message.success('操作成功！')
```

### Composable封装
```typescript
// useMessage composable
export function useMessage() {
  return {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    clearAllMessages
  }
}

// 在组件中使用
const message = useMessage()
message.showSuccess('保存成功！')
```

## 🛠️ 配置选项

### 全局配置
```typescript
interface MessageConfig {
  duration: number         // 默认显示时长
  maxCount: number        // 最大消息数量
  position: 'top' | 'bottom' | 'top-right' | 'bottom-right'
  showIcon: boolean       // 是否显示图标
  showClose: boolean      // 是否显示关闭按钮
  enableAnimation: boolean // 是否启用动画
}

// 默认配置
const defaultConfig: MessageConfig = {
  duration: 3000,
  maxCount: 5,
  position: 'top-right',
  showIcon: true,
  showClose: true,
  enableAnimation: true
}
```

### 消息样式配置
```typescript
// 消息类型样式
const messageStyles = {
  success: {
    backgroundColor: '#f0f9ff',
    borderColor: '#10b981',
    color: '#065f46',
    icon: '✅'
  },
  error: {
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    color: '#991b1b',
    icon: '❌'
  },
  warning: {
    backgroundColor: '#fffbeb',
    borderColor: '#f59e0b',
    color: '#92400e',
    icon: '⚠️'
  },
  info: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    color: '#1e40af',
    icon: 'ℹ️'
  }
}
```

## 🧪 使用示例

### 基本使用
```vue
<template>
  <div>
    <StatusMessage />
    <button @click="showSuccessMessage">显示成功消息</button>
    <button @click="showErrorMessage">显示错误消息</button>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from '@/composables/useMessage'

const message = useMessage()

const showSuccessMessage = () => {
  message.showSuccess('操作成功完成！')
}

const showErrorMessage = () => {
  message.showError('操作失败，请重试')
}
</script>
```

### 高级用法
```vue
<template>
  <StatusMessage :config="messageConfig" />
</template>

<script setup lang="ts">
const messageConfig = {
  duration: 5000,
  position: 'bottom-right',
  maxCount: 3
}

// 显示带标题的消息
message.showSuccess('操作完成', {
  title: '成功',
  duration: 5000,
  persistent: false
})

// 显示持久消息
message.showError('严重错误', {
  title: '错误',
  persistent: true
})
</script>
```

## 🔄 与其他组件协作

### 表单验证消息
```typescript
// 表单提交时显示状态
const submitForm = async () => {
  try {
    await api.submitForm(formData)
    message.showSuccess('表单提交成功！')
  } catch (error) {
    message.showError(`提交失败: ${error.message}`)
  }
}
```

### 网络请求状态
```typescript
// API请求状态提示
const fetchData = async () => {
  message.showInfo('正在加载数据...')
  
  try {
    const data = await api.getData()
    message.showSuccess('数据加载完成')
    return data
  } catch (error) {
    message.showError('数据加载失败')
    throw error
  }
}
```

## 🧭 相关文档

- **[反馈表单组件](./feedback-form.md)** - 表单状态提示
- **[工作汇报组件](./work-summary.md)** - 内容状态显示
- **[应用状态管理](../状态管理/index.md)** - 全局状态管理

---

*状态消息组件文档最后更新: 2024年1月* 