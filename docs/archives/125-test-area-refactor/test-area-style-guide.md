# Test Area Component Style Guide

This document defines the unified style guide for the test area refactor components, ensuring visual consistency with the Naive UI design system and the optimization area on the left.

## Basic Style Principles

### 1. Spacing System

- **Primary spacing**: `NSpace vertical :size="16"` - Used for the main separation between components
- **Secondary spacing**: `NSpace vertical :size="8"` - Used for separating elements within a component  
- **Tight spacing**: `NFlex :size="12"` - Used for button groups or related controls
- **Minimum spacing**: `NFlex :size="8"` - Used for elements in dense layouts

### 2. Typography

```vue
<!-- Main title (18px, depth 1) -->
<NText :depth="1" style="font-size: 18px; font-weight: 500;">Main Title</NText>

<!-- Subtitle/label (14px, depth 2) -->
<NText :depth="2" style="font-size: 14px; font-weight: 500;">Label text</NText>

<!-- Help text (12px, depth 3) -->
<NText :depth="3" style="font-size: 12px;">Help description</NText>

<!-- Card title (16px, bold) -->
<NText style="font-size: 16px; font-weight: 600;">Card Title</NText>
```

### 3. Layout System

#### NFlex Layout
```vue
<!-- Horizontal layout -->
<NFlex justify="space-between" align="center" :wrap="false">

<!-- Vertical layout -->
<NFlex vertical :style="{ height: '100%' }">

<!-- Button group layout -->
<NFlex align="center" :size="8">
```

#### NGrid Responsive Layout
```vue
<NGrid :cols="24" :x-gap="12" responsive="screen">
  <NGridItem :span="8" :xs="24" :sm="8">
    <!-- Content -->
  </NGridItem>
</NGrid>
```

### 4. Height Management

```vue
<!-- Fixed-height container -->
:style="{ height: '100%' }"

<!-- Flex shrink control -->
:style="{ flexShrink: 0 }"

<!-- Fill the remaining space -->
:style="{ flex: 1, minHeight: 0 }"
```

## Component-Specific Guidelines

### TestInputSection
- Use `NSpace vertical :size="8"` as the main container
- The title uses `depth="2"`, `14px`, `font-weight: 500`
- Help text uses `depth="3"`, `12px`
- Fullscreen button style: `type="tertiary"`, `size="small"`, `ghost`, `round`

### TestControlBar  
- Responsive layout based on `NGrid :cols="24" :x-gap="12"`
- Label text follows the subtitle guideline
- Button spacing uses `:size="8"`
- Primary buttons use `type="primary"`, secondary buttons use `type="default"`

### ConversationSection
- Use `NCard size="small"` as the container
- The collapsed state is managed through `NCollapse`
- Maximum height is configured via props to avoid hard-coding

### TestResultSection
- Compare mode uses a horizontal `NFlex` layout with spacing `gap: 12px`
- Card titles use `16px`, `font-weight: 600`
- Single mode fills the container height

### TestAreaPanel
- The root container uses `NFlex vertical`
- Margins consistently use `marginBottom: '16px'`
- Avoid all Tailwind CSS classes; use a pure Naive UI implementation

## Forbidden Practices

### ❌ Hard-coded Pixel Values
```vue
<!-- Wrong -->
<div style="height: 200px; margin-bottom: 20px;">

<!-- Correct -->
<div :style="{ marginBottom: '16px' }">
```

### ❌ Tailwind CSS Classes
```vue
<!-- Wrong -->
<div class="flex flex-col h-full mb-4">

<!-- Correct -->
<NFlex vertical :style="{ height: '100%', marginBottom: '16px' }">
```

### ❌ Native HTML Element Layout
```vue
<!-- Wrong -->
<div class="grid grid-cols-2 gap-4">

<!-- Correct -->
<NGrid :cols="2" :x-gap="16">
```

## Responsive Breakpoints

Follows the Naive UI responsive system:
- `xs`: < 576px (phone)
- `sm`: 576px (small screen)  
- `md`: 768px (tablet)
- `lg`: 992px (desktop)
- `xl`: 1200px (large screen)
- `xxl`: 1600px (extra-large screen)

## Theme Compatibility

All components must be compatible with:
- Light theme / dark theme
- The Naive UI theme variable system
- Dynamic theme switching

## Verification Checklist

Component style verification checklist:
- [ ] No hard-coded pixel values
- [ ] No Tailwind CSS classes
- [ ] Uses the Naive UI spacing system
- [ ] Text styles conform to the guideline
- [ ] Responsive layout is correct
- [ ] Theme compatibility tests pass
- [ ] Visually consistent with the optimization area on the left
