import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/proyecto-ventas-front/',
  build: {
    modulePreload: false, // <--- ESTA LÍNEA ES LA QUE ARREGLA TODO
    rollupOptions: {
      output: {
        manualChunks: undefined,
      }
    }
  }
})