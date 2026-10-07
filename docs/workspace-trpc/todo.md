# To-Do List

Manage current and future development tasks.

## 🔥 Urgent Tasks

### Must Be Completed This Week
- [ ] [Task description] - [Deadline] - [Owner]
- [ ] [Task description] - [Deadline] - [Owner]

### Today's Focus
- [ ] [Task description] - [Estimated time]
- [ ] [Task description] - [Estimated time]

## ⭐ Important Tasks

### Feature Development
- [ ] [Feature name] - [Priority] - [Estimated duration]
- [ ] [Feature name] - [Priority] - [Estimated duration]

### Technical Debt
- [ ] [Technical debt description] - [Impact level] - [Estimated duration]
- [ ] [Technical debt description] - [Impact level] - [Estimated duration]
- [ ] **Refactor the UI-layer state persistence architecture** - Scope: desktop; UI preferences currently cannot be saved - Estimated duration: 3 days
  - **Goal**: Replace the UI layer's direct dependency on `useStorage` with a dependency on a higher-level `PreferenceService`.
  - **Implementation**:
    - 1. Create `PreferenceService` and its interface.
    - 2. On the web, the service uses `useStorage` internally.
    - 3. On Electron, create `ElectronPreferenceServiceProxy`, which communicates with the main process over IPC; the main process is responsible for reading and writing the JSON config file.
    - 4. Replace all calls to `useStorage` in modules such as `useTemplateManager`, `ThemeToggleUI`, and `LanguageSwitch` with calls to the new service.

### Documentation Updates
- [ ] [Document name] - [Update content] - [Estimated time]
- [ ] [Document name] - [Update content] - [Estimated time]

## 📋 General Tasks

### Optimization and Improvements
- [ ] [Optimization item] - [Expected effect]
- [ ] [Optimization item] - [Expected effect]

### Learning and Research
- [ ] [Learning content] - [Learning goal]
- [ ] [Learning content] - [Learning goal]

### Tool Configuration
- [ ] [Tool name] - [Configuration goal]
- [ ] [Tool name] - [Configuration goal]

## ✅ Completed

### Completed This Week
- [x] [Task description] - [Completion date] - [Notes]
- [x] [Task description] - [Completion date] - [Notes]

## 🗓️ Future Plans

### Next Week's Plan
- [Plan content] - [Expected goal]
- [Plan content] - [Expected goal]

### This Month's Goals
- [Monthly goal] - [Key milestone]
- [Monthly goal] - [Key milestone]

---

## 📝 Usage Instructions

1. **Priority management** - Categorize tasks by urgency
2. **Time estimation** - Estimate the time required for each task
3. **Regular updates** - Update progress daily and review and adjust weekly
4. **Completion marking** - Mark completed tasks promptly and record notes
