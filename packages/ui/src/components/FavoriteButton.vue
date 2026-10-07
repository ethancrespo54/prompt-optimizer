<template>
  <n-button
    :type="isFavorited ? 'primary' : 'default'"
    :size="size"
    :disabled="loading"
    @click="handleToggleFavorite"
    :title="isFavorited ? 'Remove from favorites' : 'Add to favorites'"
    class="favorite-button"
  >
      <template #icon>
      <n-icon>
        <Stars v-if="isFavorited" />
        <Star v-else />
      </n-icon>
    </template>
    {{ isFavorited ? 'Favorited' : 'Favorite' }}
  </n-button>

  <!-- Favorite dialog -->
  <n-modal v-model:show="showFavoriteModal">
    <n-card
      style="max-width: 500px"
      title="Add to favorites"
      :bordered="false"
      size="huge"
      role="dialog"
      aria-modal="true"
    >
      <n-form
        ref="formRef"
        :model="favoriteForm"
        :rules="formRules"
        label-placement="top"
      >
        <n-form-item label="Title" path="title">
          <n-input
            v-model:value="favoriteForm.title"
            placeholder="Give this prompt a name"
            maxlength="100"
            show-count
          />
        </n-form-item>

        <n-form-item label="Description" path="description">
          <n-input
            v-model:value="favoriteForm.description"
            type="textarea"
            placeholder="Describe the purpose and characteristics of this prompt"
            :rows="3"
            maxlength="300"
            show-count
          />
        </n-form-item>

        <n-form-item label="Category" path="category">
          <n-select
            v-model:value="favoriteForm.category"
            :options="categoryOptions"
            placeholder="Select a category"
            clearable
          />
        </n-form-item>

        <n-form-item label="Tags" path="tags">
          <n-dynamic-tags
            v-model:value="favoriteForm.tags"
            :max="10"
            placeholder="Type a tag and press Enter to add"
          />
        </n-form-item>

      </n-form>

      <template #footer>
        <div class="flex justify-end gap-2">
          <n-button @click="showFavoriteModal = false">
            Cancel
          </n-button>
          <n-button
            type="primary"
            :loading="loading"
            @click="handleSaveFavorite"
          >
            Save
          </n-button>
        </div>
      </template>
    </n-card>
  </n-modal>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, inject, watch, type Ref } from 'vue'

import {
  NButton,
  NIcon,
  NModal,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NDynamicTags,
  type FormInst,
  type FormRules
} from 'naive-ui';
import { useToast } from '../composables/ui/useToast';
import { Star, Stars } from '@vicons/tabler';
import type { FavoriteCategory } from '@prompt-optimizer/core';
import type { AppServices } from '../types/services';

interface Props {
  /** Prompt content */
  content: string;
  /** Original prompt content */
  originalContent?: string;
  /** Button size */
  size?: 'tiny' | 'small' | 'medium' | 'large';
  /** Whether to show the loading state */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  loading: false
});

const emit = defineEmits<{
  'favorited': [id: string];
  'unfavorited': [];
}>();

const services = inject<Ref<AppServices | null> | null>('services', null);

const message = useToast();

// Form-related
const formRef = ref<FormInst | null>(null);
const showFavoriteModal = ref(false);
const loading = ref(false);
const categories = ref<FavoriteCategory[]>([]);

// Favorite state
const isFavorited = ref(false);
const favoriteId = ref<string | null>(null);

// Form data
const favoriteForm = ref({
  title: '',
  description: '',
  category: '',
  tags: [] as string[]
});

// Form validation rules
const formRules: FormRules = {
  title: [
    {
      required: true,
      message: 'Please enter a title',
      trigger: ['input', 'blur']
    }
  ],
  category: [
    {
      required: false,
      message: 'Please select a category',
      trigger: ['change', 'blur']
    }
  ]
};

// Category options
const categoryOptions = computed(() => {
  return categories.value.map(cat => ({
    label: cat.name,
    value: cat.id,
    color: cat.color
  }));
});

