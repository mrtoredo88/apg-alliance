import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

function versionPlugin() {
  return {
    name: 'version-json',
    closeBundle() {
      let v;
      try {
        v = execSync('git rev-parse --short HEAD').toString().trim();
      } catch {
        v = Date.now().toString(36);
      }
      writeFileSync(
        resolve(__dirname, 'dist/version.json'),
        JSON.stringify({ v }),
      );
      console.log(`✓ version.json → { v: "${v}" }`);
    },
  };
}

export default defineConfig({
  plugins: [react(), versionPlugin()],
  build: {
    outDir: 'dist',
  },
})
