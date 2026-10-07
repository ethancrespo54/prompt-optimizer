# Standardization and Optimization To-Do List

This document records pending optimization items related to code quality and engineering standards.

## Code Formatting Standardization

### Prettier 配置

**Priority**: P2 - Code quality improvement
**Estimated effort**: 1-2 hours
**Owner**: Unassigned
**Status**: Not started

#### Task Description

Introduce Prettier as the code formatting tool to unify the team's code style and reduce formatting disputes in Code Review.

#### Implementation Steps

1. **Install dependencies**
   ```bash
   pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier
   ```

2. **Create the configuration file** `.prettierrc.json`
   ```json
   {
     "semi": false,
     "singleQuote": true,
     "printWidth": 100,
     "tabWidth": 2,
     "trailingComma": "es5",
     "arrowParens": "always",
     "endOfLine": "auto",
     "vueIndentScriptAndStyle": false
   }
   ```

3. **Create the ignore file** `.prettierignore`
   ```
   dist/
   node_modules/
   *.min.js
   *.min.css
   pnpm-lock.yaml
   ```

4. **Update the ESLint configuration** `.eslintrc.json`
   ```json
   {
     "extends": [
       "eslint:recommended",
       "plugin:prettier/recommended"
     ]
   }
   ```

5. **Add npm scripts** `package.json`
   ```json
   {
     "scripts": {
       "format": "prettier --write .",
       "format:check": "prettier --check ."
     }
   }
   ```

6. **Configure VS Code auto-formatting** `.vscode/settings.json`
   ```json
   {
     "editor.defaultFormatter": "esbenp.prettier-vscode",
     "editor.formatOnSave": true,
     "[vue]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode"
     },
     "[typescript]": {
       "editor.defaultFormatter": "esbenp.prettier-vscode"
     }
   }
   ```

7. **(Optional) Integrate Git Hooks**
   ```bash
   pnpm add -D husky lint-staged
   pnpm exec husky init
   ```

#### Acceptance Criteria

- [ ] All configuration files are created
- [ ] `pnpm format` runs correctly
- [ ] VS Code format-on-save works
- [ ] All existing code is formatted (no linting errors)
- [ ] Team members have configured IDE auto-formatting

#### Notes

- The first introduction requires formatting all existing code; it is recommended to make a separate "Format all code with Prettier" commit
- Make sure to add the `format:check` check in CI/CD
- Notify team members to update their local IDE configuration

---

## Logging System Standardization

### Unified Logging Component

**Priority**: P2 - Developer experience improvement
**Estimated effort**: 4-6 hours
**Owner**: Unassigned
**Status**: Not started

#### Task Description

Create a unified logging utility to replace the scattered `console.log` calls in the project, providing structured logging, log level control, performance monitoring, and more.

#### Requirements Analysis

Current problems:
- The project uses bare `console.log` extensively, which cannot be controlled in production
- Logs cannot be filtered by module/feature domain
- No performance monitoring (function execution time, API call latency)
- Debugging is difficult (the source of a log cannot be located quickly)

#### Technical Options

##### Option A: Lightweight Wrapper (Recommended)

Create `packages/ui/src/utils/logger.ts`:

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  SILENT = 4,
}

interface LoggerConfig {
  level: LogLevel
  prefix?: string
  enableTimestamp?: boolean
  enableStackTrace?: boolean
}

class Logger {
  private config: LoggerConfig

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: import.meta.env.MODE === 'production' ? LogLevel.WARN : LogLevel.DEBUG,
      enableTimestamp: true,
      enableStackTrace: false,
      ...config,
    }
  }

  debug(message: string, ...args: unknown[]) { /* ... */ }
  info(message: string, ...args: unknown[]) { /* ... */ }
  warn(message: string, ...args: unknown[]) { /* ... */ }
  error(message: string, ...args: unknown[]) { /* ... */ }

  // Performance monitoring
  time(label: string) { /* ... */ }
  timeEnd(label: string) { /* ... */ }

  // Create a child logger
  child(prefix: string): Logger { /* ... */ }
}

// Usage example
const logger = new Logger({ prefix: '[SessionManager]' })
logger.info('Switching mode', { from: 'basic-system', to: 'pro-user' })
```

**Pros**:
- Zero dependencies, lightweight
- Full logs in development; only warnings and errors in production
- Supports creating child loggers per module

##### Option B: Use a Third-Party Library

Recommended libraries:
- **pino** - High performance, JSON format (suited for backend log aggregation)
- **consola** - Good-looking output, supports browsers and Node.js
- **debug** - A classic lightweight option with the highest npm downloads

**Not recommended**: winston (large size, mainly used for Node.js backends)

#### Implementation Steps

1. **Create the logger utility class**
   - Implement log level filtering
   - Support grouping by module (prefix)
   - Add timestamps and stack traces
   - Automatically adapt to development/production environments

2. **Create preset logger instances**
   ```typescript
   // packages/ui/src/utils/loggers.ts
   export const sessionLogger = logger.child('[SessionManager]')
   export const routerLogger = logger.child('[Router]')
   export const storageLogger = logger.child('[Storage]')
   ```

3. **Gradually migrate existing code**
   - Migrate key modules first (SessionManager, Router, Storage)
   - Use an ESLint rule to forbid direct use of `console.log`

4. **Add performance monitoring**
   ```typescript
   logger.time('session-restore')
   await restoreAllSessions()
   logger.timeEnd('session-restore')  // Output: session-restore: 145ms
   ```

5. **Configure the production environment**
   - Output only WARN and ERROR in production
   - Optional: integrate an error monitoring platform (Sentry)

#### Acceptance Criteria

- [ ] The logger utility class is implemented and tested
- [ ] Key modules are migrated to the new logger
- [ ] The ESLint rule is added (forbidding `console.log`)
- [ ] The production log level is correct
- [ ] Documentation is updated (developer guide)

#### Notes

- Log migration should proceed gradually to avoid large one-time changes
- Keep necessary `console.error` calls (such as critical errors in try-catch)
- Consider adding log sampling (to avoid excessive logs in performance-sensitive scenarios)

---

## Other Optimizations to Plan

### Improve Unit Test Coverage

**Priority**: P3
**Status**: To be planned

- Add unit tests for key composables
- Goal: core business logic test coverage > 80%

### JSDoc Comment Conventions

**Priority**: P3
**Status**: To be planned

- Add JSDoc comments to public APIs
- Integrate TypeDoc to generate API documentation automatically

### Component Library Documentation

**Priority**: P3
**Status**: To be planned

- Use Storybook or VitePress to build component documentation
- Provide interactive examples and best practices

---

## Changelog

| Date | Action | Description |
|------|------|------|
| 2025-01-08 | Document created | Initialized the standardization and optimization to-do list |
