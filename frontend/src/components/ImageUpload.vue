<template>
  <div class="image-upload-container">
    <!-- 上传工具栏 -->
    <div class="toolbar">
      <div class="toolbar-buttons">
        <button type="button" class="toolbar-btn" @click="selectImages">
          📁 选择图片
        </button>
        <button type="button" class="toolbar-btn" @click="pasteImages">
          📋 粘贴图片
        </button>
      </div>
      <!-- 粘贴提示 -->
      <div class="paste-hint">
        💡 提示：您也可以直接在上方的反馈输入框中粘贴图片（{{ pasteShortcut }}）
      </div>
    </div>

    <!-- 图片预览区域 -->
    <div class="image-preview-area">
      <div class="image-previews">
        <div 
          v-for="(image, index) in selectedImages" 
          :key="image.id || index"
          class="image-preview"
        >
          <img 
            :src="image.data" 
            :alt="image.name" 
            class="preview-img" 
            @click="showImagePreview(index)"
          >
          <button 
            type="button" 
            class="remove-btn" 
            @click="removeImage(index)"
          >
            ×
          </button>
        </div>
      </div>
    </div>

    <!-- 图片预览模态框 -->
    <div v-if="showPreviewModal" class="image-preview-modal" @click="closeImagePreview">
      <div class="image-preview-content">
        <img 
          :src="previewImage?.data" 
          :alt="previewImage?.name" 
          class="preview-image-large"
        >
        <button type="button" class="image-preview-close" @click="closeImagePreview">×</button>
        <div class="image-preview-info">
          <div>{{ previewImage?.name }}</div>
          <div>{{ formatFileSize(previewImage?.size || 0) }}</div>
        </div>
      </div>
    </div>

    <!-- 隐藏的文件输入 -->
    <input 
      ref="fileInput"
      type="file" 
      accept="image/*" 
      multiple 
      style="display: none"
      @change="handleFileSelect"
    >
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFeedbackStore } from '../stores/feedback'
import type { ImageFile } from '../types/app'

// Store引用
const feedbackStore = useFeedbackStore()

// 本地状态
const fileInput = ref<HTMLInputElement>()
const showPreviewModal = ref(false)
const previewIndex = ref(0)

// 图片压缩配置
const IMAGE_COMPRESSION_CONFIG = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  supportedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
}

// 计算属性
const selectedImages = computed(() => feedbackStore.selectedImages)

const previewImage = computed(() => {
  return selectedImages.value[previewIndex.value]
})

const pasteShortcut = computed(() => {
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
  return isMac ? '⌘+V' : 'Ctrl+V'
})

// 方法
const selectImages = () => {
  fileInput.value?.click()
}

const handleFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  const files = Array.from(target.files || [])
  
  files.forEach(file => {
    try {
      validateImageFile(file)
      addImage(file)
    } catch (error) {
      showStatusMessage('error', `${file.name}: ${(error as Error).message}`)
    }
  })

  // 清空input值，允许重复选择同一文件
  if (target) {
    target.value = ''
  }
}

const pasteImages = async () => {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type)
          const file = new File([blob], `pasted-image-${Date.now()}.png`, { type: blob.type })
          addImage(file)
        }
      }
    }
  } catch (err) {
    console.log('粘贴失败:', err)
    showStatusMessage('error', '粘贴图片失败，请尝试选择文件方式')
  }
}

const addImage = (file: File) => {
  // 显示处理状态
  showStatusMessage('info', `正在处理图片: ${file.name}...`)
  
  const reader = new FileReader()
  reader.onload = async (e) => {
    try {
      // 压缩图片
      const compressedData = await compressImageOnClient(e.target?.result as string, file.type)
      
      const imageData: ImageFile = {
        name: file.name,
        data: compressedData.data,
        size: compressedData.size,
        type: file.type,
        originalSize: file.size,
        id: Date.now() + Math.random().toString()
      }

      feedbackStore.addImage(imageData)
      
      // 显示压缩结果
      const compressionRatio = ((file.size - compressedData.size) / file.size * 100).toFixed(1)
      showStatusMessage('success', `图片已添加 (压缩率: ${compressionRatio}%)`)
    } catch (error) {
      console.error('图片处理失败:', error)
      showStatusMessage('error', `图片处理失败: ${(error as Error).message}`)
    }
  }
  reader.readAsDataURL(file)
}

const removeImage = (index: number) => {
  feedbackStore.removeImage(index)
}

const showImagePreview = (index: number) => {
  previewIndex.value = index
  showPreviewModal.value = true
}

const closeImagePreview = () => {
  showPreviewModal.value = false
}

// 验证图片文件
const validateImageFile = (file: File) => {
  // 检查文件大小
  if (file.size > IMAGE_COMPRESSION_CONFIG.maxFileSize) {
    throw new Error(`文件过大，最大支持 ${formatFileSize(IMAGE_COMPRESSION_CONFIG.maxFileSize)}`)
  }

  // 检查文件类型
  if (!IMAGE_COMPRESSION_CONFIG.supportedFormats.includes(file.type.toLowerCase())) {
    throw new Error(`不支持的文件格式: ${file.type}`)
  }
}

