import { computed, type CSSProperties } from 'vue'

import { useThemeVars, type TooltipProps } from 'naive-ui';

type TooltipThemeOverrides = NonNullable<TooltipProps['themeOverrides']>;

interface UseTooltipThemeOptions {
  maxWidth?: CSSProperties['maxWidth'];
  maxHeight?: CSSProperties['maxHeight'];
  whiteSpace?: CSSProperties['whiteSpace'];
  wordBreak?: CSSProperties['wordBreak'];
  overflowWrap?: CSSProperties['overflowWrap'];
  padding?: CSSProperties['padding'];
  overflowY?: CSSProperties['overflowY'];
}

/**
 * Naive UI composites the Tooltip overlay into a near-black background by default, which looks abrupt under light themes.
 * Here the tooltip's themeOverrides are built from the ConfigProvider theme variables, with commonly used content styles provided,
 * so the Tooltip background stays consistent with popup-type components, while its size is limited to prevent obscuring content.
 */
export function useTooltipTheme(options: UseTooltipThemeOptions = {}) {
  const themeVars = useThemeVars();

  const tooltipThemeOverrides = computed<TooltipThemeOverrides>(() => {
    const vars = themeVars.value;

    return {
      color: vars.popoverColor,
      textColor: vars.textColor2,
      boxShadow: vars.boxShadow2,
      borderRadius: vars.borderRadius
    };
  });

  const tooltipOverlayStyle = computed<CSSProperties>(() => ({
    maxWidth: options.maxWidth ?? 'calc(100vw - 32px)',
    maxHeight: options.maxHeight ?? 'calc(100vh - 32px)'
  }));

  const tooltipContentStyle = computed<CSSProperties>(() => ({
    maxWidth: '100%',
    maxHeight: options.maxHeight ?? 'calc(100vh - 32px)',
    whiteSpace: options.whiteSpace ?? 'pre-wrap',
    wordBreak: options.wordBreak ?? 'break-word',
    overflowWrap: options.overflowWrap ?? 'anywhere',
    padding: options.padding ?? '12px 16px',
    overflowY: options.overflowY ?? 'auto',
    border: `1px solid ${themeVars.value.dividerColor}`,
    boxSizing: 'border-box'
  }));

  return {
    tooltipThemeOverrides,
    tooltipOverlayStyle,
    tooltipContentStyle
  };
}
