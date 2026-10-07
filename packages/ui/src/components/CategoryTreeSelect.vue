<template>
  <NTreeSelect
    v-model:value="internalValue"
    :options="treeOptions"
    :placeholder="placeholder || t('favorites.dialog.categoryPlaceholder')"
    :clearable="clearable"
    :consistent-menu-width="consistentMenuWidth"
    :style="computedStyle"
    @update:value="handleValueChange"
  >
    <template v-if="showManageButton" #action>
      <NButton
        text
        block
        @click="handleOpenManager"
        style="justify-content: flex-start; padding: 8px 12px;"
      >
        <template #icon>
          <NIcon><Folder /></NIcon>
        </template>
        {{ t('favorites.manager.categoryManager.title') }}
      </NButton>
    </template>
  </NTreeSelect>

  <!-- Category management dialog -->
  <NModal
    v-if="showManageButton"
    v-model:show="managerVisible"
    preset="card"
    :title="t('favorites.manager.categoryManager.title')"
    :mask-closable="true"
    :style="{ width: 'min(800px, 90vw)', height: 'min(600px, 80vh)' }"
  >
    <CategoryManager @category-updated="handleCategoryUpdated" />
  </NModal>
</template>

<script setup lang="ts">
import { ref, computed, watch, inject, type Ref } from 'vue'

import { NTreeSelect, NButton, NIcon, NModal, type TreeSelectOption } from 'naive-ui';
import { Folder } from '@vicons/tabler';
import { useI18n } from 'vue-i18n';
import CategoryManager from './CategoryManager.vue';
import type { FavoriteCategory } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

const { t } = useI18n();

interface Props {
  /** Currently selected category ID */
  modelValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Whether clearable */
  clearable?: boolean;
  /** Whether to show the "All categories" option (for filtering scenarios) */
  showAllOption?: boolean;
  /** Whether to show the management button */
  showManageButton?: boolean;
  /** Custom style */
  style?: string;
  /** Whether to keep the menu width consistent */
  consistentMenuWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  placeholder: '',
  clearable: true,
  showAllOption: false,
  showManageButton: true,
  style: 'min-width: 180px; max-width: 250px;',
  consistentMenuWidth: true
});

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'change': [value: string];
  'category-updated': [];
}>();

const services = inject<Ref<AppServices | null> | null>('services', null);

// Internal state
const internalValue = ref(props.modelValue);
const categories = ref<FavoriteCategory[]>([]);
const managerVisible = ref(false);

// Compute the tree category options
const treeOptions = computed<TreeSelectOption[]>(() => {
  const buildTree = (parentId?: string): TreeSelectOption[] => {
    return categories.value
      .filter(cat => cat.parentId === parentId)
      .map(cat => ({
        label: cat.name,
        key: cat.id,
        children: buildTree(cat.id)
      }));
  };

  const tree = buildTree(undefined);

  // In filter mode, add the "All categories" option
  if (props.showAllOption) {
    return [
      { label: t('favorites.manager.allCategories'), key: '' },
      ...tree
    ];
  }

  return tree;
});

// Compute the style
const computedStyle = computed(() => props.style);

// Load category data
const loadCategories = async () => {
  const servicesValue = services?.value;
  if (!servicesValue?.favoriteManager) {
    console.warn('Favorite manager is not initialized, skipping category loading');
    return;
  }

  try {
    categories.value = await servicesValue.favoriteManager.getCategories();
  } catch (error) {
    console.error('Failed to load categories:', error);
  }
};

// Handle value changes
const handleValueChange = (value: string) => {
  internalValue.value = value;
  emit('update:modelValue', value);
  emit('change', value);
};

// Open the category manager
const handleOpenManager = () => {
  managerVisible.value = true;
};

// Refresh the data after categories are updated
const handleCategoryUpdated = async () => {
  await loadCategories();
  emit('category-updated');
};

// Watch for external value changes
watch(() => props.modelValue, (newValue) => {
  if (newValue !== internalValue.value) {
    internalValue.value = newValue;
  }
});

// Watch for service initialization
watch(() => services?.value?.favoriteManager, (favoriteManager) => {
  if (favoriteManager) {
    loadCategories();
  }
}, { immediate: true });

// Expose methods
defineExpose({
  reloadCategories: loadCategories
});
</script>
