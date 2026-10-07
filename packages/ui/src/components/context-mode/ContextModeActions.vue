<template>
  <NFlex align="center" :wrap="false" :size="12">
    <!-- Quick action buttons -->
    <!-- Tool management -->
    <NButton
      size="small"
      type="default"
      @click="$emit('open-tool-manager')"
      :title="$t('contextMode.actions.tools')"
    >
      <template #icon>
        <span>🔧</span>
      </template>
      {{ $t('contextMode.actions.tools') }}
    </NButton>
  </NFlex>
</template>

<script setup lang="ts">
import { NButton, NFlex } from 'naive-ui'

const emit = defineEmits<{
  'open-tool-manager': []
}>()
</script>

<style scoped>
/* Make sure the button group displays correctly on small screens too */
</style>
