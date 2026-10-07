<template>
    <!--
        Extension App entry component

        Responsibilities:
        - Serve as the entry point of the Chrome extension app
        - Render the PromptOptimizerApp main component

        Notes:
        - All core logic has moved to PromptOptimizerApp in @prompt-optimizer/ui
        - This file only serves as the app shell, reducing code duplication
    -->
    <PromptOptimizerApp />
</template>

<script setup lang="ts">
/**
 * Extension App entry component
 *
 * @description
 * A lightweight entry component that renders the PromptOptimizerApp main app.
 * All business logic, state management, and event handling are implemented in PromptOptimizerApp.
 */
import { PromptOptimizerApp } from "@prompt-optimizer/ui";
</script>
