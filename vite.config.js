import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0', // Slušaj na svim interfejsima
    port: 5173,
    hmr: {
      overlay: false
    }
  }
})
