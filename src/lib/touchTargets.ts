/**
 * Touch Target Utilities
 * Ensures accessible touch targets per WCAG 2.5.5 Target Size (A11Y-004)
 * Minimum 48x48 CSS pixels for touch targets
 * 8px spacing between targets recommended
 */

/**
 * Touch Target Size Standards
 * WCAG 2.5.5 Target Size Level AAA
 */
export enum TouchTargetSize {
  /** Minimum WCAG AAA: 48x48 CSS pixels */
  MINIMUM = 48,
  /** Recommended for mobile: 56x56 CSS pixels */
  MOBILE = 56,
  /** Large touch target for better accessibility: 64x64 CSS pixels */
  LARGE = 64,
}

/**
 * Spacing between touch targets
 */
export enum TouchTargetSpacing {
  /** Minimum recommended spacing: 8px */
  MINIMUM = 8,
  /** Comfortable spacing: 12px */
  COMFORTABLE = 12,
  /** Generous spacing for elderly/motor impairments: 16px */
  GENEROUS = 16,
}

/**
 * Touch target configuration options
 */
export interface TouchTargetOptions {
  /** Minimum size in pixels (default: 48) */
  minSize?: number;
  /** Minimum spacing in pixels (default: 8) */
  minSpacing?: number;
  /** Include pseudo-element padding in calculation */
  includePseudoElements?: boolean;
  /** Ignore elements with this data attribute */
  ignoreSelector?: string;
  /** Custom focusable element selector */
  focusableSelector?: string;
}

/**
 * Touch target issue information
 */
export interface TouchTargetIssue {
  element: HTMLElement;
  width: number;
  height: number;
  actualSize: number; // minimum of width/height
  x: number;
  y: number;
  nearbyElement?: HTMLElement;
  spacing?: number;
  meetsMinimum: boolean;
  meetsRecommended: boolean;
}

/**
 * Default focusable selectors
 */
const DEFAULT_FOCUSABLE_SELECTORS = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[tabindex]:not([tabindex="-1"])',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="gridcell"]',
];

/**
 * Calculate the size of a touch target element
 */
export function getTouchTargetSize(element: HTMLElement): {
  width: number;
  height: number;
  actualSize: number;
} {
  const rect = element.getBoundingClientRect();
  const computed = window.getComputedStyle(element);

  const paddingTop = parseFloat(computed.paddingTop) || 0;
  const paddingBottom = parseFloat(computed.paddingBottom) || 0;
  const paddingLeft = parseFloat(computed.paddingLeft) || 0;
  const paddingRight = parseFloat(computed.paddingRight) || 0;

  const widthFromStyle = parseFloat(computed.width) || parseFloat(element.style.width) || 0;
  const heightFromStyle = parseFloat(computed.height) || parseFloat(element.style.height) || 0;

  const fontSize = parseFloat(computed.fontSize) || 16;
  const lineHeight = parseFloat(computed.lineHeight) || fontSize * 1.2;
  const textLength = (element.textContent || '').trim().length;
  const textWidth = textLength ? textLength * fontSize * 0.6 : 0;
  const textHeight = textLength ? lineHeight : 0;

  const widthCandidates = [
    rect.width,
    element.offsetWidth,
    element.scrollWidth,
    widthFromStyle,
    textWidth
  ];
  const heightCandidates = [
    rect.height,
    element.offsetHeight,
    element.scrollHeight,
    heightFromStyle,
    textHeight
  ];

  let width = Math.max(...widthCandidates);
  let height = Math.max(...heightCandidates);

  if (width === widthFromStyle || width === textWidth) {
    width += paddingLeft + paddingRight;
  }

  if (height === heightFromStyle || height === textHeight) {
    height += paddingTop + paddingBottom;
  }

  // Include margins for total touchable area
  const marginTop = parseFloat(computed.marginTop) || 0;
  const marginBottom = parseFloat(computed.marginBottom) || 0;
  const marginLeft = parseFloat(computed.marginLeft) || 0;
  const marginRight = parseFloat(computed.marginRight) || 0;

  // Calculate total touchable area
  const totalWidth = width + marginLeft + marginRight;
  const totalHeight = height + marginTop + marginBottom;

  const actualSize = Math.min(totalWidth, totalHeight);

  return {
    width: totalWidth,
    height: totalHeight,
    actualSize,
  };
}

function getElementRect(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  if (rect.width || rect.height) {
    return rect;
  }

  const computed = window.getComputedStyle(element);
  const width = parseFloat(computed.width) || parseFloat(element.style.width) || 0;
  const height = parseFloat(computed.height) || parseFloat(element.style.height) || 0;
  const left = parseFloat(computed.left) || parseFloat(element.style.left) || 0;
  const top = parseFloat(computed.top) || parseFloat(element.style.top) || 0;

  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  } as DOMRect;
}

/**
 * Check if element meets minimum touch target size
 */
export function meetsMinimumSize(
  element: HTMLElement,
  minSize: number = TouchTargetSize.MINIMUM
): boolean {
  const { actualSize } = getTouchTargetSize(element);
  return actualSize >= minSize;
}

