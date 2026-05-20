import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Удаляем base: './', пусть Vite сам определяет пути при сборке
})