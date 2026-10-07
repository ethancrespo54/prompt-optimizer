# Context Editor Refactor - Task Breakdown (Engineering-optimized Edition)

## Phase 1: ConversationManager Lightweighting Confirmation and Enhancement

### 1.1 Current State Analysis and API Alignment

- [x] 1.1.1 Confirm the current state of ConversationManager
  - File: packages/ui/src/components/ConversationManager.vue
  - Confirm that the current version no longer has quick template / import-export / sync-to-test UI elements
  - Confirm that two-way binding via v-model + update:messages is already implemented
  - Analyze how well the existing functionality aligns with the requirements design
  - Purpose: Establish the current baseline and avoid unnecessary changes
  - _Leverage: existing ConversationManager.vue implementation_
  - _Requirements: Requirement 2_

- [x] 1.1.2 Update the type definitions of ConversationManager
  - File: packages/ui/src/types/components.ts
  - Clarify the type and default value strategy: make scanVariables/replaceVariables/isPredefinedVariable optional
  - Unify maxHeight as a number type to avoid string concatenation errors
  - Review the places where maxHeight is used in calculations to make sure the px concatenation logic is correct
  - Ensure the type definitions match the actual API usage
  - Purpose: Standardize the API interface and resolve type/implementation consistency problems
  - _Leverage: existing types/components.ts_
  - _Requirements: API design specification_

### 1.2 ConversationManager Feature Enhancement

- [x] 1.2.1 Confirm the lightweight UI design is in place
  - File: packages/ui/src/components/ConversationManager.vue
  - Confirm that the current version no longer has template / import-export / sync-to-test UI elements
  - Set a future development rule: do not re-add entries for these complex features to the Manager
  - Verify that the current UI meets the lightweight design requirements
  - Purpose: Maintain the lightweight architecture design
  - _Leverage: the existing simplified UI structure_
  - _Requirements: Requirement 2, Requirement 3_

- [x] 1.2.2 Enhance the inline editing experience (within lightweight boundaries)
  - File: packages/ui/src/components/ConversationManager.vue
  - Prefer NInput.autosize({ minRows, maxRows }) to cover 80% of scenarios
  - Enhance the inline hint for missing variables: stay restrained (small tag + hover details) and avoid over-complication
  - Add fine-grained dynamic row count optimization only when necessary, to avoid complexity
  - Optimize the interaction experience of role selection and text input
  - Purpose: Improve the user experience of the basic editing functionality while staying lightweight
  - _Leverage: NInput.autosize + the editing logic of ConversationMessageEditor.vue as a reference_
  - _Requirements: Requirement 2_

- [x] 1.2.3 Keep the existing data binding pattern
  - File: packages/ui/src/components/ConversationManager.vue
  - Keep the current v-model + update:messages pattern
  - Confirm the correctness of props and events
  - Do not change it to operate directly on parent refs
  - Purpose: Maintain a data flow pattern that follows Vue best practices
  - _Leverage: the existing data binding implementation_
  - _Requirements: Requirement 5_

### 1.3 Function Default Values Implementation

- [x] 1.3.1 Provide reasonable default implementations for functional functions
  - File: packages/ui/src/components/ConversationManager.vue
  - Use withDefaults to provide default implementations for optional props:
    - scanVariables: returns an empty array by default
    - replaceVariables: passes the content through by default
    - isPredefinedVariable: returns false by default
  - Ensure the default implementations match the type definitions (optional types + withDefaults)
  - Purpose: Resolve type/implementation consistency and provide fallback support for function props
  - _Leverage: existing variable handling logic_
  - _Requirements: API design specification_

### 1.4 Test Updates

- [x] 1.4.1 Update the ConversationManager unit tests
  - File: packages/ui/tests/unit/components/ConversationManager.spec.ts
  - Update test cases to match the current API
  - Add tests for the default function implementations
  - Verify the enhanced inline editing functionality
  - Purpose: Ensure correctness and stability of the functionality
  - _Leverage: existing test framework_
  - _Requirements: Requirement 2_