/**
 * Get all interactive elements on page
 */
export function getInteractiveElements(
  container: HTMLElement = document.body,
  options: TouchTargetOptions = {}
): HTMLElement[] {
  const {
    focusableSelector = DEFAULT_FOCUSABLE_SELECTORS.join(','),
    ignoreSelector,
  } = options;

  const interactive: HTMLElement[] = [];

  try {
    const elements = container.querySelectorAll(focusableSelector);

    elements.forEach((el) => {
      const element = el as HTMLElement;

      const computed = window.getComputedStyle(element);

      // Skip hidden elements
      if (computed.display === 'none' || computed.visibility === 'hidden') return;

      // Skip ignored elements
      if (ignoreSelector && element.matches(ignoreSelector)) return;

      // Skip disabled elements
      if ((element as any).disabled) return;

      // Skip elements with pointer-events: none
      if (computed.pointerEvents === 'none') return;

      interactive.push(element);
    });
  } catch (error) {
    devError('Error querying focusable elements:', error);
  }

  return interactive;
}

/**
 * Find the nearest interactive element
 */
export function findNearestInteractiveElement(
  element: HTMLElement,
  threshold: number = 100,
  allElements: HTMLElement[] = []
): HTMLElement | null {
  if (allElements.length === 0) {
    allElements = getInteractiveElements();
  }

  const rect = getElementRect(element);
  const center = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };

  let nearest: HTMLElement | null = null;
  let minDistance = threshold;

  allElements.forEach((el) => {
    if (el === element) return;

    const elRect = getElementRect(el);
    const elCenter = {
      x: elRect.left + elRect.width / 2,
      y: elRect.top + elRect.height / 2,
    };

    // Calculate distance between centers
    const dx = elCenter.x - center.x;
    const dy = elCenter.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      nearest = el;
    }
  });

  return nearest;
}

/**
 * Calculate spacing between two elements
 */
export function getSpacingBetween(
  element1: HTMLElement,
  element2: HTMLElement
): number {
  const rect1 = getElementRect(element1);
  const rect2 = getElementRect(element2);

  const gapX = Math.max(0, Math.max(rect2.left - rect1.right, rect1.left - rect2.right));
  const gapY = Math.max(0, Math.max(rect2.top - rect1.bottom, rect1.top - rect2.bottom));

  if (gapX === 0 && gapY === 0) {
    return 0;
  }

  if (gapX === 0) {
    return gapY;
  }

  if (gapY === 0) {
    return gapX;
  }

  return Math.sqrt(gapX * gapX + gapY * gapY);
}

/**
 * Audit touch targets on a page
 */
export function auditTouchTargets(
  container: HTMLElement = document.body,
  options: TouchTargetOptions = {}
): TouchTargetIssue[] {
  const {
    minSize = TouchTargetSize.MINIMUM,
    minSpacing = TouchTargetSpacing.MINIMUM,
  } = options;

  const issues: TouchTargetIssue[] = [];
  const interactive = getInteractiveElements(container, options);

  interactive.forEach((element) => {
    const size = getTouchTargetSize(element);
    const meetsMin = size.actualSize >= minSize;

    // Check minimum size
    if (!meetsMin) {
      issues.push({
        element,
        width: size.width,
        height: size.height,
        actualSize: size.actualSize,
        x: element.getBoundingClientRect().left,
        y: element.getBoundingClientRect().top,
        meetsMinimum: false,
        meetsRecommended: false,
      });
    }

    // Check spacing to nearest element
    const nearest = findNearestInteractiveElement(element, Infinity, interactive);
    if (nearest) {
      const spacing = getSpacingBetween(element, nearest);
      if (spacing < minSpacing && !meetsMin) {
        // Only report spacing issue if element is already too small
        const issue = issues.find((i) => i.element === element);
        if (issue) {
          issue.nearbyElement = nearest;
          issue.spacing = spacing;
        }
      }
    }
  });

  return issues;
}

/**
 * Validate interactive element has adequate touch target
 * Returns detailed information about compliance
 */
export function validateTouchTarget(
  element: HTMLElement,
  options: TouchTargetOptions = {}
): {
  valid: boolean;
  size: number;
  minSize: number;
  issues: string[];
  recommendations: string[];
} {
  const { minSize = TouchTargetSize.MINIMUM } = options;
  const { actualSize } = getTouchTargetSize(element);
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (actualSize < minSize) {
    issues.push(`Touch target too small: ${actualSize}px (minimum: ${minSize}px)`);
    recommendations.push(`Increase element size or padding to at least ${minSize}px`);
  }

  if (actualSize >= minSize && actualSize < TouchTargetSize.MOBILE) {
    recommendations.push(
      `Consider increasing to ${TouchTargetSize.MOBILE}px for better mobile experience`
    );
  }

  // Check for nearby elements
  const nearest = findNearestInteractiveElement(element, 100);
  if (nearest) {
    const spacing = getSpacingBetween(element, nearest);
    if (spacing < TouchTargetSpacing.MINIMUM) {
      issues.push(`Insufficient spacing from nearby element: ${spacing}px`);
      recommendations.push(
        `Add at least ${TouchTargetSpacing.MINIMUM}px spacing between touch targets`
      );
    }
  }

  return {
    valid: issues.length === 0,
    size: actualSize,
    minSize,
    issues,
    recommendations,
  };
}