// 前端图片压缩函数
const compressImageOnClient = async (base64Data: string, fileType: string) => {
  return new Promise<{ data: string; size: number; width: number; height: number; format: string }>((resolve, reject) => {
    try {
      // 验证图片格式
      if (!IMAGE_COMPRESSION_CONFIG.supportedFormats.includes(fileType.toLowerCase())) {
        throw new Error(`不支持的图片格式: ${fileType}`)
      }

      const img = new Image()
      img.onload = function() {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          if (!ctx) {
            throw new Error('无法创建Canvas上下文')
          }

          // 计算新尺寸
          const { width, height } = calculateNewDimensions(
            img.width, 
            img.height, 
            IMAGE_COMPRESSION_CONFIG.maxWidth, 
            IMAGE_COMPRESSION_CONFIG.maxHeight
          )

          canvas.width = width
          canvas.height = height

          // 绘制图片
          ctx.drawImage(img, 0, 0, width, height)

          // 转换为压缩后的格式
          const outputFormat = fileType === 'image/png' ? 'image/png' : 'image/jpeg'
          const compressedBase64 = canvas.toDataURL(outputFormat, IMAGE_COMPRESSION_CONFIG.quality)

          // 计算压缩后大小
          const compressedSize = Math.round((compressedBase64.length - 'data:image/jpeg;base64,'.length) * 3 / 4)

          resolve({
            data: compressedBase64,
            size: compressedSize,
            width: width,
            height: height,
            format: outputFormat
          })
        } catch (error) {
          reject(new Error(`图片压缩失败: ${(error as Error).message}`))
        }
      }

      img.onerror = function() {
        reject(new Error('图片加载失败'))
      }

      img.src = base64Data
    } catch (error) {
      reject(error)
    }
  })
}

// 计算新尺寸（保持宽高比）
const calculateNewDimensions = (originalWidth: number, originalHeight: number, maxWidth: number, maxHeight: number) => {
  if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
    return { width: originalWidth, height: originalHeight }
  }

  const widthRatio = maxWidth / originalWidth
  const heightRatio = maxHeight / originalHeight
  const ratio = Math.min(widthRatio, heightRatio)

  return {
    width: Math.round(originalWidth * ratio),
    height: Math.round(originalHeight * ratio)
  }
}

// 格式化文件大小
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 显示状态消息（临时实现）
const showStatusMessage = (type: string, message: string) => {
  console.log(`[${type.toUpperCase()}] ${message}`)
  // TODO: 集成StatusMessage组件
}
</script>

<style scoped>
.image-upload-container {
  margin-top: 4px; /* 减少上边距 */
  flex-shrink: 0; /* 防止被压缩 */
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px; /* 减少下边距 */
  gap: 10px; /* 减少间距 */
}

.toolbar-buttons {
  display: flex;
  gap: 8px;
}

.toolbar-btn {
  padding: 4px 8px; /* 减少内边距 */
  border: 1px solid #3e3e42;
  border-radius: 3px;
  background: #2d2d30;
  color: #cccccc;
  cursor: pointer;
  font-size: 11px; /* 减小字体 */
  display: flex;
  align-items: center;
  gap: 3px; /* 减少间距 */
  transition: all 0.2s ease;
}

.toolbar-btn:hover {
  background: #3c3c3c;
  border-color: #007acc;
}

.paste-hint {
  font-size: 10px; /* 减小字体 */
  color: #969696;
  margin: 0;
  padding: 2px 6px; /* 减少内边距 */
  background: rgba(150, 150, 150, 0.08);
  border-radius: 2px;
  border-left: 2px solid #007acc;
  line-height: 1.2; /* 减少行高 */
  white-space: nowrap;
  flex-shrink: 0;
}

.image-preview-area {
  height: 96px; /* 固定高度：80px(图片) + 16px(padding) */
  border: 2px dashed #3e3e42;
  border-radius: 4px;
  padding: 8px;
  background: #1e1e1e;
  overflow: hidden; /* 防止内容溢出 */
}

.image-previews {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  height: 100%; /* 占满预览区域高度 */
  align-items: flex-start; /* 顶部对齐 */
}

.image-preview {
  position: relative;
  width: 80px;
  height: 80px; /* 固定高度，确保与预览区域匹配 */
  background: #252526;
  border: 1px solid #3e3e42;
  border-radius: 3px;
  overflow: hidden;
  flex-shrink: 0; /* 防止被压缩 */
}

.preview-img {
  width: 100%;
  height: 100%; /* 占满容器高度 */
  object-fit: cover;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.preview-img:hover {
  opacity: 0.8;
}

.remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: rgba(255, 0, 0, 0.8);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.remove-btn:hover {
  background: rgba(255, 0, 0, 1);
}

.image-info {
  padding: 6px 6px;
  font-size: 11px;
  color: #cccccc;
  min-height: 24px;
}

.image-name {
  font-weight: 500;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: none; /* 隐藏文件名显示 */
}

.compression-info {
  color: #969696;
  font-size: 10px;
  line-height: 1.3;
}

/* 图片预览模态框样式 */
.image-preview-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.image-preview-content {
  position: relative;
  max-width: 90%;
  max-height: 90%;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.preview-image-large {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
  border-radius: 4px;
}

.image-preview-close {
  position: absolute;
  top: -40px;
  right: 0;
  background: rgba(255, 255, 255, 0.2);
  color: white;
  border: none;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s ease;
}

.image-preview-close:hover {
  background: rgba(255, 255, 255, 0.3);
}

.image-preview-info {
  margin-top: 16px;
  text-align: center;
  color: white;
  font-size: 14px;
  background: rgba(0, 0, 0, 0.7);
  padding: 8px 16px;
  border-radius: 4px;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .toolbar {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }
  
  .toolbar-buttons {
    justify-content: center;
  }
  
  .paste-hint {
    text-align: center;
    white-space: normal;
    font-size: 10px;
  }
}
</style>
