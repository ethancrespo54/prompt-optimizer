<template>
  <!-- Wrap the entire layout with ToastUI to provide NMessageProvider -->
  <ToastUI>
    <NLayout style="position: fixed; inset: 0; width: 100vw; height: 100vh;
    max-height: 100vh;
    overflow: hidden; display: flex; min-height: 0;"
    content-style="height: 100%; max-height: 100%; min-height: 0; overflow: hidden;"
    >

      <NFlex vertical style="position: fixed; inset: 0; width: 100vw; max-height: 100vh; height: 100vh; min-height: 0;">
      <!-- Top navigation bar -->
      <NLayoutHeader class="theme-header nav-header-enhanced">
        <NFlex justify="space-between" align="center" class="w-full nav-content" :wrap="false" :size="[16, 12]">
          <!-- Left: logo + title + core navigation -->
          <NFlex align="center" :size="16" :wrap="false">
            <!-- Logo + title -->
            <NFlex align="center" :size="8" :wrap="false">
              <NImage
                :src="logoSrc"
                alt="Logo"
                :width="logoSize"
                :height="logoSize"
                object-fit="cover"
                class="logo-image"
                :show-toolbar="false"
                :preview-disabled="true"
                :fallback-src="fallbackLogoSrc"
              />
              <NText class="text-lg sm:text-xl font-bold theme-title" tag="h2">
                <slot name="title">{{ t('common.appName') }}</slot>
              </NText>
            </NFlex>

            <!-- Core navigation elements -->
            <div class="core-navigation">
              <slot name="core-nav"></slot>
            </div>
          </NFlex>

          <!-- Right: action buttons -->
          <NFlex align="center" :size="8" :wrap="true" justify="end" class="nav-actions">
            <slot name="actions"></slot>
          </NFlex>
        </NFlex>
      </NLayoutHeader>

      <!-- Main content area - strictly constrained to the remaining space -->
      <NLayoutContent has-sider
        style="flex: 1; min-height: 0; overflow: hidden;"
        content-style="height: 100%; max-height: 100%; min-height: 0; box-sizing: border-box; padding: 24px clamp(16px, 2vw, 48px) 40px; display: flex; flex-direction: column; align-items: stretch; overflow: hidden;"
      >
        <div class="main-content-wrapper">
          <slot name="main"></slot>
        </div>
      </NLayoutContent>
      </NFlex>

      <!-- Dialog slot -->
      <slot name="modals"></slot>

    </NLayout>
  </ToastUI>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'

import { useI18n } from 'vue-i18n'
import { NLayout, NLayoutHeader, NLayoutContent, NFlex, NImage, NText } from 'naive-ui'
import ToastUI from './Toast.vue'
import logoImage from '../assets/logo.jpg'

const { t } = useI18n()

// Logo image config
const logoSrc = logoImage

// Create a simple SVG fallback logo
const createFallbackSvg = () => {
  const svg = `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="6" fill="#3b82f6"/>
      <text x="16" y="21" text-anchor="middle" fill="white" font-family="system-ui" font-size="14" font-weight="bold">P</text>
    </svg>
  `)}`
  return svg
}

const fallbackLogoSrc = createFallbackSvg()

// Responsive logo size - uses smarter detection
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)

const updateWindowWidth = () => {
  windowWidth.value = window.innerWidth
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    windowWidth.value = window.innerWidth
    window.addEventListener('resize', updateWindowWidth)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateWindowWidth)
  }
})

const logoSize = computed(() => {
  if (windowWidth.value < 480) {
    return 20 // Extra-small screen
  } else if (windowWidth.value < 640) {
    return 24 // Small screen
  }
  return 28 // Default size
})
</script>

<style>
.main-content-wrapper {
  width: 100%;
  margin: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.main-content-wrapper > * {
  flex: 1;
  min-height: 0;
}

/* Enhanced navigation bar styles */
.nav-header-enhanced {
  min-height: 64px !important;
  padding: 12px 16px !important;
}

.nav-content {
  min-height: 40px;
}

.nav-actions {
  min-height: 40px;
}

/* Logo style optimization */
.logo-image {
  border-radius: 6px;
  transition: transform 0.2s ease-in-out;
  flex-shrink: 0;
}

.logo-image:hover {
  transform: scale(1.05);
}

/* Title text alignment optimization */
.theme-title {
  line-height: 1.2 !important;
  margin: 0 !important;
  white-space: nowrap;
}

/* Core navigation styles */
.core-navigation {
  display: flex;
  align-items: center;
  margin-left: 16px;
  padding-left: 16px;
  border-left: 1px solid var(--border-color, rgba(239, 239, 245, 0.6));
  min-height: 32px;
}

.core-navigation :deep(.function-mode-selector) {
  transform: scale(1.05);
}

.core-navigation :deep(.n-radio-group) {
  background: var(--modal-color, #fff);
  border-radius: 8px;
  padding: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-color, rgba(239, 239, 245, 0.6));
}

.core-navigation :deep(.n-radio-button) {
  font-weight: 500;
  min-width: 60px;
  border-radius: 6px !important;
  transition: all 0.2s ease;
}

.core-navigation :deep(.n-radio-button--checked) {
  background: var(--primary-color) !important;
  color: white !important;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.12);
}

.core-navigation :deep(.n-radio-button:not(.n-radio-button--checked):hover) {
  background: var(--hover-color, rgba(0, 0, 0, 0.06));
}

/* Responsive optimization */
@media (max-width: 639px) {
  .logo-image {
    border-radius: 4px;
  }

  .core-navigation {
    margin-left: 8px;
    padding-left: 8px;
  }

  .core-navigation :deep(.function-mode-selector) {
    transform: scale(0.95);
  }

  .core-navigation :deep(.n-radio-button) {
    min-width: 48px;
    font-size: 12px;
  }
}

.custom-select {
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  background-image: none !important;
}

.custom-select::-ms-expand {
  display: none;
}
</style>
