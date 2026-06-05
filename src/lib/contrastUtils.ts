/**
 * Contrast Utilities and Color Audit
 * Ensures WCAG AA/AAA contrast ratios (A11Y-003)
 * Provides utilities for checking color contrast and accessibility
 */

/**
 * WCAG Contrast Level Standards
 */
export enum ContrastLevel {
  /** WCAG AA: 4.5:1 for normal text, 3:1 for large text */
  AA = 'AA',
  /** WCAG AAA: 7:1 for normal text, 4.5:1 for large text */
  AAA = 'AAA',
  /** Minimum: 3:1 for UI components */
  MINIMUM = 'MINIMUM',
}

/**
 * Calculate relative luminance of a color
 * Per WCAG 2.0 definition
 */
export function getLuminance(color: string): number {
  // Convert hex to RGB
  const rgb = hexToRgb(color);
  if (!rgb) return 0;

  const { r, g, b } = rgb;

  // Normalize to 0-1
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;

  // Apply gamma correction
  const rLinear = rNorm <= 0.03928 ? rNorm / 12.92 : Math.pow((rNorm + 0.055) / 1.055, 2.4);
  const gLinear = gNorm <= 0.03928 ? gNorm / 12.92 : Math.pow((gNorm + 0.055) / 1.055, 2.4);
  const bLinear = bNorm <= 0.03928 ? bNorm / 12.92 : Math.pow((bNorm + 0.055) / 1.055, 2.4);

  // Calculate luminance
  return 0.2126 * rLinear + 0.7152 * gLinear + 0.0722 * bLinear;
}

/**
 * Calculate contrast ratio between two colors
 * Returns ratio from 1 to 21 (higher is better)
 */
