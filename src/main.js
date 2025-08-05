import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { init } from '@getalby/bitcoin-connect'

// Initialize Bitcoin Connect for universal Lightning payments
init({
  appName: 'ZapTracker',
  showBalance: false,
  filters: undefined // Allow all wallet types
})

const app = createApp(App)

// Global error handler
app.config.errorHandler = (err, instance, info) => {
  console.error('Global error caught:', err)
  console.error('Error info:', info)
  console.error('Component:', instance)
  
  // You could send this to an error reporting service
  // or show a user-friendly error message
}

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
  event.preventDefault()
})

// Handle unhandled errors
window.addEventListener('error', (event) => {
  console.error('Unhandled error:', event.error)
})

app.mount('#app')
