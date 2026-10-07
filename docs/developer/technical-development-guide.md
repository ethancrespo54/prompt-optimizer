# Technical Development Guide

> **Note:** This document consolidates the original development guide and technical documentation, providing a complete tech stack description and development conventions.

## 1. Project Technical Architecture

### 1.1 Overall Architecture
- Monorepo structure
  - packages/core - Core functionality package
  - packages/web - Web application
  - packages/extension - Chrome extension
  - packages/ui - Shared UI components
- Inter-package dependency management
  - Clear dependency relationships
  - Version consistency
  - Minimized duplicate code
- Engineering tools
  - pnpm workspace
  - Multi-package management
  - Unified version control

### 1.2 Tech Stack Overview

#### 1.2.1 Core Package (@prompt-optimizer/core)
- TypeScript 5.3.x
  - Type system
  - Interface definitions
  - Modularization
- Native SDK integration
  - OpenAI SDK ^4.83.0
  - Google Generative AI SDK ^0.21.0
  - Model management
  - Prompt handling
  - Streaming responses
- Utility libraries
  - uuid ^11.0.5
  - zod ^3.22.4
  - Error handling
  - Type definitions

#### 1.2.2 Web Package (@prompt-optimizer/web)
- Vue 3.5.x
  - Composition API
  - Script Setup
  - Reactivity system
  - Component ecosystem
- Vite 6.0.x
  - Fast development server
  - Optimized builds
  - Plugin system
  - HMR support

#### 1.2.3 UI Framework and Styling
- TailwindCSS 3.4.x
  - Utility-first
  - Responsive design
  - Dark mode support
  - Animation system
- Vue Transitions
  - Page transition animations
  - Component switching effects
  - List animations
- Naive UI 2.42.x
  - Enterprise-grade component library
  - Full TypeScript support  
  - Theme customization system
  - Responsive component design

#### 1.2.4 State Management
- Vue Reactivity
  - ref/reactive
  - computed
  - watch
  - watchEffect
- Composables pattern
  - Reuse of state logic
  - Reactive composition
  - Lifecycle management
  - Side-effect handling
- LocalStorage
  - Configuration persistence
  - History storage
  - Template management
  - Encrypted storage

#### 1.2.5 Security
- WebCrypto API
  - API key encryption
  - Secure storage
  - Key rotation
- XSS protection
  - Input validation
  - Content filtering
  - Secure coding
- CORS configuration
  - API access control
  - Security headers
  - CSP policy

#### 1.2.6 Development Tools
- TypeScript 5.3.x
  - Type checking
  - Code hints
  - Interface definitions
- ESLint 8.56.x
  - Code conventions
  - Auto-fix
  - TypeScript support
- Prettier 3.2.x
  - Code formatting
  - Consistent style
  - Editor integration

#### 1.2.7 Testing Frameworks
- Vitest 3.0.x
  - Unit tests
  - Integration tests
  - Snapshot tests
  - Coverage reports
- Vue Test Utils 2.4.x
  - Component tests
  - Behavior simulation
  - Event tests
- Playwright 1.41.x
  - E2E tests
  - Cross-browser tests
  - Visual regression tests

### 1.3 Code Organization
- Modular design
  - Divide modules by feature
  - Single responsibility principle
  - Separation of concerns
- Unified directory structure
  - src/ - Source code
  - tests/ - Test code
  - types/ - Type definitions
  - config/ - Configuration files

## 2. Core Package Development Conventions

### 2.1 Service Implementation Conventions
- Interface consistency
  - All services must implement a unified interface
  - Keep method naming consistent
  - Error handling follows a unified pattern
  - Consistent return value types

- Error handling
  - Use unified error types
  - Error messages should include context
  - Implement error recovery mechanisms
  - Provide user-friendly error messages

### 2.2 SDK Integration Conventions
- Native SDK integration
  - Use the official SDK directly
  - Avoid unnecessary abstraction layers
  - Keep versions up to date
  - Follow official best practices

- Error mapping
  - Map SDK-specific errors to unified error types
  - Preserve the original error information
  - Implement a retry mechanism
  - Provide a fallback plan

### 2.3 Type Definition Conventions
- Type safety
  - Use precise type definitions
  - Avoid the any type
  - Use union types to represent possible values
  - Define interfaces for complex objects

- Type exports
  - Export types centrally in index.ts
  - Organize type definitions by module
  - Use namespaces to avoid conflicts
  - Provide type documentation comments

### 2.4 Testing Conventions
- Unit tests
  - Test coverage target >80%
  - Test boundary conditions
  - Mock external dependencies
  - Verify error handling