/**
 * Generate a detailed audit report
 */
export function generateTouchTargetReport(issues: TouchTargetIssue[]): string {
  let report = '# Touch Target Audit Report\n\n';
  report += `**Total Issues Found:** ${issues.length}\n\n`;

  if (issues.length === 0) {
    report += '✅ All interactive elements meet WCAG 2.5.5 touch target requirements!\n';
    return report;
  }

  report += '## Issues Found\n\n';

  issues.forEach((issue, index) => {
    report += `### Issue ${index + 1}\n`;
    report += `- **Element:** ${issue.element.tagName}.${issue.element.className || 'no-class'}\n`;
    report += `- **Current Size:** ${Math.round(issue.actualSize)}px (Width: ${Math.round(issue.width)}px, Height: ${Math.round(issue.height)}px)\n`;
    report += `- **Minimum Required:** ${TouchTargetSize.MINIMUM}px\n`;
    report += `- **Shortfall:** ${Math.round(TouchTargetSize.MINIMUM - issue.actualSize)}px\n`;

    if (issue.spacing !== undefined && issue.nearbyElement) {
      report += `- **Spacing to Nearest Element:** ${Math.round(issue.spacing)}px (minimum: ${TouchTargetSpacing.MINIMUM}px)\n`;
    }

    report += `- **Location:** (${Math.round(issue.x)}, ${Math.round(issue.y)})\n`;
    report += '\n';
  });

  return report;
}

/**
 * React hook for touch target validation
 */
export function useTouchTargetAudit(
  containerRef: React.RefObject<HTMLElement>,
  options: TouchTargetOptions = {}
) {
  const [issues, setIssues] = React.useState<TouchTargetIssue[]>([]);
  const [isValid, setIsValid] = React.useState(true);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const auditIssues = auditTouchTargets(containerRef.current, options);
    setIssues(auditIssues);
    setIsValid(auditIssues.length === 0);
  }, [containerRef, options]);

  return { issues, isValid, report: generateTouchTargetReport(issues) };
}

/**
 * React hook for element touch target validation
 */
export function useTouchTargetValidation(
  elementRef: React.RefObject<HTMLElement>,
  options: TouchTargetOptions = {}
) {
  const [validation, setValidation] = React.useState<ReturnType<
    typeof validateTouchTarget
  > | null>(null);

  React.useEffect(() => {
    if (!elementRef.current) return;

    const result = validateTouchTarget(elementRef.current, options);
    setValidation(result);
  }, [elementRef, options]);

  return validation;
}

/**
 * Utility to enhance an element with touch target requirements
 * Adds padding if needed to meet minimum size
 */
export function enhanceTouchTarget(
  element: HTMLElement,
  minSize: number = TouchTargetSize.MINIMUM
): { paddingAdded: boolean; originalPadding: string; newPadding: string } {
  const { actualSize } = getTouchTargetSize(element);
  const computed = window.getComputedStyle(element);
  const originalPadding = computed.padding;

  if (actualSize < minSize) {
    // Calculate padding needed
    const shortfall = minSize - actualSize;
    const paddingNeeded = shortfall / 2;
    const currentPadding = parseFloat(computed.padding) || 0;
    const newPadding = currentPadding + paddingNeeded;

    element.style.padding = `${newPadding}px`;

    return {
      paddingAdded: true,
      originalPadding,
      newPadding: `${newPadding}px`,
    };
  }

  return {
    paddingAdded: false,
    originalPadding,
    newPadding: originalPadding,
  };
}

/**
 * Get recommended size for a button group
 */
export function calculateOptimalButtonGroupLayout(
  buttonCount: number,
  containerWidth: number,
  minButtonSize: number = TouchTargetSize.MINIMUM,
  spacing: number = TouchTargetSpacing.MINIMUM
): {
  buttonsPerRow: number;
  buttonWidth: number;
  buttonHeight: number;
  fits: boolean;
} {
  // Calculate how many buttons fit per row
  const totalSpacingPerRow = (buttonCount - 1) * spacing;
  const availableWidth = containerWidth - totalSpacingPerRow;
  const buttonsPerRow = Math.max(
    1,
    Math.floor(availableWidth / minButtonSize)
  );

  const totalWidth = buttonsPerRow * minButtonSize + (buttonsPerRow - 1) * spacing;
  const fits = totalWidth <= containerWidth;

  return {
    buttonsPerRow,
    buttonWidth: minButtonSize,
    buttonHeight: minButtonSize,
    fits,
  };
}

// Import React for hooks
import * as React from 'react';
import { devError } from './logger';
