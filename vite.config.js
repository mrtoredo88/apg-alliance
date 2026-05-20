import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build', // Собираем строго в папку build
  },
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.js$/,
    className: true,
  },
});