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
      '/__proxy/datalab': {
        target: 'https://www.datalab.to',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/datalab/, ''),
      },
      '/__proxy/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/anthropic/, ''),
      },
      '/__proxy/frankfurter': {
        target: 'https://api.frankfurter.app',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/frankfurter/, ''),
      },
      '/__proxy/erapi': {
        target: 'https://open.er-api.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/erapi/, ''),
      },
      '/__proxy/coingecko': {
        target: 'https://api.coingecko.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/__proxy\/coingecko/, ''),
      },
    },
  },
})
