# 图片上传组件 (ImageUpload.vue)

## 📋 组件概述

图片上传组件提供了完整的图片处理功能，支持多种上传方式、图片预览、压缩优化和批量管理。该组件是反馈系统中重要的附件处理模块。

- **文件路径**: `frontend/src/components/ImageUpload.vue`
- **代码行数**: 517行
- **组件类型**: 功能性组件
- **主要功能**: 图片上传、预览、压缩、管理

## 🎯 核心功能

### 1. 多种上传方式
- **点击上传**: 点击按钮选择文件
- **拖拽上传**: 拖拽图片到上传区域
- **粘贴上传**: Ctrl+V粘贴剪贴板图片
- **批量上传**: 支持一次选择多个图片文件

### 2. 图片处理
- **格式支持**: 支持JPEG、PNG、GIF、WebP等常见格式
- **尺寸限制**: 可配置最大文件大小和图片尺寸
- **自动压缩**: 大图片自动压缩以优化传输
- **质量控制**: 可调整压缩质量和目标尺寸

### 3. 预览功能
- **缩略图**: 上传后显示图片缩略图
- **全屏预览**: 点击缩略图查看原图
- **图片信息**: 显示文件名、大小、尺寸等信息
- **删除操作**: 支持单个或批量删除

### 4. 状态管理
- **上传进度**: 实时显示上传进度
- **错误处理**: 友好的错误提示和重试机制
- **状态同步**: 与全局状态store同步

## 🔧 技术实现

### Vue 3 Composition API
```typescript
// 主要状态管理
const selectedImages = ref<ImageFile[]>([])
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)

// 计算属性
const hasImages = computed(() => selectedImages.value.length > 0)
const canAddMore = computed(() => selectedImages.value.length < maxImages.value)
const totalSize = computed(() => {
  return selectedImages.value.reduce((sum, img) => sum + img.size, 0)
})
```

### 图片处理服务
```typescript
// 图片压缩处理
const compressImage = async (file: File, options: CompressOptions): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      // 计算压缩后的尺寸
      const { width, height } = calculateDimensions(img, options.maxWidth, options.maxHeight)
      
      canvas.width = width
      canvas.height = height
      
      // 绘制压缩后的图片
      ctx?.drawImage(img, 0, 0, width, height)
      
      canvas.toBlob((blob) => {
        if (blob) {
          const compressedFile = new File([blob], file.name, {
            type: file.type,
            lastModified: Date.now()
          })
          resolve(compressedFile)
        } else {
          reject(new Error('图片压缩失败'))
        }
      }, file.type, options.quality)
    }
    
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(file)
  })
}
```

### 拖拽处理
```typescript
// 拖拽事件处理
const handleDragOver = (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = true
}

const handleDrop = async (e: DragEvent) => {
  e.preventDefault()
  e.stopPropagation()
  isDragOver.value = false
  
  const files = Array.from(e.dataTransfer?.files || [])
  const imageFiles = files.filter(file => file.type.startsWith('image/'))
  
  if (imageFiles.length > 0) {
    await processFiles(imageFiles)
  }
}
```

## 🎨 UI组件设计

### 1. 上传区域
- **视觉反馈**: 拖拽时的高亮效果
- **状态指示**: 不同状态下的视觉样式
- **响应式**: 适配不同屏幕尺寸

### 2. 图片预览
- **网格布局**: 整齐的缩略图排列
- **悬停效果**: 鼠标悬停显示操作按钮
- **加载动画**: 上传过程中的进度指示

### 3. 操作按钮
- **添加按钮**: 支持继续添加图片
- **删除按钮**: 单个图片删除功能
- **清空按钮**: 批量清除所有图片

## 📊 性能优化

### 1. 图片压缩
```typescript
// 压缩配置
const compressionOptions = {
  maxWidth: 1920,      // 最大宽度
  maxHeight: 1080,     // 最大高度
  quality: 0.8,        // 压缩质量
  maxSize: 2 * 1024 * 1024  // 最大文件大小 2MB
}

// 智能压缩策略
const shouldCompress = (file: File): boolean => {
  return file.size > compressionOptions.maxSize ||
         file.type === 'image/png' && file.size > 1024 * 1024
}
```

### 2. 内存管理
- **URL清理**: 及时释放createObjectURL创建的URL
- **事件清理**: 组件销毁时清理事件监听器
- **异步取消**: 支持取消正在进行的上传操作

### 3. 懒加载
- **按需加载**: 只有在需要时才加载图片处理库
- **缓存机制**: 缓存处理过的图片数据
- **分批处理**: 大量图片分批处理避免阻塞

## 🔌 Store集成

### FeedbackStore集成
```typescript
// 与反馈状态同步
const feedbackStore = useFeedbackStore()

// 图片选择同步
watch(selectedImages, (newImages) => {
  feedbackStore.setSelectedImages(newImages)
}, { deep: true })

// 从store初始化
onMounted(() => {
  selectedImages.value = [...feedbackStore.selectedImages]
})
```

## 🛠️ 配置选项

### 上传限制
```typescript
interface UploadConfig {
  maxFiles: number          // 最大文件数量
  maxSize: number          // 单个文件最大大小
  totalMaxSize: number     // 总大小限制
  allowedTypes: string[]   // 允许的文件类型
  autoCompress: boolean    // 是否自动压缩
}

// 默认配置
const defaultConfig: UploadConfig = {
  maxFiles: 10,
  maxSize: 10 * 1024 * 1024,  // 10MB
  totalMaxSize: 50 * 1024 * 1024,  // 50MB
  allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  autoCompress: true
}
```

## 🔍 错误处理

### 常见错误类型
```typescript
enum UploadErrorType {
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_TYPE = 'INVALID_TYPE',
  TOO_MANY_FILES = 'TOO_MANY_FILES',
  COMPRESSION_FAILED = 'COMPRESSION_FAILED',
  UPLOAD_FAILED = 'UPLOAD_FAILED'
}

// 错误处理
const handleUploadError = (error: UploadError) => {
  switch (error.type) {
    case UploadErrorType.FILE_TOO_LARGE:
      showError(`文件 ${error.fileName} 超过大小限制`)
      break
    case UploadErrorType.INVALID_TYPE:
      showError(`不支持的文件类型: ${error.fileType}`)
      break
    // ... 其他错误处理
  }
}
```

## 🧪 使用示例

### 基本使用
```vue
<template>
  <ImageUpload />
</template>

<script setup lang="ts">
import ImageUpload from './components/ImageUpload.vue'
</script>
```

### 自定义配置
```vue
<template>
  <ImageUpload 
    :max-files="5"
    :max-size="5 * 1024 * 1024"
    :auto-compress="true"
    @upload-success="handleUploadSuccess"
    @upload-error="handleUploadError"
  />
</template>
```

## 🧭 相关文档

- **[反馈表单组件](./feedback-form.md)** - 主要使用场景
- **[图片处理服务](../服务/index.md)** - 后端图片处理
- **[反馈状态管理](../状态管理/index.md)** - 状态同步机制

---

*图片上传组件文档最后更新: 2024年1月* 