export function getContrastRatio(color1: string, color2: string): number {
  const lum1 = getLuminance(color1);
  const lum2 = getLuminance(color2);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG level
 */
export function meetsContrastLevel(
  color1: string,
  color2: string,
  level: ContrastLevel,
  fontSize: 'normal' | 'large' = 'normal'
): boolean {
  const ratio = getContrastRatio(color1, color2);

  if (level === ContrastLevel.AAA) {
    // AAA: 7:1 normal, 4.5:1 large
    return fontSize === 'large' ? ratio >= 4.5 : ratio >= 7;
  } else if (level === ContrastLevel.AA) {
    // AA: 4.5:1 normal, 3:1 large
    return fontSize === 'large' ? ratio >= 3 : ratio >= 4.5;
  } else {
    // Minimum: 3:1
    return ratio >= 3;
  }
}

/**
 * Convert hex color to RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Handle short hex (e.g., #fff)
  if (hex.length === 3) {
    hex = hex
      .split('')
      .map((char) => char + char)
      .join('');
  }

  if (hex.length !== 6) {
    return null;
  }

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) {
    return null;
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  return { r, g, b };
}

/**
 * Convert RGB to hex color
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => {
    const hex = x.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}

/**
 * Get a more accessible color from two options
 * Returns the color pair with better contrast
 */
export function getAccessibleColor(
  foreground: string,
  background: string,
  alternativeForeground: string,
  targetLevel: ContrastLevel = ContrastLevel.AA
): string {
  const ratio1 = getContrastRatio(foreground, background);
  const ratio2 = getContrastRatio(alternativeForeground, background);

  return ratio1 >= ratio2 ? foreground : alternativeForeground;
}

/**
 * Lighten a color (for better contrast on dark backgrounds)
 */
export function lightenColor(color: string, percent: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const factor = 1 + percent / 100;
  const r = Math.min(255, Math.round(rgb.r * factor));
  const g = Math.min(255, Math.round(rgb.g * factor));
  const b = Math.min(255, Math.round(rgb.b * factor));

  return rgbToHex(r, g, b);
}

/**
 * Darken a color (for better contrast on light backgrounds)
 */
export function darkenColor(color: string, percent: number): string {
  const rgb = hexToRgb(color);
  if (!rgb) return color;

  const factor = 1 - percent / 100;
  const r = Math.round(rgb.r * factor);
  const g = Math.round(rgb.g * factor);
  const b = Math.round(rgb.b * factor);

  return rgbToHex(r, g, b);
}

/**
 * Audit color combinations in a container
 * Returns array of contrast issues found
 */
export interface ContrastIssue {
  element: HTMLElement;
  foreground: string;
  background: string;
  ratio: number;
  level: ContrastLevel;
  meetsAA: boolean;
  meetsAAA: boolean;
  fontSize: string;
}

export function auditContrast(
  container: HTMLElement = document.body
): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  // Get all text elements
  const walker = document.createTreeWalker(
    container,
    NodeFilter.SHOW_ELEMENT,
    null
  );

  let node: Element | null;
  while ((node = walker.nextNode() as Element | null)) {
    const element = node as HTMLElement;

    // Skip non-visible elements
    if (!element.offsetParent) continue;

    // Skip scripts, styles, etc.
    if (['SCRIPT', 'STYLE', 'META', 'LINK'].includes(element.tagName)) {
      continue;
    }

    const styles = window.getComputedStyle(element);
    const foreground = styles.color;
    const background = styles.backgroundColor;
    const fontSize = styles.fontSize;

    // Skip if no text content or no background color
    if (!element.textContent?.trim() || background === 'transparent' || background === 'rgba(0, 0, 0, 0)') {
      continue;
    }

    // Convert to hex for analysis
    const fgHex = rgbStringToHex(foreground);
    const bgHex = rgbStringToHex(background);

    if (!fgHex || !bgHex) continue;

    const ratio = getContrastRatio(fgHex, bgHex);
    const isLarge = parseInt(fontSize) >= 18 || (parseInt(fontSize) >= 14 && element.style.fontWeight === 'bold');

    const meetsAA = meetsContrastLevel(fgHex, bgHex, ContrastLevel.AA, isLarge ? 'large' : 'normal');
    const meetsAAA = meetsContrastLevel(fgHex, bgHex, ContrastLevel.AAA, isLarge ? 'large' : 'normal');

    if (!meetsAA) {
      issues.push({
        element,
        foreground: fgHex,
        background: bgHex,
        ratio: Math.round(ratio * 100) / 100,
        level: ContrastLevel.AA,
        meetsAA,
        meetsAAA,
        fontSize,
      });
    }
  }

  return issues;
}

/**
 * Convert RGB string to hex
 */
function rgbStringToHex(rgb: string): string | null {
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;

  const r = parseInt(match[1]);
  const g = parseInt(match[2]);
  const b = parseInt(match[3]);

  return rgbToHex(r, g, b);
}

/**
 * Generate a contrast report
 */
export function generateContrastReport(issues: ContrastIssue[]): string {
  let report = '# Contrast Audit Report\n\n';
  report += `**Total Issues Found:** ${issues.length}\n\n`;

  if (issues.length === 0) {
    report += '✅ All text combinations meet WCAG AA contrast requirements!\n';
    return report;
  }

  report += '## Issues Found\n\n';

  issues.forEach((issue, index) => {
    report += `### Issue ${index + 1}\n`;
    report += `- **Element:** ${issue.element.tagName}.${issue.element.className || 'no-class'}\n`;
    report += `- **Foreground:** ${issue.foreground}\n`;
    report += `- **Background:** ${issue.background}\n`;
    report += `- **Contrast Ratio:** ${issue.ratio}:1\n`;
    report += `- **Font Size:** ${issue.fontSize}\n`;
    report += `- **Meets AA (4.5:1):** ${issue.meetsAA ? '✅' : '❌'}\n`;
    report += `- **Meets AAA (7:1):** ${issue.meetsAAA ? '✅' : '❌'}\n`;
    report += '\n';
  });

  return report;
}

/**
 * Color palette definition for accessibility
 */
export interface AccessibleColorPalette {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;

  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textOnPrimary: string;

