# Favorites Management Guide

## 📚 Favorites Management Overview

Favorites management is a core feature of Prompt Optimizer that helps you save, organize, and manage optimized prompts. After a refactor, favorites management offers a more powerful category and tag system.

## 🏷️ Three-Level Classification

### 1. Function Mode - Level 1
- **Basic Mode (Basic)**: Standard prompt optimization
- **Context Mode (Context)**: Optimization that requires context information
- **Image Mode (Image)**: Image-related prompt optimization

### 2. Optimization Mode - Level 2 (Basic Mode)
- **System Optimization (System)**: Automatic optimization by the system
- **User Optimization (User)**: User-defined optimization

### 3. Image Sub Mode - Level 2 (Image Mode)
- **Text to Image**: Generate images from text
- **Image to Image**: Generate new images based on an image

### 4. Category - Topic Classification
- Study & Research
- Daily Assistant
- Work Productivity
- Creative Writing
- Programming & Development
- Custom Categories

## 🎯 Usage Guide

### Creating a Favorite

#### Method 1: Create from Optimization History
1. After optimizing a prompt, click the **Favorite** button
2. The system automatically infers the function mode and related settings
3. Fill in the title and tags
4. Choose a category
5. Click **Save**

#### Method 2: Create a Favorite Manually
1. Click the **Favorites Management** button
2. Click the **Create Favorite** button
3. Choose a function mode:
   - Basic mode: choose an optimization mode
   - Image mode: choose an image sub mode
4. Fill in the prompt content
5. Add tags (autocomplete supported)
6. Choose a category
7. Click **Save**

### Tag Management

#### Tag Autocomplete
- Type text in the tag input box
- The system shows matching tag suggestions
- Frequently used tags are shown first
- Press Enter or click a suggestion to add the tag

#### Tag Manager
1. In the favorites manager, click **Tag Management**
2. **View tags**: the list shows all tags and their usage counts
3. **Rename a tag**: click the rename button to update all related favorites in bulk
4. **Merge tags**: merge multiple tags into one, with automatic deduplication
5. **Delete a tag**: remove the specified tag from all favorites
6. **Search tags**: use the search box to quickly find the target tag

### Category Management

#### Category Manager
1. In the favorites manager, click **Category Management**
2. **Create a category**:
   - Click **Add Category**
   - Enter the category name
   - Choose a color label
   - Add a description (optional)
3. **Edit a category**: change the category name, color, or description
4. **Reorder categories**: use the move up/move down buttons to adjust the order
5. **Delete a category**:
   - The system checks whether any favorites use the category
   - Categories that contain favorites cannot be deleted, to prevent data loss

### Search and Filtering

#### Search
- **Keyword search**: enter keywords in the search box to search titles and content
- **Live search**: results appear instantly as you type
- **Search highlighting**: matching text is highlighted

#### Filtering
- **Filter by category**: select a specific category from the dropdown
- **Filter by tag**: select tags to filter by
- **Combined filtering**: category and tag filters can be used together
- **Clear filters**: click the clear button to reset all filters

### Import and Export

#### Exporting Favorites
1. In the favorites manager, click the **More Menu**
2. Select the **Export** option
3. The system downloads a JSON file containing all favorites, tags, and categories
4. The exported data includes:
   - Favorite content
   - Tag information
   - Category settings
   - Usage statistics

#### Importing Favorites
1. In the favorites manager, click the **More Menu**
2. Select the **Import** option
3. Choose the JSON file to import
4. The system will:
   - Handle ID conflicts automatically
   - Import tags and categories
   - Migrate old data formats
   - Show import result statistics

## 🔧 Advanced Features

### Independent Tag Library
- Tags can exist independently of favorites
- Tags can be pre-created in preparation for future favorites
- Tags with zero usage are preserved on import

### Data Migration
- The system automatically detects data from older versions
- Missing function mode fields are added automatically
- Backward compatibility is maintained

### Performance Optimization
- Fast search across large numbers of favorites (1000+)
- Smart caching of statistics
- Batch operations are guaranteed to be atomic

## 📱 Shortcuts

### Favorites Manager Shortcuts
- **Ctrl/Cmd + F**: Focus the search box
- **Ctrl/Cmd + N**: Create a new favorite
- **Escape**: Close the dialog

### Tag Input Shortcuts
- **Enter**: Add the tag currently being typed
- **Tab**: Move to the next input box
- **↑/↓**: Navigate the autocomplete suggestions

## 🎨 Interface Features

### Responsive Design
- Adapts to different screen sizes
- Touch-friendly interactions on mobile
- Adaptive layout

### Theme Support
- Supports light/dark themes
- Automatically follows the system theme setting
- Custom color configuration

### Accessibility
- Full keyboard navigation support
- Screen reader compatible
- High contrast mode

## ⚠️ Notes

### Data Backup
- Export your favorites periodically as a backup
- For important data, keep multiple copies
- Use cloud storage to sync backup files

### Performance Tips
- When you have more than 500 favorites, use search and filtering
- Periodically clean up tags and categories you no longer need
- Avoid creating too many duplicate tags

### Compatibility
- Automatic upgrade from older versions is supported
- Imported data in old formats is converted automatically
- Data is fully compatible across platforms

## 🆘 FAQ

**Q: Why can't I delete my tag?**
A: If the tag is in use by favorites, remove it from all favorites first, or use the delete function in the tag manager.

**Q: What happens when I import data?**
A: The system automatically handles ID conflicts, keeps existing data, imports the new data, and merges tags and categories.

**Q: How do I edit multiple favorites in bulk?**
A: Bulk tag operations (rename, merge, delete) are currently supported through the tag manager.

**Q: Is there a limit on the number of favorites?**
A: In theory there is no limit, but we recommend staying under 1000 for the best performance.

## 📞 Technical Support

If you run into problems while using the app, please:
1. Check the relevant sections of this guide
2. Check whether you have a data backup
3. Restart the app to try to resolve the issue
4. Contact the technical support team
