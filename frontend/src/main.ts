import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 创建Vue应用实例
const app = createApp(App)

// 创建Pinia实例
const pinia = createPinia()

// 使用Pinia
app.use(pinia)

// 挂载应用
app.mount('#app')
