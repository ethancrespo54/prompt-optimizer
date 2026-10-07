# Development Scratchpad

Records the progress and thinking on the current development task.

## Current Task

### [Task name] - [Start date]
**Goal**: [Description of the specific goal]
**Status**: In progress

#### Planned Steps
[ ] 1. Requirements analysis
[ ] 2. Technical design  
[ ] 3. Implementation
[ ] 4. Testing and verification
[ ] 5. Documentation update

#### Progress Log
- [Date] [Description of specific progress]
- [Date] [Problems encountered and solutions]

#### Key Findings
- [Record important technical findings or lessons]

---

## Past Tasks

### [Completed task name] - [Completion date] ✅
**Summary**: [Brief summary]
**Lessons**: [Key lessons extracted]

---

## To-dos

### Urgent
- [ ] [Urgent task 1]
- [ ] [Urgent task 2]

### Important
- [ ] [Important task 1]
- [ ] [Important task 2]

### General
- [ ] [General task 1]
- [ ] [General task 2]

---

## Issue Log

### Unresolved
- [Issue description] - [Date found]

### Resolved
- [Issue description] - [Solution] - [Date resolved]

---

## Notes
[Other information to record]

## Task: Core Service Interface Isolation Refactoring - 2025-07-03

### Goal
Check, item by item, the references from the `ui` module to the `core` module, and ensure that all calls go through interfaces (such as `IModelManager`) rather than concrete implementation classes (such as `ModelManager`). Unify the calling conventions of the Web and Desktop versions, and fix the resulting IPC communication chain problems.

### Planned Steps
*See `todo.md`*

### Progress Log
- **2025-07-03**: **Milestone completed: core manager refactoring**
  - **Result**: Successfully refactored `ModelManager` and `HistoryManager`. By creating adapters in `useAppInitializer.ts`, the UI layer is forced to call only through interfaces.
  - **Finding**: The "shortcut" that makes the Web app work (calling instances directly) is the root cause of the failures in the Desktop version (multi-process IPC). Architecturally, implementation details must be hidden at the initialization source.
  - **Status**: Updated `IModelManager`, `IHistoryManager`, and their corresponding implementations, proxies, and IPC chains.

### Issue Log
*None yet*

### Milestones
- [x] Refactor ModelManager
- [x] Refactor HistoryManager
- [ ] Refactor TemplateManager
- [ ] Refactor LLMService
- [ ] Refactor PromptService
- [ ] Refactor other services
- [ ] Complete final testing
