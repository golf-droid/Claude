import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { CONFIG } from './lib/config.js'
import './styles.css'

// ธีมและชื่อแอปมาจาก environment variables ของ deployment นี้
document.documentElement.dataset.appTheme = CONFIG.theme
document.title = CONFIG.appName

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
