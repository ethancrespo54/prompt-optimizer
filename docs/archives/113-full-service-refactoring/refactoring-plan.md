# To-do List

## 🎯 Core Task: Core Service Interface Isolation Refactoring

### Priority: High

- **Goal**: Ensure the UI layer interacts with core services entirely through interfaces, unifying the Web and Desktop architectures.
- **Deadline**: TBD

---

### ✅ Completed

1.  **Refactor `ModelManager`**
    - [x] Create `modelManagerAdapter` in `useAppInitializer`
    - [x] Complete the `IModelManager` interface
    - [x] Add `isInitialized` and `getModelOptions` to the `ModelManager` implementation
    - [x] Update `ElectronModelManagerProxy`
    - [x] Update `preload.js`
    - [x] Update `main.js`

2.  **Refactor `HistoryManager`**
    - [x] Create `historyManagerAdapter` in `useAppInitializer`
    - [x] Complete the `IHistoryManager` interface (correct `addIteration`, add `deleteChain`)
    - [x] Add `deleteChain` to the `HistoryManager` implementation
    - [x] Update `ElectronHistoryManagerProxy`
    - [x] Update `preload.js`
    - [x] Update `main.js`

---

### 📋 Pending

3.  **Refactor `TemplateManager`**
    - [ ] Create `templateManagerAdapter` in `useAppInitializer`
    - [ ] Based on compile errors, check and complete the `ITemplateManager` interface
    - [ ] Update `ElectronTemplateManagerProxy` for the newly added interface methods
    - [ ] Update `preload.js` for the newly added interface methods
    - [ ] Update `main.js` for the newly added interface methods

4.  **Refactor `LLMService`**
    - [ ] Create `llmServiceAdapter` in `useAppInitializer`
    - [ ] Complete the `ILLMService` interface
    - [ ] Update `ElectronLLMProxy`
    - [ ] Update `preload.js`
    - [ ] Update `main.js`

5.  **Refactor `PromptService`**
    - [ ] Create `promptServiceAdapter` in `useAppInitializer`
    - [ ] Complete the `IPromptService` interface
    - [ ] Update `ElectronPromptServiceProxy`
    - [ ] Update `preload.js`
    - [ ] Update `main.js`

6.  **Final verification**
    - [ ] Run the complete unit and integration tests
    - [ ] Start the Web and Desktop apps separately and manually test all core features

---

### 📝 Notes
- Refactoring `DataManager` and `PreferenceService` will be done as needed; for now it appears they may not be necessary.

## 🔥 Urgent Tasks

### Must finish this week
- [ ] [Task description] - [Deadline] - [Owner]
- [ ] [Task description] - [Deadline] - [Owner]

### Today's focus
- [ ] [Task description] - [Estimated time]
- [ ] [Task description] - [Estimated time]

## ⭐ Important Tasks

### Feature development
- [ ] [Feature name] - [Priority] - [Estimated duration]
- [ ] [Feature name] - [Priority] - [Estimated duration]

### Technical debt
- [ ] [Technical debt description] - [Impact level] - [Estimated duration]
- [ ] [Technical debt description] - [Impact level] - [Estimated duration]

### Documentation updates
- [ ] [Document name] - [Update content] - [Estimated time]
- [ ] [Document name] - [Update content] - [Estimated time]

## 📋 General Tasks

### Optimization and improvement
- [ ] [Optimization item] - [Expected effect]
- [ ] [Optimization item] - [Expected effect]

### Learning and research
- [ ] [Learning topic] - [Learning goal]
- [ ] [Learning topic] - [Learning goal]

### Tool configuration
- [ ] [Tool name] - [Configuration goal]
- [ ] [Tool name] - [Configuration goal]

## ✅ Completed

### Completed this week
- [x] [Task description] - [Completion date] - [Notes]
- [x] [Task description] - [Completion date] - [Notes]

## 🗓️ Future Plans

### Next week's plan
- [Plan content] - [Expected goal]
- [Plan content] - [Expected goal]

### This month's goals
- [Monthly goal] - [Key milestone]
- [Monthly goal] - [Key milestone]

---

## 📝 Usage Notes

1. **Priority management** - Categorize tasks by urgency
2. **Time estimation** - Estimate the time required for each task
3. **Regular updates** - Update progress daily and review and adjust weekly
4. **Completion marking** - Mark completed tasks promptly and record notes
