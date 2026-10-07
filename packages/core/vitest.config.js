import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load environment variables
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) }
  
  return {
    test: {
      // Avoid Windows OOM with forked workers on large suites
      pool: 'threads',
      globals: true,
      environment: 'node',
      setupFiles: ['./tests/setup.js'],
      // Set the test timeout
      testTimeout: 30000, // Default 30 seconds
      hookTimeout: 30000, // Hook timeout 30 seconds
      // Environment variable configuration
      env: {
        ...process.env
      }
    }
  }
}) 
