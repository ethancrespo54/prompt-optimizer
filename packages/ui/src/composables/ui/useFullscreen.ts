import { ref, watch, type ComputedRef } from 'vue'


export function useFullscreen(
  modelValue: ComputedRef<string> | { value: string }, 
  emitUpdateValue: (value: string) => void
) {
  // Fullscreen state
  const isFullscreen = ref(false)
  
  // The text value in fullscreen mode
  const fullscreenValue = ref(modelValue.value || '')

  // Prevent the loop "external sync -> triggers write-back -> sync again"
  // Only allow writing back the external value while the user is in the fullscreen editing state
  const isSyncingFromModel = ref(false)
  
  // Watch external value changes and sync them to the fullscreen value
  watch(() => modelValue.value, (newValue) => {
    isSyncingFromModel.value = true
    fullscreenValue.value = newValue || ''
    queueMicrotask(() => {
      isSyncingFromModel.value = false
    })
  })
  
  // Watch fullscreen value changes and sync them outward
  watch(fullscreenValue, (newValue) => {
    // Only write back during fullscreen editing; non-fullscreen input is handled by the original component's own v-model/update
    if (!isFullscreen.value) return
    // Changes caused by external sync are not written back (avoids loops / duplicate writes)
    if (isSyncingFromModel.value) return

    emitUpdateValue(newValue)
  })
  
  // Enter fullscreen
  const openFullscreen = () => {
    isFullscreen.value = true
  }
  
  // Exit fullscreen
  const closeFullscreen = () => {
    isFullscreen.value = false
  }
  
  return {
    isFullscreen,
    fullscreenValue,
    openFullscreen,
    closeFullscreen
  }
} 
