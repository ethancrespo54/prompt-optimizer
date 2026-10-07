# Test Area Refactor Migration Guide

## Overview

TestPanel.vue and the condition-based use of AdvancedTestPanel have been replaced by the new unified TestAreaPanel component. This guide helps you migrate your existing code.

## Key Changes

### 1. Component Unification
- **Old approach**: TestPanelUI (basic mode) + AdvancedTestPanel (advanced mode)
- **New approach**: TestAreaPanel (a unified component that handles mode differences automatically)

### 2. Interface Simplification
- **Redundancy removed**: The showTestInput prop has been removed and is now derived automatically from optimizationMode
- **Responsive**: Automatically adapts to different screen sizes
- **Unified styling**: Strictly follows the Naive UI design guidelines

## Migration Steps

### Web Package (completed)
packages/web/src/App.vue has already been migrated and serves as a reference example.

### Extension Package (completed)
packages/extension/src/App.vue has been migrated to the new unified TestAreaPanel component.

Main changes:
- Removed the conditionally rendered TestPanelUI and AdvancedTestPanel
- Adopted the unified TestAreaPanel component, which handles mode differences automatically
- Added responsive layout configuration and test mode configuration
- Implemented the new event handling mechanism

#### 1. Update import statements
```vue
// Old code
import { TestPanelUI, AdvancedTestPanel } from '@prompt-optimizer/ui'

// New code  
import { TestAreaPanel, useResponsiveTestLayout, useTestModeConfig } from '@prompt-optimizer/ui'
```

#### 2. Add state management
```vue
// New test content state
const testContent = ref('')
const isCompareMode = ref(true)

// New responsive configuration
const responsiveLayout = useResponsiveTestLayout()
const testModeConfig = useTestModeConfig(selectedOptimizationMode)
```

#### 3. Replace template code
```vue
<!-- Old code -->
<TestPanelUI v-if="!advancedModeEnabled" ... />
<AdvancedTestPanel v-else ... />

<!-- New code -->
<TestAreaPanel
  :optimization-mode="selectedOptimizationMode"
  :advanced-mode-enabled="advancedModeEnabled"
  v-model:test-content="testContent"
  v-model:is-compare-mode="isCompareMode"
  :input-mode="responsiveLayout.recommendedInputMode.value"
  :control-bar-layout="responsiveLayout.recommendedControlBarLayout.value"
  :button-size="responsiveLayout.smartButtonSize.value"
  @test="handleTestAreaTest"
  @compare-toggle="handleTestAreaCompareToggle"
>
  <!-- Slot content -->
</TestAreaPanel>
```

#### 4. Add event handler functions
```vue
const handleTestAreaTest = async () => {
  // Test logic
}

const handleTestAreaCompareToggle = () => {
  isCompareMode.value = !isCompareMode.value
}
```

## Key Benefits

### 1. Eliminated Interface Redundancy
- showTestInput is derived automatically from optimizationMode
- Unified component interface with fewer conditional checks

### 2. Responsive Support  
- Automatic screen size adaptation
- Smart layout mode switching
- Debounced window listeners

### 3. Unified Styling
- Fully follows the Naive UI design system
- All hard-coded CSS removed
- Visually consistent with the optimization area on the left

### 4. Type Safety
- Complete TypeScript type definitions
- IDE IntelliSense support
- Compile-time type checking

## Backward Compatibility

### Retained Components
- AdvancedTestPanel.vue is temporarily retained for use by other packages
- TestPanel.vue has been renamed to TestPanel.vue.backup

### Export Updates
- The TestPanelUI export has been removed
- The TestAreaPanel export has been added
- Related composables and type exports have been added

## Testing Recommendations

1. **Functional testing**: Make sure testing, compare mode, model selection, and other features work correctly
2. **Responsive testing**: Test the layout at different screen sizes
3. **Compatibility testing**: Make sure switching between advanced mode and basic mode works correctly
4. **Style testing**: Verify visual consistency with the existing UI

## Notes

1. **Incremental migration**: Migrate one package at a time to ensure stability
2. **Thorough testing**: Run full functional tests after migration
3. **Backup files**: The old component files have been backed up and can be restored if needed
4. **Documentation updates**: Update related documentation and usage instructions

## Support

If you run into problems during migration, refer to:
- The Web package's App.vue as a complete example
- Component type definitions: `packages/ui/src/components/types/test-area.ts`
- Style guidelines: `docs/components/test-area-style-guide.md`