- Integration tests
  - Test interactions between services
  - Verify end-to-end flows
  - Test performance and concurrency
  - Simulate a real environment

## 3. Frontend Development Conventions

### 3.1 Project Architecture
- Recommended directory structure
  ```
  src/
  ├── components/    # UI components
  ├── composables/   # Composable functions
  ├── views/         # Page components
  ├── services/      # Service layer
  ├── config/        # Configuration files
  ├── assets/        # Static assets
  ├── utils/         # Utility functions
  ├── types/         # Type definitions
  ├── App.vue        # Root component
  └── main.ts        # Entry file
  ```

- Naming conventions
  - Component files: PascalCase.vue
  - Utility function files: camelCase.ts
  - Type definition files: camelCase.types.ts
  - Composables: useXxx.ts

### 3.2 Service Usage Conventions
- Core service integration
  - Use a unified service access pattern
  - Implement the service singleton pattern
  - Handle service initialization
  - Manage service state

- Error handling
  - Use a unified error handling mechanism
  - Provide user-friendly error messages
  - Implement error recovery
  - Log errors

### 3.3 Component Development Conventions
- Vue component template
  - Use the <script setup> syntax
  - Define props and emits explicitly
  - Use TypeScript types
  - Follow the single responsibility principle

- Component design principles
  - Components should be reusable
  - Components should be testable
  - Components should be maintainable
  - Components should be extensible

### 3.4 Type System
- Vue component types
  - Define explicit types for props
  - Define event types for emits
  - Define types for ref and reactive
  - Use generics to enhance type safety

- Common utility types
  - Create reusable utility types
  - Use TypeScript's built-in utility types
  - Define types for complex data structures
  - Avoid type assertions

### 3.5 State Management
- Composables pattern
  - Organize composables by feature module
  - Use the composition API style
  - Implement state sharing and reuse
  - Handle async operations and side effects

- Reactive state management
  - Use ref/reactive to manage local state
  - Use provide/inject for dependency injection
  - Reuse state logic through composables
  - Manage component lifecycle and cleanup

### 3.6 TypeScript and ESLint Configuration Guidance

#### 3.6.1 TypeScript Configuration Best Practices

**Project-level tsconfig.json configuration**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "moduleResolution": "node",
    "strict": true,
    "jsx": "preserve",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmit": true,
    "useDefineForClassFields": true
  },
  "include": ["src/**/*", "*.vue"],
  "exclude": ["node_modules", "dist"]
}
```

**Vue component type definitions**
```typescript
// Component Props type definition
interface ComponentProps {
  title: string
  items: Array<{ id: string, name: string }>
  onSelect?: (item: any) => void
}

// Component Emits type definition  
const emit = defineEmits<{
  select: [item: any]
  update: [value: string]
}>()

// Reactive data types
const formData = ref<{
  username: string
  modelConfig: ModelConfig | null
}>({
  username: '',
  modelConfig: null
})
```

**Type-safe service interfaces**
```typescript
// Service dependency injection types
interface Services {
  modelManager: IModelManager
  templateManager: ITemplateManager
  variableManager: IVariableManager
}

