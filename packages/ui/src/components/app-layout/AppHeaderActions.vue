<template>
    <!--
        App header action buttons component

        Responsibilities:
        - Core feature buttons: template management, history, model management, favorites, data management
        - Auxiliary features: theme toggle, GitHub link, language switch, update check

        Design notes:
        - Extracted from the #actions slot of App.vue
        - All actions notify the parent component through emits
        - Keeps the UI and behavior fully consistent with the original implementation
    -->
    <!-- Core feature area -->
    <ActionButtonUI
        icon="📝"
        :text="$t('nav.templates')"
        @click="emit('open-templates')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="📜"
        :text="$t('nav.history')"
        @click="emit('open-history')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="⚙️"
        :text="$t('nav.modelManager')"
        @click="emit('open-model-manager')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="⭐"
        :text="$t('nav.favorites')"
        @click="emit('open-favorites')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="💾"
        :text="$t('nav.dataManager')"
        @click="emit('open-data-manager')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <ActionButtonUI
        icon="🔣"
        :text="$t('nav.variableManager')"
        @click="emit('open-variables')"
        type="default"
        size="medium"
        :ghost="false"
        :round="true"
    />
    <!-- Auxiliary feature area - uses simplified styles to lower the visual weight -->
    <ThemeToggleUI />
    <ActionButtonUI
        icon=""
        text=""
        @click="emit('open-github')"
        size="small"
        type="default"
        :ghost="true"
    >
        <template #icon>
            <svg
                class="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path
                    d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"
                />
            </svg>
        </template>
    </ActionButtonUI>
    <!-- Auto-update component - only shown in the Electron environment -->
    <UpdaterIcon />
</template>

<script setup lang="ts">
/**
 * App header action buttons component
 *
 * @description
 * A header action buttons component extracted from App.vue, used for the #actions slot of MainLayoutUI.
 * Contains two parts: core feature buttons and auxiliary feature buttons.
 *
 * @features
 * - Core features: template management, history, model management, favorites, data management
 * - Auxiliary features: theme toggle, GitHub link, language switch, update check
 * - All actions notify the parent component through emits
 *
 * @example
 * ```vue
 * <template #actions>
 *   <AppHeaderActions
 *     @open-templates="openTemplateManager"
 *     @open-history="historyManager.showHistory = true"
 *     @open-model-manager="modelManager.showConfig = true"
 *     @open-favorites="showFavoriteManager = true"
 *     @open-data-manager="showDataManager = true"
 *     @open-github="openGithubRepo"
 *   />
 * </template>
 * ```
 */
import ActionButtonUI from '../ActionButton.vue'
import ThemeToggleUI from '../ThemeToggleUI.vue'
import UpdaterIcon from '../UpdaterIcon.vue'

// ========================
// Emits definition
// ========================
const emit = defineEmits<{
    /** Open the template manager */
    'open-templates': []
    /** Open history */
    'open-history': []
    /** Open the model manager */
    'open-model-manager': []
    /** Open favorites */
    'open-favorites': []
    /** Open the data manager */
    'open-data-manager': []
    /** Open the variable manager */
    'open-variables': []
    /** Open the GitHub repository */
    'open-github': []
}>()
</script>
