# Project Structure Document

> **Note:** This document focuses on the project's file and directory structure. For tech stack details and implementation workflow, see the [Technical Documentation](./technical-documentation.md).

## 1. Overall Project Architecture

### 1.1 Root Directory Structure
```
prompt-optimizer/
├── packages/             # Project packages
│   ├── core/            # Core functionality package
│   │   ├── src/         # Core source code
│   │   ├── tests/       # Core package tests
│   │   └── package.json # Core package configuration
│   ├── web/             # Web version
│   │   ├── src/         # Web source code
│   │   ├── tests/       # Web tests
│   │   └── package.json # Web package configuration
│   └── extension/       # Chrome extension
├── docs/                # Project documentation
├── tools/               # Utility scripts
└── ...configuration files
```

### 1.2 Configuration Files
- `pnpm-workspace.yaml` - Workspace configuration
- `.env.example` - Environment variable example
- `package.json` - Project configuration
- `.vscode/` - VSCode configuration directory
- `.cursorrules` - Cursor IDE configuration
- `.gitignore` - Git ignore configuration

### 1.3 Workspace Files
- `README.md` - Project description document
- `scratchpad.md` - Development notes and task planning (migrated to docs/workspace/)
- `experience.md` - Project lessons learned (migrated to docs/workspace/)

### 1.4 Documentation Directory (docs/)
- `README.md` - Documentation index
- `development-guidelines.md` - Development guidelines
- `project-status.md` - Project status
- `project-structure.md` - Project structure
- `technical-documentation.md` - Technical documentation
- `prd.md` - Product requirements document
- `CHANGELOG.md` - Changelog

## 2. Core Package Structure (packages/core)

### 2.1 Source Directory (packages/core/src/)
```
src/
├── services/           # Core services
│   ├── llm/           # LLM service
│   │   ├── service.ts # LLM service implementation
│   │   ├── types.ts   # Type definitions
│   │   └── errors.ts  # Error definitions
│   ├── model/         # Text model management
│   │   ├── manager.ts # Model manager
│   │   ├── types.ts   # Type definitions
│   │   └── defaults.ts# Default configuration
│   ├── image/         # Image service (new)
│   │   ├── service.ts # Image generation service
│   │   ├── types.ts   # Image service type definitions
│   │   ├── electron-proxy.ts # Electron proxy
│   │   └── adapters/  # Image provider adapters
│   │       ├── abstract-adapter.ts # Abstract adapter base class
│   │       ├── registry.ts         # Adapter registry
│   │       ├── openai.ts          # OpenAI DALL-E adapter
│   │       ├── gemini.ts          # Google Gemini adapter
│   │       ├── siliconflow-adapter.ts # SiliconFlow adapter
│   │       └── seedream.ts        # SeeDream adapter
│   ├── image-model/   # Image model management (new)
│   │   ├── manager.ts # Image model manager
│   │   ├── types.ts   # Type definitions
│   │   └── defaults.ts# Default configuration
│   ├── prompt/        # Prompt service
│   │   ├── service.ts # Prompt service implementation
│   │   ├── types.ts   # Type definitions
│   │   └── errors.ts  # Error definitions
│   ├── template/      # Template service
│   │   ├── manager.ts # Template manager
│   │   ├── types.ts   # Type definitions
│   │   └── default-templates/ # Default templates
│   │       ├── image-optimize/ # Image templates (new)
│   │       │   ├── text2image/ # Text-to-image templates
│   │       │   ├── image2image/ # Image-to-image templates
│   │       │   └── iterate/    # Image iteration templates
│   │       ├── basic/         # Basic templates
│   │       └── context/       # Context templates
│   └── history/       # History service
│       ├── manager.ts # History manager
│       └── types.ts   # Type definitions
├── types/             # Shared type definitions
└── utils/             # Utility functions
```

### 2.2 API Directory (src/api/)
- `api/llm.js` - LLM API call wrapper

### 2.3 Configuration Directory (packages/core/config/)
- `models.js` - LLM model configuration
- `prompts.js` - Prompt template configuration

### 2.4 Test Directory (packages/core/tests/)
```
tests/
├── unit/             # Unit tests
│   └── services/     # Service tests
│       ├── llm/      # LLM service tests
│       ├── model/    # Model management tests
│       └── prompt/   # Prompt service tests
└── integration/      # Integration tests
    └── services/     # Service integration tests
```

### 2.5 Core Package Configuration
- `package.json` - Core package configuration
- `tsconfig.json` - TypeScript configuration
- `vitest.config.ts` - Test configuration

