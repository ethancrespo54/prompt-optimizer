# UI Library Migration Project - Functional Design Document

**Document version**: v1.0  
**Created**: 2025-01-01  
**Last updated**: 2025-01-01  
**Design owner**: Development team

## 🎯 Design Overview

### Design Goals
Build a modern component system based on Naive UI that preserves the completeness of existing functionality while greatly improving visual appeal and code maintainability.

### Core Principles
1. **Incremental migration**: replace in phases to keep the system stable
2. **Functional parity**: the new components fully cover the existing functionality
3. **Experience optimization**: improve interaction fluidity and visual appeal
4. **Code simplification**: reduce custom CSS and improve maintainability

## 🗺️ Component Migration Mapping

### Element Plus Component Replacement

| Existing component | Target component | File location | Migration complexity |
|----------|----------|----------|------------|
| `el-button` | `n-button` | BasicTestMode.vue, TestPanel.vue | Simple |
| `el-input` | `n-input` | ModelManager.vue, InputPanel.vue | Simple |
| `el-select` | `n-select` | ModelManager.vue | Medium |
| `el-dialog` | `n-modal` | UpdaterModal.vue | Medium |
| `el-form` | `n-form` | ModelManager.vue | Complex |

### Custom Theme Component Replacement

#### Basic Component Classes
| Existing class name | Target component | Usage frequency | Migration strategy |
|----------|----------|----------|----------|
| `theme-button-*` | `n-button` + custom theme | High | Unified API, keep variants |
| `theme-input` | `n-input` + theme variables | High | CSS variable mapping |
| `theme-card` | `n-card` + custom styles | High | Keep the existing layout |
| `theme-modal` | `n-modal` + theme configuration | Medium | API adaptation |

#### Management Interface Component Classes
| Existing class name | Target approach | Optimization suggestion |
|----------|----------|----------|
| `theme-manager-*` | Simplify into generic components | Reduce scenario-specific classes |
| `theme-dropdown-*` | `n-dropdown` + theme | Unified dropdown component |
| `theme-history-*` | `n-card` + `n-list` | Composition-based design |

## 🎨 Theme System Design

### Theme Architecture Refactor

#### Problems with the Current Theme System
- Every theme repeats a large number of CSS rules
- The theme.css file is 2600+ lines and hard to maintain
- Lacks a unified design token concept

#### New Theme System Design
```typescript
// Theme configuration interface
interface ThemeConfig {
  common: CommonTheme;
  light: LightTheme;
  dark: DarkTheme;
  blue: BlueTheme;
  green: GreenTheme;
  purple: PurpleTheme;
}

// Design token structure
interface DesignTokens {
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    border: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  typography: {
    fontSize: Record<string, string>;
    fontWeight: Record<string, number>;
  };
}
```

### Preserving Theme Variants