  // Background colors
  bgLight: string;
  bgDark: string;
  bgNeutral: string;

  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;

  // Utility
  border: string;
  borderLight: string;
  borderDark: string;
}

/**
 * Validate a color palette for accessibility
 */
export function validatePalette(palette: AccessibleColorPalette): string[] {
  const errors: string[] = [];

  // Text on background combinations
  const textChecks = [
    { fg: palette.textPrimary, bg: palette.bgLight, name: 'Text Primary on Light BG' },
    { fg: palette.textPrimary, bg: palette.bgDark, name: 'Text Primary on Dark BG' },
    { fg: palette.textSecondary, bg: palette.bgLight, name: 'Text Secondary on Light BG' },
    { fg: palette.textOnPrimary, bg: palette.primary, name: 'Text on Primary Button' },
  ];

  textChecks.forEach(({ fg, bg, name }) => {
    if (!meetsContrastLevel(fg, bg, ContrastLevel.AA)) {
      const ratio = getContrastRatio(fg, bg);
      errors.push(`${name}: ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
    }
  });

  // Status colors on backgrounds
  const statusChecks = [
    { color: palette.success, bg: palette.bgLight, name: 'Success on Light BG' },
    { color: palette.warning, bg: palette.bgLight, name: 'Warning on Light BG' },
    { color: palette.error, bg: palette.bgLight, name: 'Error on Light BG' },
    { color: palette.info, bg: palette.bgLight, name: 'Info on Light BG' },
  ];

  statusChecks.forEach(({ color, bg, name }) => {
    if (!meetsContrastLevel(color, bg, ContrastLevel.AA)) {
      const ratio = getContrastRatio(color, bg);
      errors.push(`${name}: ${ratio.toFixed(2)}:1 (needs 4.5:1)`);
    }
  });

  return errors;
}

/**
 * Predefined accessible color palettes
 */
export const ACCESSIBLE_PALETTES = {
  // Light mode palette (high contrast)
  light: {
    primary: '#0066cc',
    primaryLight: '#4d94ff',
    primaryDark: '#004199',
    textPrimary: '#000000',
    textSecondary: '#333333',
    textMuted: '#666666',
    textOnPrimary: '#ffffff',
    bgLight: '#ffffff',
    bgDark: '#f5f5f5',
    bgNeutral: '#f0f0f0',
    success: '#007a2e',
    warning: '#7a4a00',
    error: '#d32f2f',
    info: '#0066cc',
    border: '#cccccc',
    borderLight: '#e0e0e0',
    borderDark: '#999999',
  } as AccessibleColorPalette,

  // Dark mode palette (high contrast)
  dark: {
    primary: '#4da6ff',
    primaryLight: '#80c0ff',
    primaryDark: '#1a7aff',
    textPrimary: '#ffffff',
    textSecondary: '#e0e0e0',
    textMuted: '#999999',
    textOnPrimary: '#000000',
    bgLight: '#1a1a1a',
    bgDark: '#000000',
    bgNeutral: '#2d2d2d',
    success: '#4caf50',
    warning: '#ffb74d',
    error: '#ff6b6b',
    info: '#4da6ff',
    border: '#404040',
    borderLight: '#555555',
    borderDark: '#1a1a1a',
  } as AccessibleColorPalette,

  // High contrast mode (for accessibility)
  highContrast: {
    primary: '#0000cc',
    primaryLight: '#6666ff',
    primaryDark: '#000099',
    textPrimary: '#000000',
    textSecondary: '#000000',
    textMuted: '#333333',
    textOnPrimary: '#ffffff',
    bgLight: '#ffffff',
    bgDark: '#ffffff',
    bgNeutral: '#f0f0f0',
    success: '#008000',
    warning: '#663300',
    error: '#cc0000',
    info: '#0000cc',
    border: '#000000',
    borderLight: '#666666',
    borderDark: '#000000',
  } as AccessibleColorPalette,
};