// Check whether it is already favorited
const checkFavoriteStatus = async () => {
  if (!services?.value || !props.content) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized, skipping the favorite state check');
    return;
  }

  try {
    const favorites = await servicesValue.favoriteManager.getFavorites();
    const existing = favorites.find(f => f.content === props.content);

    if (existing) {
      isFavorited.value = true;
      favoriteId.value = existing.id;
    } else {
      isFavorited.value = false;
      favoriteId.value = null;
    }
  } catch (error) {
    console.error('Failed to check favorite state:', error);
  }
};

// Load the category list
const loadCategories = async () => {
  if (!services?.value) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized, skipping category loading');
    return;
  }

  try {
    categories.value = await servicesValue.favoriteManager.getCategories();
  } catch (error) {
    console.error('Failed to load categories:', error);
    message.error('Failed to load categories');
  }
};

// Toggle the favorite state
const handleToggleFavorite = () => {
  if (isFavorited.value) {
    handleRemoveFavorite();
  } else {
    showFavoriteModal.value = true;
    initFavoriteForm();
  }
};

// Initialize the favorite form
const initFavoriteForm = () => {
  // Auto-generate the title
  let title = props.content.slice(0, 50);
  if (props.content.length > 50) {
    title += '...';
  }

  // Categorize intelligently based on the content
  let defaultCategory = '';
  if (props.originalContent) {
    // If there is original content, this is an optimized prompt
    defaultCategory = categories.value.find(c => c.name === 'System Prompts')?.id || '';
  }

  favoriteForm.value = {
    title,
    description: '',
    category: defaultCategory,
    tags: []
  };
};

// Save the favorite
const handleSaveFavorite = async () => {
  if (!services?.value) return;
  const servicesValue = services?.value;
  if (!servicesValue) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized, cannot perform the favorite operation');
    message.warning('Favorites feature is currently unavailable, please try again later');
    return;
  }

  try {
    await formRef.value?.validate();
    loading.value = true;

    const favoriteData = {
      title: favoriteForm.value.title,
      content: props.content,
      description: favoriteForm.value.description,
      category: favoriteForm.value.category,
      tags: favoriteForm.value.tags,
      functionMode: 'basic' as const,  // Defaults to basic mode
      optimizationMode: 'system' as const,  // Defaults to system optimization mode
      metadata: {
        originalContent: props.originalContent,  // Moved into metadata
        hasOriginalContent: !!props.originalContent
      }
    };

    const id = await servicesValue.favoriteManager.addFavorite(favoriteData);

    isFavorited.value = true;
    favoriteId.value = id;
    showFavoriteModal.value = false;

    message.success('Added to favorites');
    emit('favorited', id);
  } catch (error) {
    console.error('Failed to add favorite:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    message.error(`Failed to add favorite: ${errorMessage}`);
  } finally {
    loading.value = false;
  }
};

// Remove a favorite
const handleRemoveFavorite = async () => {
  const servicesValue = services?.value;
  if (!servicesValue || !favoriteId.value) return;
  if (!servicesValue.favoriteManager) {
    console.warn('Favorite manager is not initialized, cannot perform the unfavorite operation');
    message.warning('Favorites feature is currently unavailable, please try again later');
    return;
  }

  try {
    await servicesValue.favoriteManager.deleteFavorite(favoriteId.value);

    isFavorited.value = false;
    favoriteId.value = null;

    message.success('Removed from favorites');
    emit('unfavorited');
  } catch (error) {
    console.error('Failed to remove favorite:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    message.error(`Failed to remove favorite: ${errorMessage}`);
  }
};

// Watch for service initialization to complete before running related operations
watch(() => services?.value?.favoriteManager, (favoriteManager) => {
  if (favoriteManager) {
    loadCategories();
    if (props.content) {
      checkFavoriteStatus();
    }
  }
}, { immediate: true });

onMounted(() => {
  loadCategories();
  checkFavoriteStatus();
});

// Watch for content changes and re-check the favorite state
watch(() => props.content, () => {
  checkFavoriteStatus();
});
</script>

<style scoped>
.favorite-button {
  transition: all 0.2s ease;
}

.favorite-button:hover {
  transform: scale(1.05);
}
</style>
