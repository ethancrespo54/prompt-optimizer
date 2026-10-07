/**
 * Unified imports of the default templates
 * 
 * 🎯 Minimal design: templates carry their own complete info; no extra configuration needed
 */

// Import all templates
import { template as general_optimize_en } from './optimize/general-optimize_en';
import { template as output_format_optimize_en } from './optimize/output-format-optimize_en';
import { template as analytical_optimize_en } from './optimize/analytical-optimize_en';
import { template as context_iterate_en } from './iterate/context/context-iterate_en';
// Context message optimization templates (dedicated to multi-turn conversation mode) - general templates first
import { template as context_message_optimize_en } from './optimize/context/context-message-optimize_en';
// Context message optimization templates: analytical / output format
import { template as context_analytical_optimize_en } from './optimize/context/context-analytical-optimize_en';
import { template as context_output_format_optimize_en } from './optimize/context/context-output-format-optimize_en';
// Newly aligned user context templates (basic / professional / planning)
import { template as context_user_prompt_basic_en } from './user-optimize/context/context-user-prompt-basic_en';
import { template as context_user_prompt_professional_ctx_en } from './user-optimize/context/context-user-prompt-professional_en';
import { template as context_user_prompt_planning_ctx_en } from './user-optimize/context/context-user-prompt-planning_en';

import { template as iterate_en } from './iterate/iterate_en';

import { user_prompt_professional_en } from './user-optimize/user-prompt-professional_en';
import { user_prompt_basic_en } from './user-optimize/user-prompt-basic_en';
import { user_prompt_planning_en } from './user-optimize/user-prompt-planning_en';

// Image optimization templates (restructured directory layout)
// Text-to-image
import { template as image_general_optimize_en } from './image-optimize/text2image/general-image-optimize_en';
import { template as image_chinese_optimize_en } from './image-optimize/text2image/chinese-model-optimize_en';
import { template as image_photography_optimize_en } from './image-optimize/text2image/photography-optimize_en';
import { template as image_creative_text2image_en } from './image-optimize/text2image/creative-text2image_en';
import { template as image_json_structured_optimize_en } from './image-optimize/text2image/json-structured-optimize_en';
// Image-to-image
import { template as image2image_optimize_en } from './image-optimize/image2image/image2image-optimize_en';
import { template as image2image_design_text_edit_optimize_en } from './image-optimize/image2image/design-text-edit-optimize_en';
import { template as image2image_json_structured_optimize_en } from './image-optimize/image2image/json-structured-optimize_en';
// Image iteration
import { template as image_iterate_general_en } from './image-optimize/iterate/image-iterate-general_en';

// Evaluation templates - basic mode / system prompt
import { template as evaluation_basic_system_original_en } from './evaluation/basic/system/evaluation-original_en';
import { template as evaluation_basic_system_optimized_en } from './evaluation/basic/system/evaluation-optimized_en';
import { template as evaluation_basic_system_compare_en } from './evaluation/basic/system/evaluation-compare_en';
// Evaluation templates - basic mode / user prompt
import { template as evaluation_basic_user_original_en } from './evaluation/basic/user/evaluation-original_en';
import { template as evaluation_basic_user_optimized_en } from './evaluation/basic/user/evaluation-optimized_en';
import { template as evaluation_basic_user_compare_en } from './evaluation/basic/user/evaluation-compare_en';
// Evaluation templates - advanced mode / system prompt (multi-message mode)
import { template as evaluation_pro_system_original_en } from './evaluation/pro/system/evaluation-original_en';
import { template as evaluation_pro_system_optimized_en } from './evaluation/pro/system/evaluation-optimized_en';
import { template as evaluation_pro_system_compare_en } from './evaluation/pro/system/evaluation-compare_en';
// Evaluation templates - advanced mode / user prompt (variable mode)
import { template as evaluation_pro_user_original_en } from './evaluation/pro/user/evaluation-original_en';
import { template as evaluation_pro_user_optimized_en } from './evaluation/pro/user/evaluation-optimized_en';
import { template as evaluation_pro_user_compare_en } from './evaluation/pro/user/evaluation-compare_en';
// Evaluation templates - prompt-only evaluation (no test results needed)
import { template as evaluation_basic_system_prompt_only_en } from './evaluation/basic/system/evaluation-prompt-only_en';
import { template as evaluation_basic_system_prompt_iterate_en } from './evaluation/basic/system/evaluation-prompt-iterate_en';
import { template as evaluation_basic_user_prompt_only_en } from './evaluation/basic/user/evaluation-prompt-only_en';
import { template as evaluation_basic_user_prompt_iterate_en } from './evaluation/basic/user/evaluation-prompt-iterate_en';
import { template as evaluation_pro_system_prompt_only_en } from './evaluation/pro/system/evaluation-prompt-only_en';
import { template as evaluation_pro_system_prompt_iterate_en } from './evaluation/pro/system/evaluation-prompt-iterate_en';
import { template as evaluation_pro_user_prompt_only_en } from './evaluation/pro/user/evaluation-prompt-only_en';
import { template as evaluation_pro_user_prompt_iterate_en } from './evaluation/pro/user/evaluation-prompt-iterate_en';
// Evaluation templates - image mode / text-to-image
import { template as evaluation_image_text2image_prompt_only_en } from './evaluation/image/text2image/evaluation-prompt-only_en';
// Evaluation templates - image mode / image-to-image
import { template as evaluation_image_image2image_prompt_only_en } from './evaluation/image/image2image/evaluation-prompt-only_en';

