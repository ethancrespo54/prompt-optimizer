/**
 * Evaluation template exports
 */

// Basic mode - system prompt evaluation
export {
  evaluationBasicSystemOriginal,
  evaluationBasicSystemOriginalEn,
  evaluationBasicSystemOptimized,
  evaluationBasicSystemOptimizedEn,
  evaluationBasicSystemCompare,
  evaluationBasicSystemCompareEn,
  evaluationBasicSystemPromptOnly,
  evaluationBasicSystemPromptOnlyEn,
  evaluationBasicSystemPromptIterate,
  evaluationBasicSystemPromptIterateEn,
} from './basic/system';

// Basic mode - user prompt evaluation
export {
  evaluationBasicUserOriginal,
  evaluationBasicUserOriginalEn,
  evaluationBasicUserOptimized,
  evaluationBasicUserOptimizedEn,
  evaluationBasicUserCompare,
  evaluationBasicUserCompareEn,
  evaluationBasicUserPromptOnly,
  evaluationBasicUserPromptOnlyEn,
  evaluationBasicUserPromptIterate,
  evaluationBasicUserPromptIterateEn,
} from './basic/user';

// Advanced mode - system prompt evaluation (multi-message mode)
export {
  evaluationProSystemOriginal,
  evaluationProSystemOriginalEn,
  evaluationProSystemOptimized,
  evaluationProSystemOptimizedEn,
  evaluationProSystemCompare,
  evaluationProSystemCompareEn,
  evaluationProSystemPromptOnly,
  evaluationProSystemPromptOnlyEn,
  evaluationProSystemPromptIterate,
  evaluationProSystemPromptIterateEn,
} from './pro/system';

// Advanced mode - user prompt evaluation (variable mode)
export {
  evaluationProUserOriginal,
  evaluationProUserOriginalEn,
  evaluationProUserOptimized,
  evaluationProUserOptimizedEn,
  evaluationProUserCompare,
  evaluationProUserCompareEn,
  evaluationProUserPromptOnly,
  evaluationProUserPromptOnlyEn,
  evaluationProUserPromptIterate,
  evaluationProUserPromptIterateEn,
} from './pro/user';

// Image mode - text-to-image evaluation
export {
  evaluationImageText2ImagePromptOnly,
  evaluationImageText2ImagePromptOnlyEn,
} from './image/text2image';

// Image mode - image-to-image evaluation
export {
  evaluationImageImage2ImagePromptOnly,
  evaluationImageImage2ImagePromptOnlyEn,
} from './image/image2image';
