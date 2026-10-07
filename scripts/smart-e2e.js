#!/usr/bin/env node
/**
 * Smart E2E test runner
 *
 * Uses the VCR auto mode: each test checks its own fixture independently
 * - fixture exists → replay (fast)
 * - fixture does not exist → record (created automatically)
 *
 * Usage:
 * node scripts/smart-e2e.js
 */

const { execSync } = require('child_process')

/**
 * Main function
 */
function main() {
  console.log('\n🎬 Running E2E tests in VCR auto mode')
  console.log('   - Tests with a fixture: replay')
  console.log('   - Tests without a fixture: record\n')

  try {
    // Do not set E2E_VCR_MODE; use the default auto mode
    execSync('playwright test', {
      stdio: 'inherit',
      env: process.env // Inherit the existing environment variables without overriding E2E_VCR_MODE
    })
  } catch (error) {
    process.exit(error.status || 1)
  }
}

main()