#### Design Plan for the 5 Themes
1. **Light Theme (default)**
   - Base palette: stone tones (#f5f5f4, #78716c)
   - Design style: clean and bright, suited to daytime use
   
2. **Dark Theme**
   - Base palette: slate tones (#0f172a, #64748b)
   - Design style: dark background, easy on the eyes

3. **Blue Theme**  
   - Base palette: sky blue tones (#0ea5e9, #0284c7)
   - Design style: fresh and professional, with a strong business feel

4. **Green Theme**
   - Base palette: teal tones (#14b8a6, #0d9488)
   - Design style: natural and calm, with a strong tech feel

5. **Purple Theme**
   - Base palette: purple gradient (#a855f7, #9333ea)
   - Design style: elegant and mysterious, with a strong creative feel

#### Theme Implementation Strategy
```css
/* Implement themes with CSS variables */
:root {
  --n-primary-color: #0ea5e9;
  --n-primary-color-hover: #0284c7;
  --n-primary-color-pressed: #0369a1;
}

:root[data-theme="dark"] {
  --n-primary-color: #64748b;
  --n-primary-color-hover: #475569;
  --n-primary-color-pressed: #334155;
}
```

## 🧩 Component Functional Design

### Button Component System

#### Design Goals
- Unify the existing button variants
- Maintain visual consistency and interaction experience
- Simplify the API and improve usability

#### Component Variant Mapping
```typescript
// Existing button classes → Naive UI implementation
interface ButtonVariants {
  'theme-button-primary': 'primary' | 'default';
  'theme-button-secondary': 'default' | 'tertiary';
  'theme-button-toggle-active': 'primary';
  'theme-button-toggle-inactive': 'default';
  'theme-icon-button': 'default' + icon;
}
```

#### Implementation Plan
```vue
<!-- Unified button component -->
<template>
  <n-button
    :type="buttonType"
    :size="size"
    :ghost="ghost"
    :loading="loading"
    @click="handleClick"
  >
    <template #icon v-if="icon">
      <component :is="icon" />
    </template>
    <slot />
  </n-button>
</template>
```

### Input Component System

#### Design Goals
- Keep the functionality and styling of the existing inputs
- Integrate theme variables and reduce custom CSS
- Enhance accessibility and user experience

#### Implementation Plan
```vue
<!-- Themed input component -->
<template>
  <n-input
    v-model:value="modelValue"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :size="size"
    class="theme-input-wrapper"
  />
</template>

<style scoped>
.theme-input-wrapper {
  --n-color: var(--theme-input-bg);
  --n-border: var(--theme-input-border);
  --n-text-color: var(--theme-input-text);
}
</style>
```

### Card Component System

#### Design Refactor
```vue
<!-- Modern card component -->
<template>
  <n-card
    :title="title"
    :size="size"
    :hoverable="hoverable"
    class="theme-card-wrapper"
  >
    <template #header-extra v-if="$slots.actions">
      <slot name="actions" />
    </template>
    
    <slot />
    
    <template #footer v-if="$slots.footer">
      <slot name="footer" />
    </template>
  </n-card>
</template>
```

## 📱 Responsive Design

### Breakpoint Design
```typescript
const breakpoints = {
  xs: '0px',
  sm: '576px',
  md: '768px',
  lg: '992px',
  xl: '1200px',
  xxl: '1600px'
};
```

### Responsive Component Adaptation
- **Desktop** (≥1024px): full feature display
- **Tablet** (768px-1023px): appropriately compressed spacing
- **Mobile** (≤767px): simplified layout, optimized for touch

## 🔧 Internationalization Integration

### Multi-language Support Design
```typescript
// Naive UI internationalization configuration
import { zhCN, enUS, jaJP } from 'naive-ui';

const naiveUILocales = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
};

// Integration with the existing vue-i18n
const setupNaiveUILocale = (locale: string) => {
  return naiveUILocales[locale] || enUS;
};
```

### Text Content Strategy
- Keep the existing vue-i18n system unchanged
- Built-in component library text uses Naive UI internationalization
- Custom text continues to use the project's internationalization system

## ⚡ Performance Optimization Design

### On-demand Import Strategy
```typescript
// vite.config.ts configuration
export default defineConfig({
  plugins: [
    vue(),
    // Naive UI auto import
    NaiveUiResolver(),
  ],
});
```

### Tree-shaking Optimization
- Ensure all components support tree-shaking
- Remove unused CSS rules
- Optimize the import approach to reduce bundle size

### Runtime Performance
- Take advantage of Naive UI's performance features such as virtual scrolling
- Optimize theme switching animation performance
- Reduce unnecessary DOM operations

## 🧪 Test Design

### Component Testing Strategy
```typescript
// Component test example
describe('ThemeButton', () => {
  it('should render different variants correctly', () => {
    // Test the various button variants
  });
  
  it('should handle theme switching', () => {
    // Test the theme switching feature
  });
  
  it('should maintain accessibility', () => {
    // Test accessibility
  });
});
```

### Visual Regression Testing
- Use screenshot comparison to ensure UI consistency
- Test the visual effect of each theme variant
- Verify the responsive layout on various devices

## 📊 Performance Monitoring Design

### Key Metric Monitoring
```typescript
interface PerformanceMetrics {
  // Bundle size change
  bundleSize: {
    before: number;
    after: number;
    change: number;
  };
  
  // Page load performance
  pageLoad: {
    firstPaint: number;
    firstContentfulPaint: number;
    largestContentfulPaint: number;
  };
  
  // Theme switching performance
  themeSwitch: {
    duration: number;
    fps: number;
  };
}
```

## 🔄 Migration Compatibility Design

### Smooth Transition Strategy
```typescript
// Compatibility layer design
const LegacyButtonAdapter = {
  'theme-button-primary': (props: any) => ({
    type: 'primary',
    ...props
  }),
  'theme-button-secondary': (props: any) => ({
    type: 'default',
    ...props
  }),
  // Other mappings...
};
```

### Rollback Mechanism
- Keep the original implementation in every migration phase
- Control old and new components through a configuration switch
- Ensure a quick rollback is possible at any time

## 📋 Acceptance Criteria

### Functional Completeness Check
- [ ] All Element Plus components are replaced successfully
- [ ] 100% of existing functionality is preserved
- [ ] Theme switching works normally
- [ ] Internationalization works normally
- [ ] Responsive layout works normally

### Performance Metrics Check
- [ ] Bundle size is reduced or unchanged
- [ ] Page load performance does not degrade
- [ ] Theme switching response time <100ms
- [ ] Memory usage does not increase

### Code Quality Check
- [ ] 100% TypeScript type coverage
- [ ] Component API documentation is complete
- [ ] Unit test coverage >80%
- [ ] No ESLint or TypeScript errors

---

**Document status**: Design complete  
**Version history**:
- v1.0 (2025-01-01): Initial design version, including the complete functional design plan
