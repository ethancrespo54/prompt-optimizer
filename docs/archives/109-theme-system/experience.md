# Theme System Development Lessons

## 📋 Overview

Core lessons from the development of the multi-theme feature, focusing on how to handle style conflicts with third-party libraries and best practices for the theme system.

## 🎨 Handling Conflicts Between the UI Theme System and Third-party Library Styles

### Scenario
While developing the multi-theme feature (especially custom dark themes such as purple and green), we found that in the Markdown rendering component integrating the Tailwind Typography (`prose`) plugin, the background and text colors could not correctly apply the theme colors and were instead overridden with incongruous light styles (such as a white background).

### Root cause analysis

The core of the problem is a direct conflict between the project's own color theme system based on the `data-theme` attribute and the self-contained color scheme preset by the Tailwind Typography (`prose`) plugin.

1. **The strong opinions of `prose`**: The `@tailwindcss/typography` plugin is not merely a layout tool; it injects a complete visual scheme into HTML content, **including fixed colors, fonts, backgrounds, and other styles**.

2. **Default light preference**: The default configuration of `prose` (such as `prose-stone`) is designed for light backgrounds and forces dark text colors.

3. **Limitations of the `dark:` mode**: The color inversion mechanism of `prose` (`dark:prose-invert`) depends strongly on the `dark` class on the `<html>` tag. Our custom dark themes (such as `data-theme="purple"`) look dark but do not trigger Tailwind's `dark` mode, so `prose` still applies its default light styles, causing the color override.

### Solution and best practices

For third-party libraries with such strong style opinions, a **complete isolation** strategy must be adopted; do not try to "mix" them.

#### 1. No partial application
Practice has shown that trying to merely "borrow" the layout features of `prose` via `@apply prose-sm` and the like does not work. It still introduces color styles we do not want, causing unpredictable override problems.

#### 2. Rebuild the layout manually
The most robust solution is to **completely remove** `@apply prose` or any of its variants from the components that need to apply a custom theme. Then, referring to the `prose` documentation or default styles, **manually add purely layout and spacing styles with no colors to each Markdown element (`h1`, `p`, `ul`, etc.)**.

#### 3. Return control
By rebuilding the layout manually, we bring control of styling entirely back into our own theme system. The colors, backgrounds, borders, and other styles we define for elements under each theme can then be applied correctly and without interference.

### Example - Manually rebuilt Markdown layout

```css
/* Defined in the global theme.css, not belonging to any specific theme */
.theme-markdown-content {
  @apply max-w-none;
}

.theme-markdown-content > :first-child { @apply mt-0; }
.theme-markdown-content > :last-child { @apply mb-0; }
.theme-markdown-content h1 { @apply text-2xl font-bold my-4; }
.theme-markdown-content h2 { @apply text-xl font-semibold my-3; }
.theme-markdown-content p { @apply my-3 leading-relaxed; }
.theme-markdown-content ul,
.theme-markdown-content ol { @apply my-3 pl-6 space-y-2; }
.theme-markdown-content pre { @apply my-4 p-4 rounded-lg text-sm; }
/* ... etc ... */
```

This way we keep the attractive typography while making sure the colors of the custom themes render correctly.

## 🎯 Theme System Design Principles

### 1. A theme system based on CSS variables
```css
/* Theme definitions */
[data-theme="purple"] {
  --theme-bg: #1a1625;
  --theme-text: #e2e8f0;
  --theme-primary: #8b5cf6;
  /* ... */
}

[data-theme="green"] {
  --theme-bg: #0f1419;
  --theme-text: #e2e8f0;
  --theme-primary: #10b981;
  /* ... */
}
```

### 2. Semantic CSS classes
```css
/* Use semantic class names rather than raw color values */
.theme-bg { background-color: var(--theme-bg); }
.theme-text { color: var(--theme-text); }
.theme-primary { color: var(--theme-primary); }
```

### 3. Third-party library isolation strategy
- **Complete isolation**: For libraries with strong style opinions, avoid using them entirely
- **Manual rebuild**: Refer to the third-party library's layout and implement the styles by hand
- **Retain control**: Ensure the theme system has the final say over styles

## 🔧 Implementation Experience

### Success cases
1. **Markdown rendering**: Completely removed the `prose` plugin and implemented the typography styles by hand
2. **Code highlighting**: Used a syntax highlighting library that supports theme switching
3. **Icon system**: Used SVG icons with colors controlled via CSS variables

### Pitfalls to avoid
1. **Partially applying third-party styles**: Trying to use only the layout while ignoring the colors
2. **Relying on the `dark:` mode**: Custom themes should not depend on Tailwind's dark mode
3. **Style priority conflicts**: Ensure theme styles have sufficient priority

## 💡 Key Lessons Summary

1. **Complete isolation principle**: For third-party libraries with strong style opinions, a complete isolation strategy must be adopted
2. **Return control**: Through manual rebuilding, bring style control entirely back into your own theme system
3. **Semantic design**: Use semantic CSS classes and variables to improve maintainability
4. **Test coverage**: Every theme needs thorough testing to ensure styles are applied correctly
5. **Documentation**: Document in detail how third-party libraries are handled, to avoid repeating the same mistakes

## 🔗 Related Documents

- [Theme System Overview](./README.md)
- [Third-party Library Conflict Handling Guide](./third-party-conflicts.md)
- [Theme Development Guidelines](./development-guide.md)

---

**Document type**: Lessons learned  
**Scope**: Theme system development  
**Last updated**: 2025-07-01
