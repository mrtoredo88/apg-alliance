import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'
import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

function versionPlugin() {
  return {
    name: 'version-json',
    closeBundle() {
      const normalize = (value) => {
        if (!value || typeof value !== 'string') return '';
        const trimmed = value.trim();
        if (!trimmed) return '';
        if (/^[0-9a-f]{4,}$/i.test(trimmed)) {
          return trimmed.slice(0, 8);
        }
        return trimmed;
      };
      const candidates = [
        process.env.VERCEL_GIT_COMMIT_SHA,
        process.env.APG_BUILD_VERSION,
        process.env.GITHUB_SHA,
      ];

      let v = candidates.map(normalize).find(Boolean);
      if (!v) {
        try {
          v = execSync('git rev-parse --short HEAD').toString().trim();
        } catch {
          v = Date.now().toString(36);
        }
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
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
    versionPlugin(),
  ],
  esbuild: {
    legalComments: 'none',
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react') || id.includes('/node_modules/react-dom') || id.includes('/node_modules/react-router-dom') || id.includes('/node_modules/scheduler')) {
            return 'vendor-react';
          }
          if (id.includes('/node_modules/firebase') || id.includes('/node_modules/@firebase')) {
            return 'vendor-firebase';
          }
        },
      },
    },
  },
})
