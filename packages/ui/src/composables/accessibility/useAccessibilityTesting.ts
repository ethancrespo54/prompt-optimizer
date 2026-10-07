import { ref, computed } from 'vue'

export interface TestRuleResult {
  passed: boolean
  message?: string
  suggestion?: string
}

export interface AccessibilityIssue {
  type: 'error' | 'warning' | 'info'
  rule: string
  element: HTMLElement
  message: string
  suggestion: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
  wcagLevel: 'A' | 'AA' | 'AAA'
  xpath?: string
}

export interface AccessibilityTestResult {
  passed: boolean
  score: number
  issues: AccessibilityIssue[]
  summary: {
    total: number
    errors: number
    warnings: number
    info: number
    byLevel: Record<string, number>
  }
  performance: {
    startTime: number
    endTime: number
    duration: number
  }
}

export interface TestOptions {
  /** Test scope */
  scope?: HTMLElement | string
  /** Included rules */
  includeRules?: string[]
  /** Excluded rules */
  excludeRules?: string[]
  /** WCAG level */
  wcagLevel?: 'A' | 'AA' | 'AAA'
  /** Whether to include performance tests */
  includePerformance?: boolean
}

export function useAccessibilityTesting() {
  const testResults = ref<AccessibilityTestResult | null>(null)
  const isRunning = ref(false)
  const lastTestTime = ref<number | null>(null)
  
  // Test rule definitions
  const testRules = {
    // Image alt text
    'img-alt': {
      name: 'Image alt text',
      wcagLevel: 'A' as const,
      severity: 'critical' as const,
      test: (element: HTMLImageElement) => {
        if (!element.alt && !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby')) {
          return {
            passed: false,
            message: 'Image is missing alt text',
            suggestion: 'Add an alt attribute or an aria-label attribute to the image'
          }
        }
        return { passed: true }
      }
    },
    
    // Form labels
    'form-label': {
      name: 'Form labels',
      wcagLevel: 'A' as const,
      severity: 'critical' as const,
      test: (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => {
        const hasLabel = element.labels && element.labels.length > 0
        const hasAriaLabel = element.getAttribute('aria-label')
        const hasAriaLabelledby = element.getAttribute('aria-labelledby')
        
        if (!hasLabel && !hasAriaLabel && !hasAriaLabelledby) {
          return {
            passed: false,
            message: 'Form control is missing a label',
            suggestion: 'Add a <label> element or an aria-label attribute to the form control'
          }
        }
        return { passed: true }
      }
    },
    
    // Link text
    'link-text': {
      name: 'Link text',
      wcagLevel: 'A' as const,
      severity: 'serious' as const,
      test: (element: HTMLAnchorElement) => {
        const text = element.textContent?.trim()
        const ariaLabel = element.getAttribute('aria-label')
        const title = element.getAttribute('title')
        
        if (!text && !ariaLabel && !title) {
          return {
            passed: false,
            message: 'Link is missing descriptive text',
            suggestion: 'Add descriptive text or an aria-label attribute to the link'
          }
        }
        
        // Check for meaningless link text
        const meaninglessText = ['click here', 'read more', 'more', 'link']
        if (text && meaninglessText.includes(text.toLowerCase())) {
          return {
            passed: false,
            message: 'Link text is not descriptive enough',
            suggestion: 'Use more descriptive link text that explains the purpose or target of the link'
          }
        }
        
        return { passed: true }
      }
    },
    
    // Button text
    'button-text': {
      name: 'Button text',
      wcagLevel: 'A' as const,
      severity: 'critical' as const,
      test: (element: HTMLButtonElement) => {
        const text = element.textContent?.trim()
        const ariaLabel = element.getAttribute('aria-label')
        const ariaLabelledby = element.getAttribute('aria-labelledby')
        
        if (!text && !ariaLabel && !ariaLabelledby) {
          return {
            passed: false,
            message: 'Button is missing a text label',
            suggestion: 'Add text content or an aria-label attribute to the button'
          }
        }
        return { passed: true }
      }
    },
    
    // Color contrast
    'color-contrast': {
      name: 'Color contrast',
      wcagLevel: 'AA' as const,
      severity: 'serious' as const,
      test: (element: HTMLElement) => {
        const style = window.getComputedStyle(element)
        const fontSize = parseFloat(style.fontSize)
        const fontWeight = style.fontWeight
        
        // Simplified contrast check (real applications need a more complex algorithm)
        const backgroundColor = style.backgroundColor
        const color = style.color
        
        // Skip the check for transparent or inherited colors
        if (backgroundColor === 'transparent' || backgroundColor === 'rgba(0, 0, 0, 0)' ||
            color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
          return { passed: true }
        }
        
        // A real contrast calculation should be implemented here
        // For now this is just a placeholder
        return { passed: true }
      }
    },
    
    // Focus indicator
    'focus-indicator': {
      name: 'Focus indicator',
      wcagLevel: 'AA' as const,
      severity: 'serious' as const,
      test: (element: HTMLElement) => {
        if (!element.matches(':focusable')) return { passed: true }
        
        const style = window.getComputedStyle(element, ':focus-visible')
        const outline = style.outline
        const boxShadow = style.boxShadow
        
        if (outline === 'none' && !boxShadow.includes('0 0 0')) {
          return {
            passed: false,
            message: 'Focusable element is missing a focus indicator',
            suggestion: 'Add :focus-visible styles to focusable elements'
          }
        }
        
        return { passed: true }
      }
    },
    
    // Heading hierarchy
    'heading-hierarchy': {
      name: 'Heading hierarchy',
      wcagLevel: 'A' as const,
      severity: 'moderate' as const,
      test: (element: HTMLHeadingElement, context: { lastHeadingLevel?: number }) => {
        const level = parseInt(element.tagName.charAt(1))
        
        if (context.lastHeadingLevel && level > context.lastHeadingLevel + 1) {
          return {
            passed: false,
            message: 'Heading level jump is too large',
            suggestion: 'Make sure heading levels are sequential and do not skip levels'
          }
        }
        
        context.lastHeadingLevel = level
        return { passed: true }
      }
    },
    
    // Language attribute
    'lang-attribute': {
      name: 'Language attribute',
      wcagLevel: 'A' as const,
      severity: 'moderate' as const,
      test: (element: HTMLHtmlElement) => {
        const lang = element.getAttribute('lang')
        
        if (!lang) {
          return {
            passed: false,
            message: 'HTML element is missing the lang attribute',
            suggestion: 'Add a lang attribute to the <html> element, such as lang="en-US"'
          }
        }
        
        return { passed: true }
      }
    },
    
    // ARIA usage
    'aria-usage': {
      name: 'ARIA usage',
      wcagLevel: 'A' as const,
      severity: 'serious' as const,
      test: (element: HTMLElement) => {
        const ariaAttributes = Array.from(element.attributes)
          .filter(attr => attr.name.startsWith('aria-'))
        
        if (ariaAttributes.length === 0) return { passed: true }
        
        // Check for common ARIA errors
        const ariaLabel = element.getAttribute('aria-label')
        const ariaLabelledby = element.getAttribute('aria-labelledby')
        
        if (ariaLabelledby) {
          const labelElement = document.getElementById(ariaLabelledby)
          if (!labelElement) {
            return {
              passed: false,
              message: 'The element referenced by aria-labelledby does not exist',
              suggestion: 'Make sure an element exists for the ID referenced by aria-labelledby'
            }
          }
        }
        
        return { passed: true }
      }
    }
  }
  
  // Get the XPath of an element
  const getElementXPath = (element: HTMLElement): string => {
    if (element.id !== '') {
      return `//*[@id="${element.id}"]`
    }
    
    if (element === document.body) {
      return '/html/body'
    }
    
    const siblings = Array.from(element.parentNode?.children || [])
    const index = siblings.indexOf(element) + 1
    const tagName = element.tagName.toLowerCase()
    
    return `${getElementXPath(element.parentElement!)}/${tagName}[${index}]`
  }
  
  // Run a single test rule
  const runRule = (
    rule: typeof testRules[keyof typeof testRules],
    elements: HTMLElement[],
    context: Record<string, unknown> = {}
  ): AccessibilityIssue[] => {
    const issues: AccessibilityIssue[] = []
    
    elements.forEach(element => {
      try {
        const testFn = rule.test as (el: HTMLElement, ctx: Record<string, unknown>) => TestRuleResult
        const result = testFn(element, context)
        if (!result.passed) {
          const ruleResult = result as TestRuleResult
          issues.push({
            type: rule.severity === 'critical' ? 'error' : rule.severity === 'serious' ? 'warning' : 'info',
            rule: rule.name,
            element,
            message: ruleResult.message || 'Accessibility test failed',
            suggestion: ruleResult.suggestion || 'Please check the accessibility attributes of the element',
            severity: rule.severity,
            wcagLevel: rule.wcagLevel,
            xpath: getElementXPath(element)
          })
        }
      } catch (error) {
        console.warn(`Error running rule ${rule.name}:`, error)
      }
    })
    
    return issues
  }
  
  // Get the test scope
  const getTestScope = (scope?: HTMLElement | string): HTMLElement => {
    if (!scope) return document.body
    
    if (typeof scope === 'string') {
      const element = document.querySelector(scope) as HTMLElement
      return element || document.body
    }
    
    return scope
  }
  
  // Run the accessibility tests
  const runTest = async (options: TestOptions = {}): Promise<AccessibilityTestResult> => {
    isRunning.value = true
    const startTime = performance.now()
    
    try {
      const scope = getTestScope(options.scope)
      const issues: AccessibilityIssue[] = []
      const context: Record<string, unknown> = {}
      
      // Select the rules to run
      const rulesToRun = Object.entries(testRules).filter(([ruleName, rule]) => {
        if (options.includeRules && !options.includeRules.includes(ruleName)) return false
        if (options.excludeRules && options.excludeRules.includes(ruleName)) return false
        if (options.wcagLevel) {
          const levels = ['A', 'AA', 'AAA']
          const maxLevel = levels.indexOf(options.wcagLevel)
          const ruleLevel = levels.indexOf(rule.wcagLevel)
          if (ruleLevel > maxLevel) return false
        }
        return true
      })
      
      // Run the tests
      for (const [ruleName, rule] of rulesToRun) {
        let elements: HTMLElement[] = []
        
        switch (ruleName) {
          case 'img-alt':
            elements = Array.from(scope.querySelectorAll('img')) as HTMLElement[]
            break
          case 'form-label':
            elements = Array.from(scope.querySelectorAll('input, textarea, select')) as HTMLElement[]
            break
          case 'link-text':
            elements = Array.from(scope.querySelectorAll('a[href]')) as HTMLElement[]
            break
          case 'button-text':
            elements = Array.from(scope.querySelectorAll('button')) as HTMLElement[]
            break
          case 'color-contrast':
            elements = Array.from(scope.querySelectorAll('*')).filter(el => {
              const text = el.textContent?.trim()
              return text && text.length > 0
            }) as HTMLElement[]
            break
          case 'focus-indicator':
            elements = Array.from(scope.querySelectorAll(
              'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
            )) as HTMLElement[]
            break
          case 'heading-hierarchy':
            elements = Array.from(scope.querySelectorAll('h1, h2, h3, h4, h5, h6')) as HTMLElement[]
            break
          case 'lang-attribute':
            elements = [document.documentElement] as HTMLElement[]
            break
          case 'aria-usage':
            elements = Array.from(scope.querySelectorAll('[aria-label], [aria-labelledby], [role]')) as HTMLElement[]
            break
          default:
            elements = [scope]
        }
        
        const ruleIssues = runRule(rule, elements, context)
        issues.push(...ruleIssues)
      }
      
      const endTime = performance.now()
      
      // Generate the test report
      const summary = {
        total: issues.length,
        errors: issues.filter(i => i.type === 'error').length,
        warnings: issues.filter(i => i.type === 'warning').length,
        info: issues.filter(i => i.type === 'info').length,
        byLevel: {
          A: issues.filter(i => i.wcagLevel === 'A').length,
          AA: issues.filter(i => i.wcagLevel === 'AA').length,
          AAA: issues.filter(i => i.wcagLevel === 'AAA').length
        }
      }
      
      // Compute the score (out of 100)
      const maxPoints = 100
      const errorDeduction = summary.errors * 20
      const warningDeduction = summary.warnings * 10
      const infoDeduction = summary.info * 2
      
      const score = Math.max(0, maxPoints - errorDeduction - warningDeduction - infoDeduction)
      
      const result: AccessibilityTestResult = {
        passed: summary.errors === 0,
        score,
        issues,
        summary,
        performance: {
          startTime,
          endTime,
          duration: endTime - startTime
        }
      }
      
      testResults.value = result
      lastTestTime.value = Date.now()
      
      return result
      
    } finally {
      isRunning.value = false
    }
  }
  
  // Generate the test report
  const generateReport = (result?: AccessibilityTestResult) => {
    const data = result || testResults.value
    if (!data) return null
    
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        passed: data.passed,
        score: data.score,
        issues: data.summary
      },
      details: data.issues.map(issue => ({
        type: issue.type,
        rule: issue.rule,
        message: issue.message,
        suggestion: issue.suggestion,
        severity: issue.severity,
        wcagLevel: issue.wcagLevel,
        xpath: issue.xpath
      })),
      performance: data.performance
    }
    
    return report
  }
  
  // Export the report
  const exportReport = (format: 'json' | 'csv' | 'html' = 'json') => {
    const report = generateReport()
    if (!report) return null
    
    switch (format) {
      case 'json':
        return JSON.stringify(report, null, 2)
        
      case 'csv': {
        const headers = ['Type', 'Rule', 'Message', 'Suggestion', 'Severity', 'WCAG Level', 'XPath']
        const rows = report.details.map(issue => [
          issue.type,
          issue.rule,
          issue.message,
          issue.suggestion,
          issue.severity,
          issue.wcagLevel,
          issue.xpath || ''
        ])

        return [headers, ...rows].map(row =>
          row.map(cell => `"${cell?.toString().replace(/"/g, '""') || ''}"`).join(',')
        ).join('\n')
      }

      case 'html': {
        return `
          <!DOCTYPE html>
          <html lang="zh-CN">
          <head>
            <meta charset="UTF-8">
            <title>Accessibility Test Report</title>
            <style>
              body { font-family: sans-serif; margin: 20px; }
              .score { font-size: 24px; font-weight: bold; margin: 20px 0; }
              .score.passed { color: green; }
              .score.failed { color: red; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: #f2f2f2; }
              .error { color: red; }
              .warning { color: orange; }
              .info { color: blue; }
            </style>
          </head>
          <body>
            <h1>Accessibility Test Report</h1>
            <p>Test time: ${new Date(report.timestamp).toLocaleString('en-US')}</p>
            <div class="score ${report.summary.passed ? 'passed' : 'failed'}">
              Test score: ${report.summary.score}/100 ${report.summary.passed ? '(Passed)' : '(Failed)'}
            </div>
            <h2>Issue summary</h2>
            <p>Total: ${report.summary.issues.total} | Errors: ${report.summary.issues.errors} | Warnings: ${report.summary.issues.warnings} | Info: ${report.summary.issues.info}</p>
            <h2>Issue details</h2>
            <table>
              <tr>
                <th>Type</th>
                <th>Rule</th>
                <th>Message</th>
                <th>Suggestion</th>
                <th>Severity</th>
                <th>WCAG level</th>
              </tr>
              ${report.details.map(issue => `
                <tr>
                  <td class="${issue.type}">${issue.type}</td>
                  <td>${issue.rule}</td>
                  <td>${issue.message}</td>
                  <td>${issue.suggestion}</td>
                  <td>${issue.severity}</td>
                  <td>${issue.wcagLevel}</td>
                </tr>
              `).join('')}
            </table>
          </body>
          </html>
        `
      }
    }
  }
  
  // Computed properties
  const hasResults = computed(() => testResults.value !== null)
  const lastScore = computed(() => testResults.value?.score || 0)
  const lastPassed = computed(() => testResults.value?.passed || false)
  
  return {
    // State
    testResults,
    isRunning,
    lastTestTime,
    hasResults,
    lastScore,
    lastPassed,
    
    // Methods
    runTest,
    generateReport,
    exportReport
  }
}
