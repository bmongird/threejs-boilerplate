import { defineConfig } from 'vite'

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  server: {
    open: true,
  },
  optimizeDeps: {
    exclude: ['ammo.js']
  },
  build: {
    commonjsOptions: {
      exclude: ['ammo.js']
    }
  }
})
