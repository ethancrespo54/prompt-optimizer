# Development Process Archive

This directory archives, by feature, refactor records, design documents, lessons learned, and more from the development of the project, for later tracking and troubleshooting.

## 📚 Archive Notes

### Numbering convention
- **Starting number**: 101
- **Numbering method**: Simple increment (101, 102, 103...)
- **Number retention**: Numbers are never reused, even if a feature is deprecated

### Archiving principles
- **Archive by feature**: All documents related to the same feature are kept together
- **Complete context**: Includes the full record of plans, designs, implementation, lessons, etc.
- **Chronological order**: The numbering reflects the chronological order of development

## 🗂️ Feature List

### Architecture refactor series (completed)
- [101-singleton-refactor](./101-singleton-refactor/) - Singleton pattern refactor ✅
- [102-web-architecture-refactor](./102-web-architecture-refactor/) - Web architecture refactor ✅
- [103-desktop-architecture](./103-desktop-architecture/) - Desktop architecture ✅

### Feature development series
- [104-test-panel-refactor](./104-test-panel-refactor/) - Test panel refactor 📋
- [105-output-display-v2](./105-output-display-v2/) - Output display v2 📋
- [106-template-management](./106-template-management/) - Template management feature 🔄
- [107-component-standardization](./107-component-standardization/) - Component standardization refactor 🔄

### System optimization series (completed)
- [108-layout-system](./108-layout-system/) - Layout system lessons learned ✅
- [109-theme-system](./109-theme-system/) - Theme system development ✅

### Bug fix series (completed)
- [110-desktop-indexeddb-fix](./110-desktop-indexeddb-fix/) - Desktop IndexedDB problem fix ✅
- [111-electron-preference-architecture](./111-electron-preference-architecture/) - Electron PreferenceService architecture refactor and race condition fix ✅
- [112-desktop-ipc-fixes](./112-desktop-ipc-fixes/) - Collection of desktop IPC fixes ✅

### Service refactor series
- [113-full-service-refactoring](./113-full-service-refactoring/) - Full service refactor 🔄

### Data architecture series (completed)
- [114-desktop-file-storage](./114-desktop-file-storage/) - Desktop file storage implementation ✅
- [115-ipc-serialization-fixes](./115-ipc-serialization-fixes/) - IPC serialization problem fixes ✅
- [116-desktop-packaging-optimization](./116-desktop-packaging-optimization/) - Desktop packaging optimization ✅
- [117-import-export-architecture-refactor](./117-import-export-architecture-refactor/) - Import/export architecture refactor ✅

### System integration series (completed)
- [118-desktop-auto-update-system](./118-desktop-auto-update-system/) - Desktop application release and smart update system ✅
- [119-csp-safe-template-processing](./119-csp-safe-template-processing/) - CSP-safe template processing ✅
- [120-mcp-server-module](./120-mcp-server-module/) - MCP Server module development ✅

### Feature extension series (completed)
- [121-multi-custom-models-support](./121-multi-custom-models-support/) - Multi-custom-model environment variable support ✅
- [122-docker-api-proxy](./122-docker-api-proxy/) - Docker API proxy feature implementation ✅
- [123-advanced-features-implementation](./123-advanced-features-implementation/) - Full implementation of advanced features ✅

### UI optimization series (completed)
- [124-navigation-optimization](./124-navigation-optimization/) - Navigation bar optimization project ✅

### State management series (completed)
- [126-submode-persistence](./126-submode-persistence/) - Submode persistence feature ✅

### Context mode series (completed)
- [127-multi-turn-dialogue-mode-optimization](./127-multi-turn-dialogue-mode-optimization/) - Multi-turn dialogue mode optimization (Pro-System / Conversation) ✅
- [128-context-ui-and-variable-system-refactor](./128-context-ui-and-variable-system-refactor/) - Context UI rework and variable system refactor ✅

## 📋 Document Structure

Each feature directory contains:
- **README.md** - Feature overview, timeline, status
- **Core documents** (depending on the situation):
  - `plan.md` - Plan document
  - `design.md` - Design document
  - `implementation.md` - Implementation record
  - `experience.md` - Lessons learned
  - `troubleshooting.md` - Troubleshooting checklist

## 🔍 Lookup Guide

### Look up by time
- **101-103**: Architecture refactor in late December 2024
- **104-107**: Feature development from late December 2024 to July 2025
- **108-109**: System optimization in July 2025
- **110-113**: Fixes and refactors from January to July 2025

### Look up by feature category
- **Architecture refactor series**: 101, 102, 103
- **Feature development series**: 104, 105, 106, 107
- **System optimization series**: 108, 109
- **Bug fix series**: 110, 111, 112
- **Service refactor series**: 113
- **UI optimization series**: 124
- **State management series**: 126
- **Context mode series**: 127
- **Context mode series**: 127, 128

### Look up by status
- **Completed**: 101, 102, 103, 108, 109, 110, 111, 112, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 126, 127, 128
- **In progress**: 106, 107, 113
- **Planned**: 104, 105

## 📝 Usage Instructions

1. **Find a related feature**: Locate the corresponding directory by feature name or number
2. **Understand the background**: Read the README.md first for a feature overview
3. **Dive into the details**: Look at the specific plan, design, or lessons-learned documents as needed
4. **Troubleshooting**: If you have a related problem, see troubleshooting.md

## 🔄 Maintenance Notes

- **Archiving new features**: Continue numbering from 125
- **Document updates**: Update the status and lessons learned promptly once a feature is completed
- **Cross-references**: Establish references between related features
- **Merging principle**: Consider merging when a feature area has more than 3 related documents
- **Quality standard**: Empty directories or documents with insufficient content should be merged or deleted

## 📋 Organization Guidelines

### Archiving standards
1. **Feature completeness**: Each feature includes a complete plan → design → implementation → lessons chain
2. **Avoid duplicate numbering**: Assign numbers strictly in chronological order, never reusing them
3. **Content quality**: Ensure the documents have substantial content and real value

### Document structure convention
```
{number}-{feature-name}/
├── README.md (feature overview, timeline, status)
├── plan.md (plan document, optional)
├── design.md (design document, optional)
├── implementation.md (implementation record, optional)
├── experience.md (lessons learned, required)
└── troubleshooting.md (troubleshooting checklist, optional)
```

## 📊 Statistics

- **Total archives**: 25
- **Completed**: 20
- **In progress**: 3
- **Planned**: 2
- **Next number**: 127
