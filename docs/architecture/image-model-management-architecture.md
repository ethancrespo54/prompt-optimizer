# Image Model Management Architecture Design

## Overview

This document describes the new architecture design for image model management in Prompt Optimizer. The architecture follows the design principles of component separation and clear responsibilities, using a combination of `ImageModelManager` + `ModelManager.vue` to replace the original single-component model management approach.

## Architecture Design Principles

### 1. Separation of Concerns
- **Unified entry point**: `ModelManager.vue` serves as the unified entry point for model management
- **Specialized division of labor**: `ImageModelManager.vue` handles the management logic for image models specifically
- **Type isolation**: Text models and image models use different management strategies

### 2. Component Reuse and Extensibility
- **Reusable components**: `ImageModelManager.vue` can be used independently in other scenarios
- **Easy to extend**: When new model types are added in the future, only a new dedicated management component needs to be added
- **Standardized interface**: All model management components follow a unified interface specification

## Core Component Architecture

### 1. ModelManager.vue (Unified Model Manager)

```vue
<!-- Functional overview -->
<template>
  <NModal>
    <NTabs v-model:value="activeTab">
      <NTabPane name="text" tab="Text Models">
        <!-- Manage text models directly -->
      </NTabPane>
      <NTabPane name="image" tab="Image Models">
        <ImageModelManager />
      </NTabPane>
    </NTabs>
  </NModal>
</template>
```

#### Responsibilities
- Provide a unified entry interface for model management
- Switch between text models and image models via tabs
- Text models: managed directly within this component
- Image models: delegated to `ImageModelManager.vue`
- Manage the show/hide state of the dialog

#### Characteristics
- **Dual mode**: Supports both text and image model types
- **Delegation pattern**: Delegates image model management to a dedicated component
- **Unified interface**: Provides users with a consistent experience

### 2. ImageModelManager.vue (Dedicated Image Model Management Component)

```vue
<!-- Functional overview -->
<template>
  <div class="image-model-list">
    <NEmpty v-if="!configs?.length">
      <NButton @click="openAddModal">Add your first image model</NButton>
    </NEmpty>

    <NSpace v-else vertical>
      <NCard v-for="config in configs" :key="config.id">
        <!-- Model information display -->
        <!-- Connection test button -->
        <!-- Edit/delete actions -->
      </NCard>
    </NSpace>
  </div>
</template>
```

#### Responsibilities
- **Model list display**: Show the list of configured image models
- **Connection testing**: Test the connection status of each image model
- **State management**: Manage the enabled/disabled state of models
- **Action interface**: Provide entry points for editing, deleting, and other actions

#### Collaboration with useImageModelManager
- Uses the `useImageModelManager` composable to handle business logic
- Obtains `imageRegistry` and `imageModelManager` through dependency injection
- Reactive state management and handling of user actions

### 3. ImageModelEditModal.vue (Image Model Edit Dialog)

```vue
<!-- Unified interface design -->
<template>
  <NModal>
    <NScrollbar>
      <!-- Basic information area -->
      <NSpace vertical>
        <NFormItem label="Model Name" required>
          <NInput v-model:value="formData.name" />
        </NFormItem>
      </NSpace>

      <!-- Provider configuration area -->
      <NDivider />
      <NH4>Provider Configuration</NH4>
      <NSpace vertical>
        <!-- Provider selection -->
        <!-- Dynamic connection configuration -->
        <!-- Connection test -->
      </NSpace>

      <!-- Model selection area -->
      <NDivider />
      <NH4>Model Configuration</NH4>
      <!-- Model selection and capability display -->

      <!-- Parameter configuration area (collapsible) -->
      <NDivider />
      <NCollapse>
        <NCollapseItem title="Advanced Parameter Configuration">
          <!-- Parameter configuration interface -->
        </NCollapseItem>
      </NCollapse>
    </NScrollbar>
  </NModal>
</template>
```

#### Design Philosophy: A Unified Interface
- **Abandon navigation-style design**: No more multi-step wizard; all configuration is completed in a single interface
- **Logical grouped display**: Use dividers and headings to group related configuration rather than splitting it into steps
- **Smart interaction design**: Dynamically show relevant configuration items based on user selection
- **Consistent with text models**: Keep the same design style as the text model management interface

#### Main Functional Areas
1. **Basic information**: Basic configuration such as model name and enabled state
2. **Provider configuration**: Provider selection, connection parameters, connection test
3. **Model configuration**: Model selection, capability display, dynamic model discovery
4. **Advanced parameters**: A collapsible parameter override configuration area

#### User Experience Advantages
- **High operational efficiency**: All configuration items in one interface, with no step switching
- **Holistic information**: Users can see all configuration information as a whole
- **Convenient editing**: When modifying, users can go directly to the configuration item that needs adjusting
- **Good consistency**: Same operation experience as text model management

## Composable Layer Architecture

### useImageModelManager.ts

```typescript
export function useImageModelManager() {
  // Dependency injection
  const registry = inject<IImageAdapterRegistry>('imageRegistry')!
  const imageModelManager = inject<IImageModelManager>('imageModelManager')!

  // State management
  const providers = ref<ImageProvider[]>([])
  const configs = ref<ImageModelConfig[]>([])

  // Business logic
  const loadProviders = async () => { /* ... */ }
  const testConnection = async (configId: string) => { /* ... */ }
  const saveConfig = async (config: ImageModelConfig) => { /* ... */ }

  return {
    providers,
    configs,
    loadProviders,
    testConnection,
    saveConfig
  }
}
```