## Phase 2: ContextEditor Feature Migration and Enhancement

### 2.1 Parent Prop Configuration (Done Early to Ease Integration Testing)

- [x] 2.1.1 Update the parent component to pass optimizationMode to ContextEditor
  - File: packages/web/src/App.vue (and other places that use ContextEditor)
  - Add the optimizationMode parameter where ContextEditor is invoked
  - Ensure the parameter is passed correctly from the parent to ContextEditor
  - Purpose: Establish the complete chain for template filtering early, to ease later integration testing
  - _Leverage: existing parent state management_
  - _Requirements: Requirement 4_

### 2.2 Template Management Feature Migration

- [x] 2.2.1 Analyze the template management implementation of the backup component
  - File: packages/ui/src/components/ConversationManager.vue.backup
  - Extract how quickTemplateManager is used
  - Analyze the UI and logic of template selection, preview and application
  - Understand the implementation of categorization by optimizationMode and language
  - Purpose: Prepare for migrating the template functionality
  - _Leverage: the template functionality at ConversationManager.vue.backup:420-469_
  - _Requirements: Requirement 4_

- [x] 2.2.2 Implement template management in ContextEditor
  - File: packages/ui/src/components/ContextEditor.vue
  - Add a template management functional area (can be a new tab)
  - Implement template list display and categorization
  - Implement template preview and application
  - Use the optimizationMode parameter configured earlier for filtering
  - Purpose: Migrate the template functionality to ContextEditor and complete the whole chain
  - _Leverage: existing ContextEditor tab architecture + optimizationMode parameter_
  - _Requirements: Requirement 4_

- [x] 2.2.3 Add optimizationMode parameter support to ContextEditor
  - File: packages/ui/src/components/ContextEditor.vue
  - Add optimizationMode?: 'system' | 'user' to Props
  - Filter and categorize the displayed templates by mode
  - Ensure template filtering is correct
  - Purpose: Implement mode-based template categorization
  - _Leverage: existing template categorization logic + the parent prop configured earlier_
  - _Requirements: API design specification_

### 2.3 Import/Export Feature Migration

- [x] 2.3.1 Analyze the existing import/export capabilities of useContextEditor
  - File: packages/ui/src/composables/useContextEditor.ts
  - Confirm the smartImport/convertFromOpenAI/convertFromLangFuse/convertFromConversation methods
  - Confirm the importFromFile/exportToFile file operation methods
  - Understand the existing error handling and validation mechanisms
  - Purpose: Learn which existing import/export capabilities can be reused
  - _Leverage: existing implementation of the useContextEditor composable_
  - _Requirements: Requirement 4_

- [x] 2.3.2 Implement import/export in ContextEditor
  - File: packages/ui/src/components/ContextEditor.vue
  - Add import/export entries in the bottom action bar or a new area
  - Reuse the existing methods of useContextEditor: smartImport/convertFromOpenAI/convertFromLangFuse/convertFromConversation
  - Reuse importFromFile/exportToFile for file operations
  - Clarify priorities: support JSON/OpenAI/LangFuse/Conversation first; CSV/TXT are scheduled for later (they do not block the main flow)
  - Purpose: Migrate the import/export functionality to ContextEditor, reusing existing logic
  - _Leverage: existing implementation of the useContextEditor composable_
  - _Requirements: Requirement 4_

### 2.4 ContextEditor Data Sync Alignment

- [x] 2.4.1 Ensure real-time state synchronization of ContextEditor
  - File: packages/ui/src/components/ContextEditor.vue
  - Keep the sync pattern of "edit emits update:state → parent updates the shared ref → Manager reflects in real time"
  - Ensure ContextEditor emits the update:state event promptly
  - Verify the parent correctly receives it and updates optimizationContext
  - Verify ConversationManager sees the changes via v-model
  - Purpose: Perfect the data synchronization mechanism between the two components while keeping the existing architecture
  - _Leverage: existing parent state management mechanism_
  - _Requirements: Requirement 5_

### 2.5 ContextEditor Feature Tests