// Variable extraction template
import { variableExtractionTemplateEn } from './variable-extraction';

// Variable value generation template
import { variableValueGenerationTemplateEn } from './variable-value-generation';

// Simple template collection - templates already carry their complete info (id, name, language, type, etc.)
export const ALL_TEMPLATES = {
  general_optimize_en,
  output_format_optimize_en,
  analytical_optimize_en,
  context_iterate_en,
  context_message_optimize_en,
  context_analytical_optimize_en,
  context_output_format_optimize_en,
  context_user_prompt_basic_en,
  context_user_prompt_professional_ctx_en,
  context_user_prompt_planning_ctx_en,
  user_prompt_professional_en,
  iterate_en,
  user_prompt_basic_en,
  user_prompt_planning_en,
  // Image optimization templates
  image_general_optimize_en,
  image_chinese_optimize_en,
  image_photography_optimize_en,
  image_creative_text2image_en,
  image_json_structured_optimize_en,
  // Image-to-image templates
  image2image_optimize_en,
  image2image_design_text_edit_optimize_en,
  image2image_json_structured_optimize_en,
  // Image iteration templates
  image_iterate_general_en,
  // Evaluation templates - basic mode / system prompt
  evaluation_basic_system_original_en,
  evaluation_basic_system_optimized_en,
  evaluation_basic_system_compare_en,
  // Evaluation templates - basic mode / user prompt
  evaluation_basic_user_original_en,
  evaluation_basic_user_optimized_en,
  evaluation_basic_user_compare_en,
  // Evaluation templates - advanced mode / system prompt (multi-message mode)
  evaluation_pro_system_original_en,
  evaluation_pro_system_optimized_en,
  evaluation_pro_system_compare_en,
  // Evaluation templates - advanced mode / user prompt (variable mode)
  evaluation_pro_user_original_en,
  evaluation_pro_user_optimized_en,
  evaluation_pro_user_compare_en,
  // Evaluation templates - prompt-only evaluation (no test results needed)
  evaluation_basic_system_prompt_only_en,
  evaluation_basic_system_prompt_iterate_en,
  evaluation_basic_user_prompt_only_en,
  evaluation_basic_user_prompt_iterate_en,
  evaluation_pro_system_prompt_only_en,
  evaluation_pro_system_prompt_iterate_en,
  evaluation_pro_user_prompt_only_en,
  evaluation_pro_user_prompt_iterate_en,
  // Evaluation templates - image mode / text-to-image
  evaluation_image_text2image_prompt_only_en,
  // Evaluation templates - image mode / image-to-image
  evaluation_image_image2image_prompt_only_en,
  // Variable extraction template
  variableExtractionTemplateEn,
  // Variable value generation template
  variableValueGenerationTemplateEn,
};
