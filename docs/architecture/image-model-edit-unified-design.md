# ImageModelEditModal Unified Interface Improvement Plan

## Design Principles

### 1. Maintain Consistency
- Keep the design style consistent with the text model management interface
- Follow the same form layout and interaction patterns
- A unified workflow and user experience

### 2. Group Information Rather Than Splitting It Into Steps
- Logically group related configuration items
- Use visual separation (dividers, cards) rather than step navigation
- Present all information in a single scrollable interface

### 3. Smart Interaction
- Dynamically show relevant configuration items based on the selection
- Provide real-time validation and feedback
- Support quick testing and preview

## New Interface Structure

```vue
<template>
  <NModal preset="card" :title="isEditing ? 'Edit Image Model' : 'Add Image Model'">
    <NScrollbar style="max-height: 75vh;">
      <!-- 1. Basic information area -->
      <NSpace vertical :size="16">
        <NFormItem label="Model Name" required>
          <NInput v-model:value="formData.name" placeholder="Give the model an easily recognizable name" />
        </NFormItem>

        <NFormItem label="Enabled">
          <NCheckbox v-model:checked="formData.enabled">Enable this model</NCheckbox>
        </NFormItem>
      </NSpace>

      <!-- 2. Provider configuration area -->
      <NDivider style="margin: 24px 0;" />
      <NH4 style="margin: 0 0 16px 0;">Provider Configuration</NH4>

      <NSpace vertical :size="16">
        <NFormItem label="Image Provider" required>
          <NSelect
            v-model:value="formData.providerId"
            :options="providerOptions"
            placeholder="Select an image generation service provider"
            @update:value="onProviderChange"
          />
        </NFormItem>

        <!-- Provider information display -->
        <NAlert v-if="selectedProvider" type="info">
          {{ selectedProvider.description }}
        </NAlert>

        <!-- Dynamic connection configuration -->
        <div v-for="field in connectionFields" :key="field.name">
          <NFormItem :label="t(field.labelKey)" :required="field.required">
            <NInput
              v-if="field.type === 'string'"
              v-model:value="formData.connectionConfig[field.name]"
              :type="field.name.toLowerCase().includes('key') ? 'password' : 'text'"
              :placeholder="field.placeholder"
            />
            <NInputNumber
              v-else-if="field.type === 'number'"
              v-model:value="formData.connectionConfig[field.name]"
              :placeholder="field.placeholder"
            />
          </NFormItem>
        </div>

        <!-- Connection test -->
        <NSpace align="center">
          <NButton
            @click="testConnection"
            :loading="isTestingConnection"
            :disabled="!canTestConnection"
            secondary
            type="info"
          >
            Test Connection
          </NButton>
          <NTag v-if="connectionStatus" :type="connectionStatus.type">
            {{ t(connectionStatus.messageKey) }}
          </NTag>
        </NSpace>
      </NSpace>

      <!-- 3. Model selection area -->
      <NDivider style="margin: 24px 0;" />
      <NH4 style="margin: 0 0 16px 0;">Model Configuration</NH4>

      <NSpace vertical :size="16">
        <NFormItem label="Image Model" required>
          <NSpace align="center">
            <NSelect
              v-model:value="formData.modelId"
              :options="modelOptions"
              :loading="isLoadingModels"
              placeholder="Select or enter a model name"
              style="flex: 1;"
              clearable
              filterable
              tag
            />
            <NButton
              @click="refreshModels"
              :loading="isLoadingModels"
              :disabled="!canRefreshModels"
              circle
              secondary
            >
              <template #icon>
                <svg><!-- refresh icon --></svg>
              </template>
            </NButton>
          </NSpace>
        </NFormItem>

        <!-- Model status information -->
        <NAlert v-if="modelLoadingStatus" :type="modelLoadingStatus.type">
          {{ t(modelLoadingStatus.messageKey) }}
          <template v-if="modelLoadingStatus.count">
            ({{ modelLoadingStatus.count }} models in total)
          </template>
        </NAlert>

        <!-- Capability display for the selected model -->
        <NCard v-if="selectedModel" size="small">
          <template #header>
            <NSpace align="center">
              <NIcon size="18"><LightBulbIcon /></NIcon>
              <span>Model Capabilities</span>
            </NSpace>
          </template>

          <NSpace wrap style="margin-bottom: 12px;">
            <NTag v-if="selectedModel.capabilities?.text2image" type="success">Text-to-Image</NTag>
            <NTag v-if="selectedModel.capabilities?.image2image" type="info">Image-to-Image</NTag>
            <NTag v-if="selectedModel.capabilities?.multiImage" type="warning">Multi-Image</NTag>
            <NTag v-if="selectedModel.capabilities?.highResolution" type="primary">High Resolution</NTag>
          </NSpace>

          <NText depth="2" style="font-size: 14px;">
            {{ selectedModel.description }}
          </NText>
        </NCard>
      </NSpace>

      <!-- 4. Parameter configuration area (collapsible) -->
      <NDivider style="margin: 24px 0;" />
      <NCollapse>
        <NCollapseItem title="Advanced Parameter Configuration" name="advanced">
          <template #header-extra>
            <NText depth="3" style="font-size: 12px;">
              Optional, used to override default model parameters
            </NText>
          </template>

          <NSpace vertical :size="16">
            <!-- Quick parameter add -->
            <NSpace align="center">
              <NText strong>Add Parameter:</NText>
              <NSelect
                v-model:value="selectedNewParamId"
                :options="availableParameterOptions"
                placeholder="Select a predefined parameter"
                style="width: 200px;"
                @update:value="handleQuickAddParam"
              />
              <NButton @click="addCustomParameter" dashed>
                + Custom Parameter
              </NButton>
            </NSpace>

            <!-- List of configured parameters -->
            <div v-for="(value, paramName) in formData.paramOverrides" :key="paramName">
              <NFormItem :label="getParameterLabel(paramName)">
                <template #label-extra>
                  <NButton @click="removeParameter(paramName)" size="tiny" quaternary circle>
                    <template #icon>×</template>
                  </NButton>
                </template>

                <!-- Render different input components depending on parameter type -->
                <NInputNumber
                  v-if="getParameterType(paramName) === 'number'"
                  v-model:value="formData.paramOverrides[paramName]"
                  :min="getParameterMin(paramName)"
                  :max="getParameterMax(paramName)"
                  :step="getParameterStep(paramName)"
                />
                <NSlider
                  v-else-if="getParameterType(paramName) === 'slider'"
                  v-model:value="formData.paramOverrides[paramName]"
                  :min="getParameterMin(paramName)"
                  :max="getParameterMax(paramName)"
                  :step="getParameterStep(paramName)"
                  :marks="getParameterMarks(paramName)"
                />
                <NSelect
                  v-else-if="getParameterType(paramName) === 'select'"
                  v-model:value="formData.paramOverrides[paramName]"
                  :options="getParameterOptions(paramName)"
                />
                <NInput
                  v-else
                  v-model:value="formData.paramOverrides[paramName]"
                  :placeholder="getParameterPlaceholder(paramName)"
                />

                <template #feedback>
                  <NText depth="3" style="font-size: 12px;">
                    {{ getParameterDescription(paramName) }}
                  </NText>
                </template>
              </NFormItem>
            </div>
          </NSpace>
        </NCollapseItem>
      </NCollapse>
    </NScrollbar>

    <!-- Action buttons -->
    <template #action>
      <NSpace justify="end">
        <NButton @click="close">Cancel</NButton>
        <NButton type="primary" @click="save" :loading="isSaving" :disabled="!canSave">
          {{ isEditing ? 'Update' : 'Save' }}
        </NButton>
      </NSpace>
    </template>
  </NModal>
</template>
```

