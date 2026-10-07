# Context Editor Refactor - Requirements Document

## Introduction

This specification defines the requirements for refactoring the context editor architecture around a division of labor of "lightweight management in the main panel + deep management in the full-screen editor". By analyzing the existing implementations of ConversationManager.vue.backup and ConversationMessageEditor.vue, it determines the core functionality that must be retained and reallocates it to the appropriate components.

Refactor goals:
1. Remove the ConversationMessageEditor and ConversationSection components
2. Simplify ConversationManager and keep the lightweight management features
3. Enhance ContextEditor to carry all complex features
4. Implement two-way bound data synchronization

## Alignment with the Product Vision

This refactor supports the core product vision of providing an intuitive AI prompt optimization tool:
- The main interface stays concise and focuses on the core workflow
- Complex features are concentrated in a dedicated interface, providing a complete experience
- Data is synchronized in real time, reducing operational complexity

## Feature Analysis and Allocation

### Features Learned from ConversationManager.vue.backup
**Existing features:**
- ✅ Compact header title and statistics
- ✅ Variable statistics (used/missing) and tool statistics
- ✅ Quick template dropdown menu
- ✅ Import/export functionality (with format support)
- ✅ Sync-to-test feature (requirement removed)
- ✅ Collapse/expand feature
- ✅ Uses ConversationMessageEditor for list display
- ✅ Integrated add-message feature

**To be reallocated:**
- Template feature → move to ContextEditor
- Import/export feature → move to ContextEditor
- Basic statistics and editing → keep in ConversationManager

### Features Learned from ConversationMessageEditor.vue
**Existing features:**
- ✅ Compact row-style layout
- ✅ Message header information (index, role, variable statistics)
- ✅ Preview toggle
- ✅ Move and delete operations
- ✅ Full-screen editing modal
- ✅ Dynamic row count calculation
- ✅ Variable detection and missing-variable hints
- ✅ Variable-highlighted preview

**To be integrated:**
- Basic editing features → integrate into ConversationManager inline editing
- Full-screen editing modal → remove (replaced by ContextEditor)
- Preview feature → move to ContextEditor

### Features ContextEditor Already Has
**Existing features:**
- ✅ Modal interface
- ✅ Tab architecture (message editing / tool management)
- ✅ Complete message editing features
- ✅ Variable preview and replacement
- ✅ Statistics display
- ✅ Accessibility support

**Missing but need to be added:**
- ❌ Import/export functionality
- ❌ Template selection and application

## Requirements

### Requirement 1: Remove Redundant Components

**User story:** As a developer, I want to remove redundant components so that the codebase is cleaner and easier to maintain.

#### Acceptance Criteria

1. When the refactor is complete, the system shall no longer include the ConversationMessageEditor component
2. When the refactor is complete, the system shall no longer include the ConversationSection component
3. When imports/exports are checked, the system shall no longer export these removed components
4. When usage is checked, all references to these components shall have been replaced

### Requirement 2: Lightweight ConversationManager Transformation

**User story:** As a user, I want the main panel to be concise and efficient, providing basic message management features.

#### Acceptance Criteria

1. When viewing the header area, ConversationManager shall display a compact title and statistics for message count, variable count and missing variable count
2. When there are messages, ConversationManager shall display a concise message list with roles and content previews
3. When editing a message, ConversationManager shall provide inline role selection and text input
4. When managing messages, ConversationManager shall support adding, deleting and reordering
5. When space is limited, ConversationManager shall support a collapse feature
6. When advanced features are needed, ConversationManager shall provide an "Open Editor" button

### Requirement 3: Remove Duplicated Complex Features

**User story:** As a user, I want complex features not to appear in the main panel, to avoid a cluttered interface.

#### Acceptance Criteria

1. When the refactor is complete, ConversationManager shall not contain the quick template dropdown menu
2. When the refactor is complete, ConversationManager shall not contain import/export buttons
3. When the refactor is complete, ConversationManager shall not contain the sync-to-test feature
4. When these features are needed, the user shall access them by opening ContextEditor

### Requirement 4: ContextEditor Feature Enhancement

