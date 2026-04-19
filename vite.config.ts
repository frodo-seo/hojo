import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev-only proxies for CORS-blocked providers. Production (APK) bypasses CORS via CapacitorHttp.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/__proxy/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/stooq/, ''),
      },
      '/__proxy/yahoo1': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/yahoo1/, ''),
      },
      '/__proxy/yahoo2': {
        target: 'https://query2.finance.yahoo.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/yahoo2/, ''),
      },
    },
  },
})
