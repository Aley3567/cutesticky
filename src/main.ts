import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { registerPwa } from './platform/pwa'
import { isWebRuntime } from './platform'

document.documentElement.dataset.runtime = isWebRuntime ? 'web' : 'desktop'

createApp(App).mount('#app')
registerPwa()
