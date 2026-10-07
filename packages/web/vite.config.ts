import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // In a monorepo, scripts may be launched from different cwds; do not rely on process.cwd() to locate .env.
  // Here the monorepo root is derived from the config file location, and Vite is told to inject VITE_* into import.meta.env.
  const monorepoRoot = resolve(__dirname, '../..')
  const env = loadEnv(mode, monorepoRoot)
  
  return {
    envDir: monorepoRoot,
    plugins: [vue()],
    server: {
      port: 18181,
      host: true,
      fs: {
        // Allow serving workspace dependencies
        allow: ['..']
      },
      hmr: true,
      watch: {
        // Make sure changes in the other packages of the monorepo are watched
        ignored: ['!**/node_modules/@prompt-optimizer/**']
      }
    },
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html')
        }
      }
    },
    publicDir: 'public',
    resolve: {
      preserveSymlinks: true,
      alias: {
        '@': resolve(__dirname, 'src'),
        '@prompt-optimizer/core': path.resolve(__dirname, '../core'),
        '@prompt-optimizer/ui': path.resolve(__dirname, '../ui'),
        '@prompt-optimizer/web': path.resolve(__dirname, '../web'),
        '@prompt-optimizer/extension': path.resolve(__dirname, '../extension')
      }
    },
    optimizeDeps: {
      // Pre-bundled dependencies
      include: ['element-plus'],
    },
    define: {
      'process.env': {
        NODE_ENV: JSON.stringify(process.env.NODE_ENV || 'development'),
        ...Object.keys(env).reduce((acc, key) => {
          acc[key] = env[key];
          return acc;
        }, {})
      }
    }
  }
})
