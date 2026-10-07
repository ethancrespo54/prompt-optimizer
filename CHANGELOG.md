# Changelog

## [2.1.0] - 2025-01-19

### 🎉 Added - Favorite Management Refactor

#### 🏗️ Core Architecture Improvements
- **Three-level classification system**:
  - `functionMode`: `basic | context | image` (required)
  - `optimizationMode`: `system | user` (basic mode)
  - `imageSubMode`: `text2image | image2image` (image mode)
  - **Category**: Topic categories (learning and research, daily assistant, etc.)
- **Metadata reorganization**: `originalContent` and `sourceHistoryId` moved into the `metadata` object
- **TypeMapper utility class**: Automatically infers the function mode from the history record type

#### 🏷️ Independent Tag Library System
- **Full tag lifecycle management**: Rename, merge, delete, statistics
- **Smart tag autocomplete**: Suggestions sorted by usage frequency
- **Independent tag storage**: Supports tags with zero usage

#### 📁 Category Management Enhancements
- **Category ordering**: Supports moving up/down to adjust order
- **Usage statistics**: Counts the favorites in each category
- **Deletion protection**: Categories that contain favorites cannot be deleted
- **Color labels**: Supports custom category colors

#### 🎨 UI Component Refactor
- **SaveFavoriteDialog**: Unified create/edit dialog with function mode selection
- **TagManager**: Complete tag management interface
- **CategoryManager**: Category management interface with color selection and ordering
- **Tag autocomplete**: `useTagSuggestions` + `NAutoComplete` integration

#### 🔄 Backward Compatibility
- **Data migration**: Automatically detects and migrates old data
- **Progressive migration**: Existing categories are preserved; migration is not forced

### 💔 Breaking Changes
- **Removed the `isPublic` field**: A public flag is meaningless in a standalone application
- **`FavoritePrompt` interface change**: `functionMode` is now required, and the `metadata` structure was reorganized

### 📝 Migration Guide
The system automatically detects old data and migrates it. All existing favorites remain unchanged and backward compatible.

### 🐛 Bug Fixes
- Fixed import/export data integrity issues
- Fixed inaccurate tag counts
- Fixed an E2E test issue where the overlay intercepted clicks

---

## [2.0.0] - 2025-01-XX

### 🎉 Initial Release
- Basic favorite management features
- Optimization history integration
- Basic tag and category support
- Import/export functionality