- [x] 2.5.1 Write tests for the new features
  - File: packages/ui/tests/unit/components/ContextEditor.spec.ts
  - Write test cases for the template management functionality
  - Write test cases for the import/export functionality (reusing the test patterns of useContextEditor)
  - Write tests for passing the optimizationMode parameter
  - Purpose: Ensure the stability of the migrated functionality
  - _Leverage: existing test tools and the useContextEditor tests as reference_
  - _Requirements: Requirement 4_

## Phase 3: Integration Verification and Optimization

### 3.1 Data Sync Integrity Verification

- [x] 3.1.1 Verify data synchronization between Manager and Editor
  - File: packages/ui/tests/integration/context-editor-sync.spec.ts
  - Test that changes made in ConversationManager are reflected in ContextEditor in real time
  - Test that changes made in ContextEditor are reflected in ConversationManager in real time
  - Test the effect of template application and import/export on data synchronization
  - Verify the complete chain of "edit emits → parent updates → reflected in real time"
  - Purpose: Verify the correctness of two-way data synchronization
  - _Leverage: existing parent state management and v-model mechanism_
  - _Requirements: Requirement 5_

### 3.2 Variable Management Collaboration Optimization

- [x] 3.2.1 Optimize cross-component collaboration in variable management
  - File: packages/ui/src/components/ConversationManager.vue & ContextEditor.vue
  - Ensure both components use consistent variable handling functions
  - Optimize the missing-variable hint and quick creation flow
  - Verify the correctness of event communication with the variable manager
  - Purpose: Perfect the user experience of variable management
  - _Leverage: existing variable management system_
  - _Requirements: Requirement 6_

### 3.3 Performance Optimization

- [-] 3.3.1 Optimize component rendering and data processing performance
  - File: related component files
  - Use shallowRef and the like to optimize rendering of large data
  - Add debouncing to avoid frequent updates
  - Optimize lazy loading of templates and import/export
  - Purpose: Ensure performance after the refactor
  - _Leverage: Vue 3 performance optimization techniques_
  - _Requirements: Performance considerations_

### 3.4 End-to-End Verification

- [x] 3.4.1 Complete user flow testing
  - File: packages/ui/tests/e2e/context-editor-refactor.spec.ts
  - Test the complete flow from lightweight management to deep editing
  - Test the user experience of template selection and application
  - Test import/export and format conversion (JSON/OpenAI/LangFuse/Conversation)
  - Test cross-component collaboration in variable management
  - Purpose: Verify the user experience of the whole refactored system
  - _Leverage: E2E testing tools_
  - _Requirements: All requirements_

## Phase 4: Deprecated Component Cleanup

### 4.1 Final Confirmation of Feature Completeness

- [x] 4.1.1 Compare and verify feature completeness
  - File: create a feature comparison verification checklist
  - Compare the feature completeness of the new system with the original backup component
  - Confirm there is no loss of functionality or degradation of experience
  - Record the verification results and any problems that need correction
  - Purpose: Ensure all functionality has been migrated correctly before cleanup
  - _Leverage: requirements document and original components_
  - _Requirements: All requirements_

### 4.2 Clean Up Deprecated Files and References

- [ ] 4.2.1 Delete ConversationMessageEditor.vue and ConversationSection.vue
  - File: packages/ui/src/components/ConversationMessageEditor.vue & ConversationSection.vue
  - Delete these two component files after confirming all functionality has been migrated
  - Delete the related unit test files
  - Purpose: Clean up the deprecated component files
  - _Leverage: version control system_
  - _Requirements: Requirement 1_

- [ ] 4.2.2 Update the component export configuration
  - File: packages/ui/src/index.ts
  - Remove ConversationMessageEditor and ConversationSection from the export list
  - Update the type export configuration
  - Purpose: Clean up the public API
  - _Leverage: existing export configuration_
  - _Requirements: Requirement 1_

### 4.3 Clean Up Tests and References

