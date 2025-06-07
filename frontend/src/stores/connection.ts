import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useConnectionStore = defineStore('connection', () => {
  // 连接状态
  const isConnected = ref<boolean>(false)
  
  // 连接状态文本
  const connectionStatus = ref<string>('未连接')
  
  // Socket实例（这里用any类型，实际使用时会在socket服务中管理）
  const socket = ref<any>(null)
  
  // 设置连接状态
  const setConnectionStatus = (connected: boolean, statusText: string) => {
    isConnected.value = connected
    connectionStatus.value = statusText
  }
  
  // 设置Socket实例
  const setSocket = (socketInstance: any) => {
    socket.value = socketInstance
  }
  
  return {
    // 状态
    isConnected,
    connectionStatus,
    socket,
    
    // 方法
    setConnectionStatus,
    setSocket
  }
})