**User story:** As a user, I want all complex context management features in ContextEditor.

#### Acceptance Criteria

1. When ContextEditor is opened, the system shall keep the existing tab architecture (message editing / tool management)
2. When templates are needed, ContextEditor shall provide complete template selection, preview and application features
3. When import/export is needed, ContextEditor shall provide import/export with multi-format support
4. When editing messages, ContextEditor shall provide complete editing, preview and variable highlighting features
5. When handling variables, ContextEditor shall integrate variable management features

### Requirement 5: Two-way Bound Data Synchronization

**User story:** As a user, I want data to be synchronized in real time between ConversationManager and ContextEditor without manual saving.

#### Acceptance Criteria

1. When a message is modified in ConversationManager and ContextEditor is open at the same time, the change shall be visible immediately
2. When a message is modified in ContextEditor, ConversationManager shall reflect the change immediately
3. When data is imported in ContextEditor, ConversationManager shall display the new data immediately
4. When ContextEditor is closed, no save confirmation shall be needed, as all changes have already taken effect in real time
5. When the components communicate, they shall do so through shared reactive data state rather than event passing

### Requirement 6: Variable Management Integration Optimization

**User story:** As a user, I want variable features to be divided sensibly between the two components.

#### Acceptance Criteria

1. When in ConversationManager, the system shall display variable statistics and missing-variable warnings
2. When a missing variable is clicked, ConversationManager shall emit the createVariable event
3. When deep variable management is needed, the user shall perform batch operations in ContextEditor
4. When variables are updated, both components shall automatically refresh the related statistics and display

### Requirement 7: Preserve Existing Mature Features

**User story:** As a user, I want the refactor not to lose existing mature features.

#### Acceptance Criteria

1. When viewing ContextEditor, the system shall keep the existing accessibility support
2. When using responsive features, the system shall keep the existing multi-device adaptation
3. When performing performance optimization, the system shall keep the existing rendering performance
4. When handling user interaction, the system shall keep the existing keyboard navigation and shortcut support

## Technical Implementation Points

### ConversationManager Simplification Focus
- Remove the UI elements for templates, import/export and sync features
- Keep the statistics display and basic message management
- Integrate the basic editing functionality of ConversationMessageEditor into inline editing
- Keep navigation features such as collapse and opening the advanced editor

### ContextEditor Enhancement Focus  
- Add the template selection feature ported from ConversationManager.backup
- Add the import/export feature ported from ConversationManager.backup
- Keep the existing tab architecture and editing features
- Ensure two-way data binding with ConversationManager

### Data Binding Architecture
- Use Vue's reactivity system to implement shared state
- Both components operate on the same data source
- Implement two-way synchronization through v-model and computed
- Avoid complex event passing and data copying

## Component API Design

### ConversationManager Props
```typescript
interface ConversationManagerProps {
  // Two-way binding data
  messages: ConversationMessage[]
  availableVariables?: Record<string, string>
  
  // Functional functions
  scanVariables?: (content: string) => string[]
  
  // UI control
  size?: 'small' | 'medium' | 'large'
  collapsible?: boolean
  readonly?: boolean
  title?: string
}
```

### ConversationManager Emits  
```typescript
interface ConversationManagerEmits {
  'update:messages': [messages: ConversationMessage[]]
  'openContextEditor': []
  'createVariable': [name: string]
  'openVariableManager': [variableName?: string]
}
```

### ContextEditor Enhanced Features
- Keep the existing Props and Emits structure
- Add template management related methods
- Add import/export related methods
- Ensure data binding with ConversationManager

## Non-functional Requirements

### Code Quality
- Clear division of component responsibilities
- Minimize dependencies between components
- Maintain existing code quality standards

### Performance Requirements
- Maintain existing rendering performance
- Use performance optimizations of the Vue reactivity system
- Avoid unnecessary re-rendering

### User Experience
- Maintain the existing interaction experience
- Data synchronization should be timely and natural
- Interface switching should be smooth

### Compatibility
- Maintain existing browser compatibility
- Maintain existing accessibility support
- Maintain existing responsive design
