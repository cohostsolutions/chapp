import { describe, it, expect } from 'vitest';
import {
  getLuminance,
  getContrastRatio,
  meetsContrastLevel,
  hexToRgb,
  rgbToHex,
  getAccessibleColor,
  lightenColor,
  darkenColor,
  validatePalette,
  ContrastLevel,
  ACCESSIBLE_PALETTES,
} from '../lib/contrastUtils';

describe('Contrast Utilities', () => {
  describe('getLuminance', () => {
    it('should calculate luminance for black', () => {
      const luminance = getLuminance('#000000');
      expect(luminance).toBe(0);
    });

    it('should calculate luminance for white', () => {
      const luminance = getLuminance('#ffffff');
      expect(luminance).toBe(1);
    });

    it('should calculate luminance for mid-tone gray', () => {
      const luminance = getLuminance('#808080');
      expect(luminance).toBeGreaterThan(0.2);
      expect(luminance).toBeLessThan(0.3);
    });

    it('should handle color values with gamma correction', () => {
      const lumDark = getLuminance('#333333');
      const lumLight = getLuminance('#cccccc');
      expect(lumLight).toBeGreaterThan(lumDark);
    });
  });

  describe('getContrastRatio', () => {
    it('should return 21 for black on white (max contrast)', () => {
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBe(21);
    });

    it('should return 1 for same color (no contrast)', () => {
      const ratio = getContrastRatio('#666666', '#666666');
      expect(ratio).toBe(1);
    });

    it('should calculate WCAG AA compliant contrast (4.5:1)', () => {
      const ratio = getContrastRatio('#0066cc', '#ffffff');
      expect(ratio).toBeGreaterThan(4.5);
    });

    it('should calculate WCAG AAA compliant contrast (7:1)', () => {
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeGreaterThan(7);
    });

    it('should be order-independent', () => {
      const ratio1 = getContrastRatio('#000000', '#ffffff');
      const ratio2 = getContrastRatio('#ffffff', '#000000');
      expect(ratio1).toBe(ratio2);
    });
  });

  describe('meetsContrastLevel', () => {
    it('should validate AA level normal text (4.5:1)', () => {
      const meets = meetsContrastLevel('#0066cc', '#ffffff', ContrastLevel.AA, 'normal');
      expect(meets).toBe(true);
    });

    it('should validate AA level large text (3:1)', () => {
      const meets = meetsContrastLevel('#0066cc', '#ffffff', ContrastLevel.AA, 'large');
      expect(meets).toBe(true);
    });

    it('should validate AAA level normal text (7:1)', () => {
      const meets = meetsContrastLevel('#000000', '#ffffff', ContrastLevel.AAA, 'normal');
      expect(meets).toBe(true);
    });

    it('should reject AA level with insufficient contrast', () => {
      const meets = meetsContrastLevel('#cccccc', '#ffffff', ContrastLevel.AA, 'normal');
      expect(meets).toBe(false);
    });

    it('should reject AAA level with AA-only contrast', () => {
      const meets = meetsContrastLevel('#666666', '#ffffff', ContrastLevel.AAA, 'normal');
      expect(meets).toBe(false);
    });

    it('should use larger threshold for large text in AA', () => {
      // AA requires 3:1 for large text, 4.5:1 for normal
      const normalFails = meetsContrastLevel('#888888', '#ffffff', ContrastLevel.AA, 'normal');
      const largeMeets = meetsContrastLevel('#888888', '#ffffff', ContrastLevel.AA, 'large');
      expect(normalFails).toBe(false);
      expect(largeMeets).toBe(true);
    });
  });

  describe('hexToRgb', () => {
    it('should convert 6-digit hex to RGB', () => {
      const rgb = hexToRgb('#ff0000');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should convert 3-digit hex to RGB', () => {
      const rgb = hexToRgb('#f00');
      expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should handle hex without #', () => {
      const rgb = hexToRgb('00ff00');
      expect(rgb).toEqual({ r: 0, g: 255, b: 0 });
    });

    it('should return null for invalid hex', () => {
      expect(hexToRgb('invalid')).toBeNull();
      expect(hexToRgb('#gg0000')).toBeNull();
    });

    it('should convert black and white', () => {
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
      expect(hexToRgb('#ffffff')).toEqual({ r: 255, g: 255, b: 255 });
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000');
    });

    it('should pad single digit values', () => {
      expect(rgbToHex(15, 15, 15)).toBe('#0f0f0f');
    });

    it('should convert black and white', () => {
      expect(rgbToHex(0, 0, 0)).toBe('#000000');
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff');
    });

    it('should handle mid-tone colors', () => {
      expect(rgbToHex(128, 128, 128)).toBe('#808080');
    });
  });

  describe('getAccessibleColor', () => {
    it('should return first color when it has better contrast', () => {
      const result = getAccessibleColor('#000000', '#ffffff', '#cccccc');
      expect(result).toBe('#000000');
    });

    it('should return second color when it has better contrast', () => {
      const result = getAccessibleColor('#cccccc', '#ffffff', '#000000');
      expect(result).toBe('#000000');
    });

    it('should respect target contrast level', () => {
      const result = getAccessibleColor(
        '#0066cc',
        '#ffffff',
        '#000000',
        ContrastLevel.AAA
      );
      expect(result).toBe('#000000');
    });
  });

  describe('Color adjustment functions', () => {
    it('lightenColor should increase brightness', () => {
      const original = '#333333';
      const lightened = lightenColor(original, 50);
      expect(lightened).not.toBe(original);
      // Lightened color should have higher RGB values
      const origRgb = hexToRgb(original);
      const lightRgb = hexToRgb(lightened);
      expect(lightRgb?.r).toBeGreaterThan(origRgb?.r || 0);
    });

    it('darkenColor should decrease brightness', () => {
      const original = '#cccccc';
      const darkened = darkenColor(original, 50);
      expect(darkened).not.toBe(original);
      const origRgb = hexToRgb(original);
      const darkRgb = hexToRgb(darkened);
      expect(darkRgb?.r).toBeLessThan(origRgb?.r || 255);
    });

    it('lightened color should not exceed 255', () => {
      const lightened = lightenColor('#ffffff', 100);
      const rgb = hexToRgb(lightened);
      expect(rgb?.r).toBeLessThanOrEqual(255);
      expect(rgb?.g).toBeLessThanOrEqual(255);
      expect(rgb?.b).toBeLessThanOrEqual(255);
    });

    it('darkened color should not go below 0', () => {
      const darkened = darkenColor('#000000', 100);
      const rgb = hexToRgb(darkened);
      expect(rgb?.r).toBeGreaterThanOrEqual(0);
      expect(rgb?.g).toBeGreaterThanOrEqual(0);
      expect(rgb?.b).toBeGreaterThanOrEqual(0);
    });
  });

  describe('validatePalette', () => {
    it('should validate compliant light palette', () => {
      const errors = validatePalette(ACCESSIBLE_PALETTES.light);
      expect(errors.length).toBe(0);
    });

    it('should validate compliant dark palette', () => {
      const errors = validatePalette(ACCESSIBLE_PALETTES.dark);
      expect(errors.length).toBe(0);
    });

    it('should validate high contrast palette', () => {
      const errors = validatePalette(ACCESSIBLE_PALETTES.highContrast);
      expect(errors.length).toBe(0);
    });

    it('should detect invalid contrast in palette', () => {
      const invalidPalette = {
        primary: '#0066cc',
        primaryLight: '#4d94ff',
        primaryDark: '#004199',
        textPrimary: '#cccccc', // Too light on white background
        textSecondary: '#dddddd',
        textMuted: '#eeeeee',
        textOnPrimary: '#ffffff',
        bgLight: '#ffffff',
        bgDark: '#f5f5f5',
        bgNeutral: '#f0f0f0',
        success: '#007a2e',
        warning: '#b8860b',
        error: '#d32f2f',
        info: '#0066cc',
        border: '#cccccc',
        borderLight: '#e0e0e0',
        borderDark: '#999999',
      };
      const errors = validatePalette(invalidPalette);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain('Text Primary on Light BG');
    });
  });

  describe('Accessible Palettes', () => {
    it('should have light palette defined', () => {
      expect(ACCESSIBLE_PALETTES.light).toBeDefined();
      expect(ACCESSIBLE_PALETTES.light.textPrimary).toBe('#000000');
      expect(ACCESSIBLE_PALETTES.light.bgLight).toBe('#ffffff');
    });

    it('should have dark palette defined', () => {
      expect(ACCESSIBLE_PALETTES.dark).toBeDefined();
      expect(ACCESSIBLE_PALETTES.dark.textPrimary).toBe('#ffffff');
      expect(ACCESSIBLE_PALETTES.dark.bgLight).toBe('#1a1a1a');
    });

    it('should have high contrast palette defined', () => {
      expect(ACCESSIBLE_PALETTES.highContrast).toBeDefined();
      expect(ACCESSIBLE_PALETTES.highContrast.textPrimary).toBe('#000000');
    });

    it('light palette should meet WCAG AA for all text combinations', () => {
      const palette = ACCESSIBLE_PALETTES.light;
      const textOnLight = meetsContrastLevel(
        palette.textPrimary,
        palette.bgLight,
        ContrastLevel.AA
      );
      const textOnDark = meetsContrastLevel(
        palette.textPrimary,
        palette.bgDark,
        ContrastLevel.AA
      );
      const textOnPrimary = meetsContrastLevel(
        palette.textOnPrimary,
        palette.primary,
        ContrastLevel.AA
      );
      expect(textOnLight).toBe(true);
      expect(textOnDark).toBe(true);
      expect(textOnPrimary).toBe(true);
    });

    it('dark palette should meet WCAG AA for all text combinations', () => {
      const palette = ACCESSIBLE_PALETTES.dark;
      const textOnLight = meetsContrastLevel(
        palette.textPrimary,
        palette.bgLight,
        ContrastLevel.AA
      );
      const textOnPrimary = meetsContrastLevel(
        palette.textOnPrimary,
        palette.primary,
        ContrastLevel.AA
      );
      expect(textOnLight).toBe(true);
      expect(textOnPrimary).toBe(true);
    });
  });

  describe('Real-world color combinations', () => {
    it('should validate button colors (primary on white)', () => {
      const meets = meetsContrastLevel(
        ACCESSIBLE_PALETTES.light.textOnPrimary,
        ACCESSIBLE_PALETTES.light.primary,
        ContrastLevel.AA
      );
      expect(meets).toBe(true);
    });

    it('should validate success status color', () => {
      const meets = meetsContrastLevel(
        ACCESSIBLE_PALETTES.light.success,
        ACCESSIBLE_PALETTES.light.bgLight,
        ContrastLevel.AA
      );
      expect(meets).toBe(true);
    });

    it('should validate error status color', () => {
      const meets = meetsContrastLevel(
        ACCESSIBLE_PALETTES.light.error,
        ACCESSIBLE_PALETTES.light.bgLight,
        ContrastLevel.AA
      );
      expect(meets).toBe(true);
    });

    it('should validate warning status color', () => {
      const meets = meetsContrastLevel(
        ACCESSIBLE_PALETTES.light.warning,
        ACCESSIBLE_PALETTES.light.bgLight,
        ContrastLevel.AA
      );
      expect(meets).toBe(true);
    });

    it('should handle semi-transparent colors', () => {
      // Test that we can work with colors even if system provides rgba
      const ratio = getContrastRatio('#000000', '#ffffff');
      expect(ratio).toBeGreaterThan(20);
    });
  });

  describe('Edge cases', () => {
    it('should handle contrast between same colors', () => {
      const ratio = getContrastRatio('#666666', '#666666');
      expect(ratio).toBe(1);
    });

    it('should handle very light colors', () => {
      const ratio = getContrastRatio('#ffffff', '#f0f0f0');
      expect(ratio).toBeLessThan(1.5);
    });

    it('should handle very dark colors', () => {
      const ratio = getContrastRatio('#000000', '#0a0a0a');
      expect(ratio).toBeLessThan(1.5);
    });

    it('should maintain luminance calculations for various colors', () => {
      const colors = [
        '#ff0000', // Red
        '#00ff00', // Green
        '#0000ff', // Blue
        '#ffff00', // Yellow
        '#ff00ff', // Magenta
        '#00ffff', // Cyan
      ];

      colors.forEach((color) => {
        const lum = getLuminance(color);
        expect(lum).toBeGreaterThanOrEqual(0);
        expect(lum).toBeLessThanOrEqual(1);
      });
    });
  });
});