const services = inject<{ value: Services | null }>('services')
if (!services?.value) {
  throw new Error('Services not provided')
}
```

#### 3.6.2 ESLint Configuration Guidance

**Basic ESLint configuration**
```json
{
  "root": true,
  "parser": "vue-eslint-parser",
  "parserOptions": {
    "parser": "@typescript-eslint/parser",
    "ecmaVersion": 2022,
    "sourceType": "module",
    "extraFileExtensions": [".vue"]
  },
  "plugins": ["@typescript-eslint", "vue"],
  "extends": [
    "eslint:recommended",
    "@vue/eslint-config-typescript/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "vue/multi-word-component-names": "off",
    "vue/no-unused-vars": "error"
  }
}
```

**Vue file-specific rules**
```json
{
  "rules": {
    "vue/component-name-in-template-casing": ["error", "PascalCase"],
    "vue/prop-name-casing": ["error", "camelCase"],
    "vue/attribute-hyphenation": ["error", "always"],
    "vue/v-on-event-hyphenation": ["error", "always"],
    "vue/no-unused-components": "warn",
    "vue/require-default-prop": "off"
  }
}
```

#### 3.6.3 Development Environment Integration

**VS Code configuration (.vscode/settings.json)**
```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "eslint.validate": [
    "javascript",
    "typescript",
    "vue"
  ],
  "vetur.validation.template": false,
  "vetur.validation.script": false,
  "vetur.validation.style": false
}
```

### 3.7 Performance Optimization
- Dynamic imports
  - Use route lazy loading
  - Load components on demand
  - Import third-party libraries on demand
  - Code splitting

- Rendering optimization
  - Use virtual lists
  - Avoid unnecessary rendering
  - Use computed property caching
  - Optimize large lists

### 3.8 Naive UI Usage Guide

#### 3.8.1 Component Library Features
- **Enterprise-grade design**
  - Professional visual design language
  - Consistent interaction experience
  - Complete component ecosystem

- **TypeScript support**
  - Complete type definitions
  - Intelligent code hints
  - Type-safe property passing

- **Theme system**
  - Multiple built-in themes (light, dark, blue, green, purple)
  - Supports theme customization and dynamic switching
  - CSS variable support

#### 3.8.2 Configuration Guide

1. **Basic configuration**
   ```vue
   <template>
     <NConfigProvider :theme="naiveTheme" :theme-overrides="themeOverrides">
       <!-- Application content -->
     </NConfigProvider>
   </template>
   
   <script setup>
   import { useNaiveTheme } from '@prompt-optimizer/ui'
   
   const { naiveTheme, themeOverrides } = useNaiveTheme()
   </script>
   ```

2. **Theme configuration**
   ```typescript
   // config/naive-theme.ts
   export const themeConfig = {
     light: lightTheme,
     dark: darkTheme,
     blue: createCustomTheme(blueColors),
     green: createCustomTheme(greenColors),
     purple: createCustomTheme(purpleColors)
   }
   ```

3. **Component usage**
   ```vue
   <template>
     <NButton type="primary" @click="handleClick">
       Button
     </NButton>
     <NCard title="Card Title">
       <p>Card content</p>
     </NCard>
   </template>
   
   <script setup>
   import { NButton, NCard } from 'naive-ui'
   </script>
   ```

#### 3.8.3 Theme Configuration Details

The system provides 5 complete theme configurations, each including a complete color system and component style customization:

**1. Light Mode (light)**
- Base theme: lightTheme
- Primary color: #0ea5e9 (sky blue)
- Use case: Default daytime use, clean and simple

**2. Dark Mode (dark)**
- Base theme: darkTheme  
- Primary color: #64748b (slate gray)
- Use case: Low-light environments, eye-friendly mode

**3. Blue Mode (blue)**
- Base theme: lightTheme + custom background
- Primary color: #0ea5e9 (sky blue)
- Feature: Blue-toned background palette (#f0f9ff body, #e0f2fe card)
- Use case: Professional business style

**4. Green Mode (green)**
- Base theme: darkTheme + complete green color scheme
- Primary color: #14b8a6 (teal green)
- Feature: Dark base with a green theme (#0f1e1a body, #1a2e25 card)
- Complete configuration: Includes scrollbars, icons, borders, and all other UI elements

**5. Purple Mode (purple)**
- Base theme: darkTheme + purple color scheme
- Primary color: #a855f7 (purple)
- Feature: Dark base with a purple theme (#1a0f2e body, #251a35 card)
- Use case: Creative design, personalized interface

#### 3.8.4 Common Component Usage Patterns

**1. Form components**
```vue
<template>
  <NForm ref="formRef" :model="formModel" :rules="formRules">
    <NFormItem label="Username" path="username">
      <NInput v-model:value="formModel.username" placeholder="Please enter a username" />
    </NFormItem>
    <NFormItem label="Model Selection" path="model">
      <NSelect 
        v-model:value="formModel.model" 
        :options="modelOptions"
        placeholder="Please select a model"
      />
    </NFormItem>
    <NFormItem>
      <NButton type="primary" @click="handleSubmit">
        Submit
      </NButton>
    </NFormItem>
  </NForm>
</template>
```

**2. Layout components**
```vue
<template>
  <!-- Flex layout - recommended for modern layouts -->
  <NFlex vertical :size="16">
    <NFlex justify="space-between" align="center">
      <NH3>Title</NH3>
      <NButton type="primary">Action</NButton>
    </NFlex>
    
    <!-- Card container -->
    <NCard title="Content Card" hoverable>
      <NFlex :size="12">
        <NTag type="info">Tag 1</NTag>
        <NTag type="success">Tag 2</NTag>
      </NFlex>
    </NCard>
  </NFlex>

  <!-- Traditional spacing layout -->
  <NSpace vertical :size="16">
    <NSpace justify="space-between" align="center">
      <NText strong>List Title</NText>
      <NButton quaternary>More</NButton>
    </NSpace>
  </NSpace>

  <!-- Grid layout -->
  <NGrid :cols="3" :x-gap="16" :y-gap="16">
    <NGridItem v-for="item in items" :key="item.id">
      <NCard>{{ item.content }}</NCard>
    </NGridItem>
  </NGrid>
