# Technical Implementation Details

## 🔧 Architecture Design

### Core Design Philosophy

#### From Centralized to Distributed
**Problems with the original architecture**:
- DataManager took on too many responsibilities (coordination + concrete implementation)
- Adding a new service required modifying DataManager code
- Violated the Single Responsibility Principle and the Open/Closed Principle

**New architecture design**:
```typescript
// Unified interface definition
export interface IImportExportable {
  exportData(): Promise<any>;
  importData(data: any): Promise<void>;
  getDataType(): Promise<string>;
  validateData(data: any): Promise<boolean>;
}

// DataManager is only responsible for coordination
class DataManager {
  async exportAllData(): Promise<string> {
    const services = [modelManager, templateManager, historyManager, preferenceService];
    const data = {};
    
    for (const service of services) {
      const dataType = await service.getDataType();
      data[dataType] = await service.exportData();
    }
    
    return JSON.stringify({ version: 1, exportTime: new Date().toISOString(), data });
  }
}
```

#### Solution to the Dual-purpose Storage Key
**Problem identification**:
- Physical storage key: the key name used by actual storage operations
- Logical JSON key: the key name in imported/exported JSON
- PreferenceService adds a 'pref:' prefix, which caused lookups to fail

**Solution**:
```typescript
// PreferenceService handles prefix conversion internally
class PreferenceService {
  private readonly PREFIX = 'pref:';
  
  async exportData(): Promise<any> {
    const allData = await this.getAll();
    const exportData = {};
    
    // Strip the prefix and export using the logical key name
    for (const [key, value] of Object.entries(allData)) {
      const logicalKey = key.startsWith(this.PREFIX) ? key.slice(this.PREFIX.length) : key;
      exportData[logicalKey] = value;
    }
    
    return exportData;
  }
}
```

### Interface Design Principles

#### Async First
All interface methods are designed to be asynchronous, supporting:
- Network requests (Electron IPC)
- File operations (FileStorageProvider)
- Data validation (complex validation logic)

#### Unified Error Handling
```typescript
export class ImportExportError extends Error {
  constructor(
    message: string,
    public readonly dataType?: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ImportExportError';
  }
}
```

## 🐛 Problem Diagnosis and Resolution

### Problem 1: Incomplete Data Export
**Symptom**: The JSON exported by users had only 4 settings instead of 8

**Diagnosis process**:
1. Checked the DataManager export logic → found it calls PreferenceService.getAll()
2. Checked the PreferenceService implementation → found it adds a 'pref:' prefix
3. Checked the storage key definitions → found they were duplicated in the UI and Core packages
4. Analyzed how the storage keys are used → found the dual purpose of physical storage vs logical JSON

**Solution**:
- Handle prefix conversion inside PreferenceService
- Unify storage key definitions in the Core package
- Explicitly document the dual purpose of storage keys

### Problem 2: Circular Dependency
**Symptom**: Compilation errors from circular references between modules

**Solution**:
- Create a standalone interfaces/import-export.ts file
- Separate interface definitions from concrete implementations
- Use dependency injection instead of direct references

### Problem 3: Electron IPC Serialization
**Symptom**: Vue reactive objects cannot be transferred over IPC

**Solution**:
```typescript
// Serialize in the proxy class
async exportData(): Promise<any> {
  const result = await window.electronAPI.modelManager.exportData();
  return JSON.parse(JSON.stringify(result)); // deep serialization
}
```

## 📝 Implementation Steps

### Phase 1: Interface Design
1. Create the IImportExportable interface definition
2. Design the ImportExportError error class
3. Define a unified data format specification

### Phase 2: Service Refactoring
1. **ModelManager**: implement import/export of model data
2. **TemplateManager**: implement import/export of template data
3. **HistoryManager**: implement import/export of history records
4. **PreferenceService**: implement import/export of user settings

### Phase 3: DataManager Refactoring
1. Remove the concrete implementation logic (-308 lines of code)
2. Switch to a coordinator pattern that calls each service's interface
3. Keep the external API unchanged

### Phase 4: Electron Updates
1. Update the main.js IPC handling logic
2. Update the preload.js API exposure
3. Update all service proxy classes

### Phase 5: Test Completion
1. Create import-export tests for each service
2. Create integration tests to verify the overall flow
3. Build an AI automated testing framework

## 🔍 Debugging Process

### Debugging the Storage Key Problem
```bash
# 1. Check the exported data
console.log(await dataManager.exportAllData());

# 2. Check the PreferenceService data
console.log(await preferenceService.getAll());

# 3. Check the storage layer data
console.log(await storageProvider.getAll());

# 4. Compare logical key names with physical key names
```

### Interface Implementation Verification
```typescript
// Verify that all services implement the interface
const services = [modelManager, templateManager, historyManager, preferenceService];
for (const service of services) {
  console.assert(typeof service.exportData === 'function');
  console.assert(typeof service.importData === 'function');
  console.assert(typeof service.getDataType === 'function');
  console.assert(typeof service.validateData === 'function');
}
```

## 🧪 Test Verification

### Unit Tests
Each service's import-export.test.ts file contains:
- Export functionality tests
- Import functionality tests
- Data validation tests
- Error handling tests

### Integration Tests
data/import-export-integration.test.ts verifies:
- The complete import/export flow
- Coordinated work across multiple services
- Data consistency checks

### MCP Browser Tests
Automated testing with Playwright:
- Export button functionality
- File download verification
- Import file upload
- Data application verification
- User interface interaction

### AI Automated Testing Framework
Creates the storage-key-consistency test suite:
- test-001: data export completeness verification
- test-002: compatibility when importing data from older versions
- test-003: code consistency check

## 🔄 Architecture Evolution

### Architecture Before the Refactor
```
DataManager (375 lines)
├── Coordinates the services
├── Implements concrete import/export logic
├── Handles data format conversion
└── Error handling and validation
```

### Architecture After the Refactor
```
DataManager (67 lines) - coordination only
├── ModelManager.exportData()
├── TemplateManager.exportData()
├── HistoryManager.exportData()
└── PreferenceService.exportData()

IImportExportable interface
├── Unified method signatures
├── Async operation support
└── Error handling conventions
```

### Key Improvements
1. **Leaner code**: DataManager's code shrank by 82%
2. **Separation of responsibilities**: each service manages its own import/export
3. **Extensibility**: a new service only needs to implement the interface
4. **Maintainability**: changing one service does not affect the others
5. **Testability**: each service can be tested independently

## 📈 Performance Impact

### Positive Impact
- **Execution efficiency**: removes unnecessary intermediate processing layers
- **Memory usage**: avoids aggregating large amounts of data in DataManager
- **Concurrency**: services can process import/export in parallel

### Caveats
- **IPC calls**: the number of IPC calls increases in the Electron environment
- **Serialization overhead**: Vue reactive objects require JSON serialization

## 🔮 Future Extensions

### Onboarding New Services
Just implement the IImportExportable interface:
```typescript
class NewService implements IImportExportable {
  async exportData(): Promise<any> { /* implementation */ }
  async importData(data: any): Promise<void> { /* implementation */ }
  async getDataType(): Promise<string> { return 'newServiceData'; }
  async validateData(data: any): Promise<boolean> { /* implementation */ }
}
```

### Feature Enhancements
- Incremental import/export
- Data compression
- Encryption support
- Version migration
