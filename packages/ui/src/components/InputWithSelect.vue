<template>
  <div ref="componentRef" class="relative">
    <NInput
      ref="inputRef"
      :value="modelValue"
      @update:value="handleInput"
      :type="type"
      :placeholder="placeholder"
      :loading="isLoading"
      clearable
    >
      <template #suffix>
        <NButton
          quaternary
          circle
          size="small"
          @click="toggleDropdown"
          :loading="isLoading"
        >
          <template #icon>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </template>
        </NButton>
      </template>
    </NInput>
    
    <!-- Hint text -->
    <transition name="fade">
      <div v-if="!isOpen && !isLoading && showHint" 
          class="absolute right-12 top-0 bottom-0 min-w-[120px] flex items-center text-xs text-gray-500 pointer-events-none">
        {{ hintText }}
      </div>
    </transition>
    
    <!-- Dropdown Menu -->
    <NCard
      v-if="isOpen"
      size="small"
      class="absolute z-10 mt-1 w-full shadow-lg max-h-60 overflow-auto"
      :bordered="true"
    >
      <NEmpty v-if="isLoading" size="small" :description="loadingText" />
      <NEmpty v-else-if="filteredOptions.length === 0" size="small" :description="noOptionsText" />
      <NSpace v-else vertical size="small">
        <div
          v-for="option in filteredOptions"
          :key="option.value"
          @click="selectOption(option)"
          class="cursor-pointer px-2 py-1 rounded transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
          :class="{
            'bg-blue-100 dark:bg-blue-900': modelValue === option.value
          }"
        >
          {{ option.label }}
        </div>
      </NSpace>
    </NCard>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

import { NInput, NButton, NCard, NEmpty, NSpace } from 'naive-ui';

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  options: {
    type: Array,
    default: () => []
  },
  type: {
    type: String,
    default: 'text'
  },
  required: {
    type: Boolean,
    default: false
  },
  placeholder: {
    type: String,
    default: ''
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  loadingText: {
    type: String,
    default: 'Loading...'
  },
  noOptionsText: {
    type: String,
    default: 'No options available'
  },
  fetchOptions: {
    type: Function,
    default: null
  },
  showHint: {
    type: Boolean,
    default: true
  },
  hintText: {
    type: String,
    default: 'Click to fetch options'
  }
});

const emit = defineEmits(['update:modelValue', 'select', 'fetchOptions']);

const isOpen = ref(false);
const inputRef = ref(null);
const searchText = ref('');

// Filter options based on the input
const filteredOptions = computed(() => {
  if (!searchText.value) return props.options;
  return props.options.filter(option => 
    option.label.toLowerCase().includes(searchText.value.toLowerCase()) ||
    option.value.toLowerCase().includes(searchText.value.toLowerCase())
  );
});

// Handle the input event
const handleInput = (value) => {
  emit('update:modelValue', value);
  searchText.value = value;
};

// Toggle dropdown visibility
const toggleDropdown = async () => {
  isOpen.value = !isOpen.value;
  
  // If the dropdown menu opens, focus the input
  if (isOpen.value) {
    emit('fetchOptions');
    // Wait for the DOM to update before focusing
    setTimeout(() => {
      if (inputRef.value && inputRef.value.focus) {
        inputRef.value.focus();
      }
    }, 10);
  }
};

// Handle option selection
const selectOption = (option) => {
  emit('update:modelValue', option.value);
  emit('select', option);
  isOpen.value = false;
  searchText.value = '';
};

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  console.log('Click detected', {
    isOpen: isOpen.value,
    isComponent: componentRef.value && componentRef.value.contains(event.target),
    target: event.target
  });
  
  // Only close the dropdown when it is open and the click is outside the component
  if (isOpen.value && componentRef.value && !componentRef.value.contains(event.target)) {
    console.log('Closing dropdown');
    isOpen.value = false;
    searchText.value = '';
  }
};

// Component reference
const componentRef = ref(null);

// Add and remove event listener
onMounted(() => {
  if (typeof document !== 'undefined') {
    // Use the capture phase to make sure the event is captured correctly
    document.addEventListener('mousedown', handleClickOutside, true);
  }
});

onUnmounted(() => {
  if (typeof document !== 'undefined') {
    document.removeEventListener('mousedown', handleClickOutside, true);
  }
});
</script>

<style scoped>
/* Fade in/out effect for the hint text */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Pure Naive UI implementation - dropdown and hover styles handled by Naive UI */
</style>