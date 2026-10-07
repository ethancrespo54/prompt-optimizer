<template>
    <!--
        App core navigation component

        Responsibilities:
        - Function mode selector (Basic / Pro / Image)
        - Sub-mode selectors for each mode

        🔧 Router architecture: navigate directly with router.push
        - Compute the current mode from the route parameters
        - Navigation actions call router.push directly
    -->
    <NSpace :size="12" align="center" data-testid="core-nav">
        <!-- Function mode selector -->
        <FunctionModeSelector
            :modelValue="functionMode"
            @update:modelValue="handleFunctionModeChange"
        />

        <!-- Sub-mode selector - basic mode -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'basic'"
            :modelValue="basicSubMode"
            functionMode="basic"
            @change="handleBasicSubModeChange"
        />

        <!-- Sub-mode selector - context mode -->
        <OptimizationModeSelectorUI
            v-if="functionMode === 'pro'"
            :modelValue="proSubMode"
            functionMode="pro"
            @change="handleProSubModeChange"
        />

        <!-- Sub-mode selector - image mode -->
        <ImageModeSelector
            v-if="functionMode === 'image'"
            :modelValue="imageSubMode"
            @change="handleImageSubModeChange"
        />
    </NSpace>
</template>

<script setup lang="ts">
/**
 * App core navigation component
 *
 * @description
 * Used for the #core-nav slot of MainLayoutUI.
 * Contains the function mode selector and the sub-mode selectors for each mode.
 *
 * @features
 * - Function mode switch: Basic / Pro / Image
 * - Basic mode sub-modes: system / user
 * - Pro mode sub-modes: multi / variable
 * - Image mode sub-modes: text2image / image2image
 *
 * 🔧 Router architecture: navigate directly with router.push
 */
import { computed } from 'vue'
import { router as routerInstance } from '../../router'
import { NSpace } from 'naive-ui'
import FunctionModeSelector from '../FunctionModeSelector.vue'
import OptimizationModeSelectorUI from '../OptimizationModeSelector.vue'
import ImageModeSelector from '../image-mode/ImageModeSelector.vue'
import type { FunctionMode, BasicSubMode, ProSubMode, ImageSubMode } from '@prompt-optimizer/core'

type SubMode = BasicSubMode | ProSubMode

// ========================
// Router (uses the router singleton to avoid injection failures / multiple instances)
// ========================
// Compute the mode from the current route
const functionMode = computed<FunctionMode>(() => {
    const path = routerInstance.currentRoute.value.path
    if (path.startsWith('/basic')) return 'basic'
    if (path.startsWith('/pro')) return 'pro'
    if (path.startsWith('/image')) return 'image'
    return 'basic' // Default
})

const basicSubMode = computed<BasicSubMode>(() => {
    const rawSubMode = routerInstance.currentRoute.value.path.split('/')[2]

    // ✅ Static route mapping: system or user
    if (rawSubMode === 'system' || rawSubMode === 'user') {
        return rawSubMode as BasicSubMode
    }

    return 'system' // Default value
})

const proSubMode = computed<ProSubMode>(() => {
    const rawSubMode = routerInstance.currentRoute.value.path.split('/')[2]

    // ✅ Standard values
    if (rawSubMode === 'multi' || rawSubMode === 'variable') {
        return rawSubMode as ProSubMode
    }

    // ✅ Compatible with legacy route values: system/user -> multi/variable
    if (rawSubMode === 'system') return 'multi'
    if (rawSubMode === 'user') return 'variable'

    return 'variable'
})

const imageSubMode = computed<ImageSubMode>(() => {
    const rawSubMode = routerInstance.currentRoute.value.path.split('/')[2]

    // ✅ Static route mapping: text2image or image2image
    if (rawSubMode === 'text2image' || rawSubMode === 'image2image') {
        return rawSubMode as ImageSubMode
    }

    return 'text2image' // Default value
})

// ========================
// Navigation handling
// ========================
// 🔧 Default sub-mode of each mode (avoids cross-mode contamination)
const DEFAULT_SUB_MODES = {
    basic: 'system',
    pro: 'variable',
    image: 'text2image'
} as const

const handleFunctionModeChange = (mode: FunctionMode) => {
    // When switching functionMode, use the default subMode to avoid cross-mode contamination
    // For example: switching from /image/text2image to pro should not use text2image (invalid)
    const defaultSubMode = DEFAULT_SUB_MODES[mode]
    routerInstance.push(`/${mode}/${defaultSubMode}`)
}

const handleBasicSubModeChange = (mode: SubMode) => {
    if (mode === 'system' || mode === 'user') {
        routerInstance.push(`/basic/${mode}`)
    }
}

const handleProSubModeChange = (mode: SubMode) => {
    if (mode === 'multi' || mode === 'variable') {
        routerInstance.push(`/pro/${mode}`)
    }
}

const handleImageSubModeChange = (mode: ImageSubMode) => {
    routerInstance.push(`/image/${mode}`)
}
</script>