- [ ] 4.3.1 Clean up references to deprecated components in tests
  - File: related test files
  - Remove the mock of ConversationSection in tests
  - Fix any references to deprecated components
  - Purpose: Clean up deprecated references in the test environment
  - _Leverage: test framework_
  - _Requirements: Requirement 1_

- [ ] 4.3.2 Update invalid props and events in the Web App
  - File: packages/web/src/App.vue
  - Remove invalid props of ConversationManager (optimization-mode, compact-mode)
  - Remove invalid event bindings (@create-variable, etc.)
  - Purpose: Clean up deprecated API calls in the parent component
  - _Leverage: around packages/web/src/App.vue:155_
  - _Requirements: API cleanup_

### 4.4 Final Verification

- [ ] 4.4.1 Run the complete regression test
  - File: run the complete test suite
  - Run all unit tests and make sure 100% pass
  - Run integration tests and E2E tests
  - Fix any problems found
  - Purpose: Ensure the complete stability of the system after cleanup
  - _Leverage: complete test framework_
  - _Requirements: All requirements_

- [ ] 4.4.2 Update related documentation
  - File: related development documentation
  - Update the component usage documentation and remove descriptions of deprecated components
  - Update the API documentation to reflect the new interface design
  - Record refactoring lessons and best practices
  - Purpose: Keep documentation in sync with the code
  - _Leverage: existing documentation system_
  - _Requirements: Documentation maintenance_

## Key Checkpoints and Acceptance Criteria

### Phase 1 Completion Check
- [ ] The current state of ConversationManager is confirmed, with no unnecessary modifications
- [ ] Consistency between type definitions and default value implementations is resolved (optional types + withDefaults)
- [ ] maxHeight type is unified as number, and the px concatenation logic is correct
- [ ] Inline editing enhancements stay within lightweight boundaries (NInput.autosize first)
- [ ] Data binding follows Vue best practices

### Phase 2 Completion Check
- [ ] The optimizationMode parameter passing chain is established early
- [ ] The template management functionality is successfully migrated to ContextEditor, with complete integration testing
- [ ] The import/export functionality is fully migrated, reusing the existing capabilities of useContextEditor
- [ ] Priority formats (JSON/OpenAI/LangFuse/Conversation) are all supported
- [ ] The state synchronization mechanism of ContextEditor works normally

### Phase 3 Completion Check
- [ ] Two-way data synchronization between Manager and Editor works completely normally
- [ ] The cross-component collaboration experience in variable management is good
- [ ] System performance meets expectations
- [ ] All end-to-end user flow tests pass

### Phase 4 Completion Check
- [ ] Feature completeness verification passes with no loss of functionality
- [ ] Deprecated components and references are completely cleaned up
- [ ] All regression tests pass
- [ ] Related documentation updates are complete

## Engineering Optimization Points

### Type and Implementation Consistency Strategy
```typescript
// Recommended: optional types + withDefaults
interface Props {
  scanVariables?: (content: string) => string[]
}

const props = withDefaults(defineProps<Props>(), {
  scanVariables: () => []
})
```

### maxHeight Handling Strategy
```typescript
// Unified as the number type, with px appended inside the component
interface Props {
  maxHeight?: number  // rather than number | string
}

// Inside the component
const style = computed(() => ({
  maxHeight: props.maxHeight ? `${props.maxHeight}px` : undefined
}))
```

### Lightweight Boundary Control
```vue
<!-- Prefer NInput's built-in capabilities -->
<NInput 
  :autosize="{ minRows: 1, maxRows: 3 }" 
  @update:value="handleUpdate"
/>

<!-- Keep the missing-variable hint restrained -->
<NTag v-if="missingCount > 0" size="small" type="warning">
  Missing: {{ missingCount }}
</NTag>
```

### Task Sequencing Optimization
- 2.1.1 Configure the optimizationMode parameter passing early
- 2.2.2 Depends on the parameter from 2.1.1 for template integration testing
- Avoids the problem of an incomplete chain during development

These are all very pragmatic engineering optimization suggestions that avoid common problems such as type inconsistency, string concatenation errors and difficult integration testing.
