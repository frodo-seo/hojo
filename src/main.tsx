import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { StatusBar, Style } from '@capacitor/status-bar'
import './index.css'
import App from './App.tsx'
import { bootReminder } from './lib/reminder'
import { isNative } from './lib/platform'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (isNative()) {
  StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  StatusBar.setBackgroundColor({ color: "#f5ecd7" }).catch(() => {})
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js");
  });
}

bootReminder();
