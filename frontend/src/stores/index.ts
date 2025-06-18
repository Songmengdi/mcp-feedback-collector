import { createPinia } from 'pinia'

// 创建pinia实例
export const pinia = createPinia()

// 导出所有store
export { useAppStore } from './app'
export { useConnectionStore } from './connection'
export { useFeedbackStore } from './feedback'
export { useScenesStore } from './scenes'