## Key Improvements

### 1. Structural Optimization
- **Removed step navigation**: Removed the `NSteps` component and the step-switching logic
- **Logical grouping**: Use dividers and headings to group related configuration
- **Single-page display**: All configuration items on one scrollable page

### 2. Interaction Optimization
- **Smart display**: Dynamically show the connection configuration based on the provider selection
- **Real-time feedback**: Connection test and model loading status are shown in real time
- **Quick actions**: Support quick model selection and quick parameter addition

### 3. User Experience Improvements
- **Collapsible area**: Advanced parameters use a collapse panel to reduce interface complexity
- **Smart defaults**: Provide sensible default values and placeholders
- **Action hints**: Key actions come with clear hints and help information

### 4. Consistency Guarantees
- **Unified layout**: A layout style consistent with the text model management interface
- **Unified interaction**: The same operation logic and feedback mechanism
- **Unified styling**: Use the same components and style system

## Technical Implementation Points

### 1. Reactive Layout
```typescript
// Dynamically compute connection fields based on the provider selection
const connectionFields = computed(() => {
  if (!selectedProvider.value) return []
  return generateConnectionFields(selectedProvider.value.connectionSchema)
})

// Smart form validation
const canSave = computed(() => {
  return formData.value.name &&
         formData.value.providerId &&
         formData.value.modelId &&
         validateConnectionConfig()
})
```

### 2. Dynamic Form Generation
```typescript
// Dynamically generate form fields from the provider schema
const generateConnectionFields = (schema: ConnectionSchema) => {
  const fields = []
  schema.required?.forEach(fieldName => {
    fields.push({
      name: fieldName,
      required: true,
      type: schema.fieldTypes[fieldName],
      labelKey: `image.connection.${fieldName}`,
      placeholder: t(`image.connection.${fieldName}Placeholder`)
    })
  })
  // ... handle optional fields
  return fields
}
```

### 3. Parameter Management Optimization
```typescript
// Quick parameter add
const handleQuickAddParam = (paramId: string) => {
  if (!paramId || paramId === 'custom') return

  const paramDef = availableParameters.value.find(p => p.id === paramId)
  if (paramDef) {
    formData.value.paramOverrides[paramDef.name] = paramDef.defaultValue
  }
}

// Add a custom parameter
const addCustomParameter = () => {
  // Open the custom parameter input dialog
  showCustomParamDialog.value = true
}
```

## Migration Plan

### Phase 1: Interface Refactor
1. Remove the step navigation code
2. Re-lay out the form structure
3. Implement the dynamic field display logic

### Phase 2: Interaction Optimization
1. Optimize the connection test experience
2. Improve the model selection and loading flow
3. Refine the parameter configuration interface

### Phase 3: Experience Polish
1. Add action hints and help
2. Optimize error handling and feedback
3. Refine the responsive layout

This unified design will significantly improve the user experience and make image model configuration more efficient and intuitive.