</template>
```

**3. Feedback components**
```vue
<script setup>
import { useMessage, useNotification } from 'naive-ui'

const message = useMessage()
const notification = useNotification()

const showToast = () => {
  message.success('Operation successful')
}

const showNotification = () => {
  notification.info({
    title: 'Notification Title',
    content: 'Notification content',
    duration: 3000
  })
}
</script>
```

**4. Variable management component usage pattern**
```vue
<script setup>
import { useVariableManager } from '@prompt-optimizer/ui'

const services = inject('services')
const {
  isReady,
  isAdvancedMode,
  customVariables,
  allVariables,
  setAdvancedMode,
  addVariable,
  updateVariable,
  deleteVariable,
  replaceVariables
} = useVariableManager(services, { autoSync: true })

// Use variable replacement
const processedContent = computed(() => {
  return replaceVariables(originalContent.value, allVariables.value)
})
</script>
```

#### 3.8.5 Best Practices

- **Import on demand**: Import only the components you use to reduce bundle size
- **Theme consistency**: Use the theme system uniformly and avoid hard-coded colors
- **Responsive design**: Prefer NFlex over NSpace for better responsive support
- **Type safety**: Make full use of TypeScript type definitions
- **Component composition**: Use combinations of NCard + NFlex + NSpace appropriately for complex layouts
- **Theme switching**: Switch themes dynamically with the switchTheme() method

### 3.9 Testing Conventions
- Component tests
  - Test component rendering
  - Test user interaction
  - Test props and emits
  - Test boundary conditions

- Service tests
  - Mock external dependencies
  - Test async operations
  - Test error handling
  - Verify state changes

## 4. Application Flows

### 4.1 Core Service Initialization

1. **Core service loading order**
   - Import core services (modelManager, templateManager, historyManager)
   - Load model configuration
   - Load template configuration
   - Load history

2. **Service instance creation flow**
   - Create the LLM service instance
   - Create the prompt service instance
   - Register event handlers
   - Initialize service state

### 4.2 Web Application Initialization

1. **Application configuration loading**
   - Load environment variables
   - Initialize theme settings
   - Vue application configuration

2. **Service state synchronization**
   - Initialize model state
   - Load template data
   - Sync history

### 4.3 Prompt Optimization Flow

1. **User input stage**
   - Input validation flow
   - Error handling mechanism
   - Input cleanup and preprocessing

2. **Optimization processing stage**
   - Handle requests using the native SDK
   - Call the LLM service for optimization
   - Streaming response handling
   - Error handling and retry

3. **Result processing stage**
   - Streaming response UI updates
   - Store results in history
   - Error recovery and fallback handling

### 4.4 Model Management Flow

1. **Model configuration management**
   - Model configuration updates: Users can update a model's name, base URL, API key, list of available models, default model, and whether it is enabled.
   - **Advanced LLM parameters (`llmParams`)**:
     - The `ModelConfig` interface includes an `llmParams?: Record<string, any>;` field.
     - This field lets users provide, for each model configuration, a flexible key-value mapping for specifying parameters specific to that LLM provider's SDK.
     - Users can add any parameter supported by their LLM SDK.
     - **Examples**:
       - **OpenAI/OpenAI-compatible APIs (such as DeepSeek, Zhipu):**
         ```json
         "llmParams": {
           "temperature": 0.7,
           "max_tokens": 4096,
           "timeout": 60000, // Request timeout for the OpenAI client (milliseconds)
           "top_p": 0.9,
           "frequency_penalty": 0.5
           // ... other parameters supported by OpenAI
         }
         ```
       - **Gemini:**
         ```json
         "llmParams": {
           "temperature": 0.8,
           "maxOutputTokens": 2048, // Note: Gemini uses maxOutputTokens
           "topP": 0.95,
           "topK": 40
           // ... other parameters supported by Gemini
         }
         ```
     - **How `LLMService` handles `llmParams`**:
       - For OpenAI-compatible APIs, the `timeout` value (if provided) is used to configure the timeout setting of the OpenAI JavaScript SDK client instance. The remaining parameters (such as `temperature`, `max_tokens`, `top_p`, etc.) are passed directly to the `chat.completions.create()` method.
       - For Gemini, parameters such as `temperature`, `maxOutputTokens`, `topP`, and `topK` are included in the `generationConfig` object passed to `model.startChat()`.
       - Parameters not explicitly handled by the service (i.e. anything other than `timeout` for OpenAI, or other than known Gemini parameters) are generally passed safely into the request of the corresponding SDK, if the SDK supports them.
   - Connection test: Verify that the API key and base URL are correct and that the model is available.
   - Configuration validation: Ensure that all required fields are filled in and correctly formatted. The `llmParams` field (if provided) must be an object.
   - Error handling: Provide clear error messages when the configuration is incorrect or the connection fails.

2. **API key management**
   - Key setting and encryption
   - Key validation
   - Secure storage
   - Error handling

### 4.5 Template Management Flow

1. **Template operation flow**
   - Save templates
   - Validate templates
   - Template category management
   - Error handling

2. **Template application flow**
   - Get templates
   - Apply templates
   - Data validation
   - Error handling

### 4.6 History Management

1. **Record saving flow**
   - Add records
   - Data synchronization
   - Automatic cleanup
   - Error handling

2. **Record operation flow**
   - Get records
   - Filter records
   - Delete records
   - Error handling

### 4.7 Error Handling Flow

1. **API error handling strategy**
   - Identification of retryable errors
   - Backoff retry mechanism
   - Error reporting
   - User notification
   - Fallback handling

2. **Validation error handling**
   - Field validation
   - UI updates
   - Focus handling
   - Error messages

3. **Global error handling**
   - Error classification
   - Error recovery
   - Error reporting
   - User feedback

## 5. Code Review Checklist

### 5.1 General Review Items
- Code quality
  - [ ] Follows the agreed code style
  - [ ] No unused variables or imports
  - [ ] Appropriate comments and documentation
  - [ ] Avoids duplicate code
- Security
  - [ ] Input validation
  - [ ] Protection of sensitive information
  - [ ] Secure storage of API keys
  - [ ] Prevents XSS attacks
- Performance
  - [ ] Avoids unnecessary computation
  - [ ] Performance handling for large datasets
  - [ ] Caches computed results

### 5.2 Frontend Review Items
- Component design
  - [ ] Components have a single responsibility
  - [ ] Props and events are clearly defined
  - [ ] State management is reasonable
  - [ ] Error handling is thorough
- UI/UX
  - [ ] Responsive design
  - [ ] Accessibility support
  - [ ] Good error feedback
  - [ ] Loading state handling

### 5.3 Core Package Review Items
- API design
  - [ ] Interface consistency
  - [ ] Standardized error handling
  - [ ] Complete type definitions
  - [ ] Documentation comments
- Service implementation
  - [ ] Single responsibility principle
  - [ ] Appropriate level of abstraction
  - [ ] Test coverage
  - [ ] Error recovery mechanism

## 6. Development Environment Requirements

### 6.1 Development Environment
- Node.js >= 18.0.0
- pnpm >= 8.15.0
- VS Code
  - Volar 1.8.x
  - ESLint
  - Prettier
  - Cursor
  - GitLens
  - Tailwind CSS IntelliSense

### 6.2 Browser Support
- Chrome >= 90
- Firefox >= 90
- Safari >= 14
- Edge >= 90
- Mobile browsers
  - iOS Safari >= 14
  - Android Chrome >= 90

## Handling Cross-Origin Issues

### ⚠️ The Proxy Feature Has Been Removed

For security reasons (SSRF vulnerability risk; see [GitHub Issue #169](https://github.com/linshenkx/prompt-optimizer/issues/169) for details), we have **completely removed** the built-in Vercel and Docker proxy features in v1.x.

### Recommended Solutions

If you run into cross-origin issues, use the following options:

1. **Desktop application** (recommended)
   - No cross-origin restrictions
   - Runs locally, more secure
   - Supports all LLM APIs

2. **Self-hosted reverse proxy**
   - Use tools such as Nginx or Caddy
   - Full control over the security policy
   - See the historical implementation in `docs/archives/122-docker-api-proxy/`

3. **The LLM provider's own proxy**
   - Some providers offer CORS-friendly endpoints
   - Consult the corresponding provider's documentation

### Historical Notes

Early versions (v0.x) provided built-in proxy endpoints (`/api/proxy`, `/api/stream`), but they were removed after a security audit found SSRF risks. The historical implementation can be found in `docs/archives/122-docker-api-proxy/implementation.md`

Last updated: 2025-01-21