#### Design Characteristics
- **Dependency injection**: Obtain core services through Vue's provide/inject
- **Reactive state**: Manage state using Vue 3's reactivity system
- **Encapsulated business logic**: Extract complex business logic out of components

## Core Service Layer Architecture

### 1. Image Adapter System

```
packages/core/src/services/image/adapters/
├── abstract-adapter.ts     # Abstract adapter base class
├── registry.ts            # Adapter registry
├── openai.ts             # OpenAI DALL-E adapter
├── gemini.ts             # Google Gemini adapter
├── siliconflow-adapter.ts # SiliconFlow adapter
└── seedream.ts           # SeeDream adapter
```

#### AbstractImageProviderAdapter

```typescript
export abstract class AbstractImageProviderAdapter {
  abstract getProvider(): ImageProvider
  abstract getSupportedModels(): Promise<ImageModel[]>
  abstract generateImage(request: ImageRequest): Promise<ImageResult>
  abstract testConnection(config: ImageModelConfig): Promise<boolean>
}
```

#### Design Advantages
- **Unified interface**: All image providers implement the same interface
- **Easy to extend**: Adding a new provider only requires implementing the abstract adapter
- **Type safe**: Complete TypeScript type definitions

### 2. Image Model Manager

```typescript
// packages/core/src/services/image-model/manager.ts
export class ImageModelManager implements IImageModelManager {
  async listConfigs(): Promise<ImageModelConfig[]>
  async addConfig(config: ImageModelConfig): Promise<void>
  async updateConfig(config: ImageModelConfig): Promise<void>
  async deleteConfig(id: string): Promise<void>
  async testConnection(id: string): Promise<boolean>
}
```

## Data Flow and Interaction Patterns

### 1. Component Interaction Flow

```
User action → ModelManager.vue → ImageModelManager.vue → useImageModelManager → Core service layer
                                ↓
                        ImageModelEditModal.vue (edit dialog)
```

### 2. State Management Flow

```
Initialization:
1. ImageModelManager mounts
2. useImageModelManager initializes
3. Core services are obtained through dependency injection
4. The provider and configuration lists are loaded

User actions:
1. The user clicks "Add Model"
2. ImageModelEditModal opens
3. The user fills in the configuration and saves
4. The core service is called to save the configuration
5. The reactive state is updated
6. The UI updates automatically
```

## Comparison with the Original Approach

### Analysis of Problems in the Original Approach

#### 1. ModelManager.vue.bak (Single Component with Mixed Management)
- **Mixed responsibilities**: Text models and image models mixed in one component
- **Complex code**: The component has a large amount of code and is hard to maintain
- **Poor extensibility**: Adding a new model type requires modifying the core component

#### 2. Navigation-Style Edit Interface (5-Step Wizard)
- **Tedious operation**: Requires switching between 5 steps: basic info → provider → connection → model → parameters
- **Fragmented information**: Related information is scattered across different steps, making it hard to see as a whole
- **Inefficient**: Every edit requires navigating step by step, which is especially inconvenient when modifying
- **Poor consistency**: Inconsistent with the unified design of text models

### Advantages of the New Approach

#### 1. Architectural Advantages (ImageModelManager + ModelManager.vue)
- **Clear responsibilities**: Text models and image models are managed separately
- **Component reuse**: ImageModelManager can be used independently
- **Easy to maintain**: Each component focuses on specific functionality
- **Extension friendly**: Adding a new model type only requires adding a new component

#### 2. Interface Advantages (Unified Edit Interface)
- **Efficient operation**: All configuration items in one interface, with no step switching
- **Complete information**: Users can see all configuration information as a whole
- **Convenient editing**: When modifying, users can go directly to the configuration item that needs adjusting
- **Consistent experience**: Same operation experience as text model management
- **Low learning cost**: Users do not need to learn different operation modes

## Advantages and Benefits

### 1. Technical Advantages
- **Modular design**: Clear component separation and division of responsibilities
- **Type safety**: Complete TypeScript type support
- **Reactive design**: Based on the Vue 3 Composition API
- **Dependency injection**: A loosely coupled service architecture

### 2. Development Benefits
- **Development efficiency**: Specialized components make development and debugging simpler
- **Code reuse**: The image model management component can be used in multiple places
- **Team collaboration**: Different developers can work on different model types in parallel
- **Quality assurance**: Single responsibility reduces the likelihood of bugs

### 3. User Experience
- **Unified interface**: Users manage all models from a single entry point
- **Specialized features**: Specialized management features for image models
- **Smooth operation**: A smooth experience brought by the reactive design

## Future Extension Plans

### 1. Short-Term Extensions
- **Audio model management**: Add an AudioModelManager component
- **Video model management**: Support managing video generation models
- **Model grouping**: Support model categorization and tag management

### 2. Long-Term Plans
- **Cloud sync**: Cloud synchronization of model configurations
- **Model marketplace**: Integrate third-party model marketplaces
- **Auto-discovery**: Automatically discover and configure new model providers

## Summary

Through its design of separation of concerns and component specialization, the ImageModelManager + ModelManager.vue architecture gives Prompt Optimizer an extensible and maintainable model management solution. This architecture not only meets the current need for image model management but also lays a solid foundation for future feature expansion.
