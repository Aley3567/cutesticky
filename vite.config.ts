import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    host: 'localhost',
    strictPort: true,
  },
  preview: {
    host: 'localhost',
    strictPort: true,
  },
})