## 3. Web Package Structure (packages/web)

### 3.1 Source Directory (packages/web/src/)
```
src/
├── components/        # Vue components
│   ├── PromptPanel.vue      # Prompt panel
│   ├── ModelManager.vue     # Unified model manager (supports switching between text/image models)
│   ├── ImageModelManager.vue# Dedicated image model management component
│   ├── ImageModelEditModal.vue # Image model edit dialog
│   ├── TemplateManager.vue  # Template manager
│   ├── InputPanel.vue       # Input panel
│   ├── OutputPanel.vue      # Output panel
│   └── image-mode/         # Image mode components
│       └── ImageWorkspace.vue # Image workspace
├── composables/       # Vue composables
│   ├── useImageModelManager.ts # Image model management composable
│   ├── useImageGeneration.ts   # Image generation composable
│   └── useImageWorkspace.ts    # Image workspace composable
├── services/          # Business logic
│   ├── llm/           # LLM service
│   ├── model/         # Model configuration
│   ├── prompt/        # Prompt service
│   ├── promptManager.js # Prompt management
│   └── themeManager.js # Theme management
├── assets/           # Static assets
│   ├── images/       # Image assets
│   └── styles/       # Style assets
├── prompts/          # Prompt templates
├── App.vue           # Root component
└── main.ts           # Entry file
```

### 3.2 Component Directory Details (packages/web/src/components/)

#### Core Components
- `PromptPanel.vue` - Prompt input and optimization panel
- `InputPanel.vue` - Input panel component
- `OutputPanel.vue` - Output panel component
- `TemplateManager.vue` - Template manager
- `ThemeToggle.vue` - Theme toggle component
- `LoadingSpinner.vue` - Loading spinner component

#### Model Management Architecture
- `ModelManager.vue` - **Unified model manager**
  - Supports tab switching between text models and image models
  - Text models: managed directly within this component
  - Image models: delegated to the `ImageModelManager.vue` component
  - Replaces the original single-component model management approach (`ModelManager.vue.bak`)

- `ImageModelManager.vue` - **Dedicated image model management component**
  - Specifically responsible for image model list display, connection testing, enable/disable, and other operations
  - Used together with the `useImageModelManager` composable
  - Supports model management for image providers (OpenAI DALL-E, Gemini, SiliconFlow, etc.)

- `ImageModelEditModal.vue` - **Image model edit dialog**
  - Used to add/edit image model configurations
  - Form features such as provider selection, model selection, and connection configuration

#### Image Mode Components
- `image-mode/ImageWorkspace.vue` - **Image workspace**
  - The main working interface of image mode
  - Integrates text-to-image, image-to-image, image iteration, and other features

### 3.3 Test Directory (packages/web/tests/)
```
tests/
├── unit/            # Unit tests
│   ├── components/  # Component tests
│   └── services/    # Service tests
└── integration/     # Integration tests
    └── services/    # Service integration tests
```

### 3.4 Web Package Configuration
- `package.json` - Web package configuration
- `vite.config.ts` - Vite configuration
- `tailwind.config.js` - TailwindCSS configuration
- `.env.local` - Local environment variables
- `postcss.config.js` - PostCSS configuration
- `index.html` - Project entry HTML file

## 4. Extension Package Structure (packages/extension)

### 4.1 Source Directory (packages/extension/src/)
```
src/
├── popup/           # Popup window interface
├── background/      # Background scripts
├── content/         # Content scripts
└── manifest.json    # Extension configuration file
```

### 4.2 Extension Package Configuration
- `package.json` - Extension package configuration
- `vite.config.ts` - Build configuration

## 5. Dependencies

### 5.1 Core Package Dependencies (@prompt-optimizer/core)
```
@prompt-optimizer/core
├── @openai/openai ^4.83.0      # OpenAI SDK
├── @google/generative-ai ^0.21.0 # Google Generative AI SDK
└── uuid ^11.0.5                # UUID generation
```

### 5.2 Web Package Dependencies (@prompt-optimizer/web)
```
@prompt-optimizer/web
├── @prompt-optimizer/core  # Depends on the core package
├── vue ^3.5.x             # Vue framework
├── pinia ^2.1.x           # State management
└── tailwindcss ^3.4.1     # Styling framework
```

### 5.3 Extension Package Dependencies (@prompt-optimizer/extension)
```
@prompt-optimizer/extension
├── @prompt-optimizer/core  # Depends on the core package
├── @prompt-optimizer/ui    # Depends on the UI component package
└── vue ^3.5.x             # Vue framework
```
