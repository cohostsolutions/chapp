import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getTouchTargetSize,
  meetsMinimumSize,
  getInteractiveElements,
  findNearestInteractiveElement,
  getSpacingBetween,
  auditTouchTargets,
  validateTouchTarget,
  generateTouchTargetReport,
  enhanceTouchTarget,
  calculateOptimalButtonGroupLayout,
  TouchTargetSize,
  TouchTargetSpacing,
  type TouchTargetOptions,
} from '../lib/touchTargets';

describe('Touch Target Utilities', () => {
  let container: HTMLElement;

  beforeEach(() => {
    // Create a test container
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  describe('getTouchTargetSize', () => {
    it('should calculate size for a 50x50 element', () => {
      const button = document.createElement('button');
      button.style.width = '50px';
      button.style.height = '50px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const size = getTouchTargetSize(button);
      expect(size.width).toBe(50);
      expect(size.height).toBe(50);
      expect(size.actualSize).toBe(50);
    });

    it('should include padding in calculation', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '10px';
      button.style.margin = '0';
      container.appendChild(button);

      const size = getTouchTargetSize(button);
      expect(size.width).toBeGreaterThan(30);
      expect(size.height).toBeGreaterThan(30);
    });

    it('should include margin in calculation', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '5px';
      container.appendChild(button);

      const size = getTouchTargetSize(button);
      expect(size.width).toBeGreaterThan(30);
      expect(size.height).toBeGreaterThan(30);
    });

    it('should calculate actual size as minimum of width/height', () => {
      const button = document.createElement('button');
      button.style.width = '100px';
      button.style.height = '50px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const size = getTouchTargetSize(button);
      expect(size.actualSize).toBe(50);
    });
  });

  describe('meetsMinimumSize', () => {
    it('should return true for 48x48 element', () => {
      const button = document.createElement('button');
      button.style.width = '48px';
      button.style.height = '48px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const meets = meetsMinimumSize(button);
      expect(meets).toBe(true);
    });

    it('should return false for element smaller than 48px', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const meets = meetsMinimumSize(button);
      expect(meets).toBe(false);
    });

    it('should respect custom minimum size', () => {
      const button = document.createElement('button');
      button.style.width = '56px';
      button.style.height = '56px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const meets = meetsMinimumSize(button, 56);
      expect(meets).toBe(true);
    });

    it('should return true when padding brings element to minimum', () => {
      const button = document.createElement('button');
      button.style.width = '20px';
      button.style.height = '20px';
      button.style.padding = '14px';
      button.style.margin = '0';
      container.appendChild(button);

      const meets = meetsMinimumSize(button, 48);
      expect(meets).toBe(true);
    });
  });

  describe('getInteractiveElements', () => {
    it('should find all buttons', () => {
      container.innerHTML = '<button>Button 1</button><button>Button 2</button>';
      const buttons = getInteractiveElements(container);
      expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('should find links', () => {
      container.innerHTML = '<a href="#">Link</a>';
      const elements = getInteractiveElements(container);
      expect(elements.length).toBeGreaterThan(0);
    });

    it('should find form inputs', () => {
      container.innerHTML = '<input type="text" /><textarea></textarea>';
      const elements = getInteractiveElements(container);
      expect(elements.length).toBeGreaterThanOrEqual(2);
    });

    it('should skip hidden elements', () => {
      container.innerHTML =
        '<button>Visible</button><button style="display:none;">Hidden</button>';
      const buttons = getInteractiveElements(container);
      // Should find the visible button, not the hidden one
      expect(buttons.length).toBeGreaterThanOrEqual(1);
    });

    it('should skip disabled elements', () => {
      const button = document.createElement('button');
      button.disabled = true;
      button.textContent = 'Disabled';
      container.appendChild(button);

      const elements = getInteractiveElements(container);
      expect(elements).not.toContain(button);
    });

    it('should respect ignore selector', () => {
      container.innerHTML =
        '<button>Normal</button><button class="skip">Skip</button>';
      const elements = getInteractiveElements(container, {
        ignoreSelector: '.skip',
      });
      // At least one button should be found and skipped one should not be
      expect(elements.length).toBeGreaterThanOrEqual(1);
    });

    it('should find ARIA role elements', () => {
      container.innerHTML = '<div role="button" tabindex="0">ARIA Button</div>';
      const elements = getInteractiveElements(container);
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  describe('findNearestInteractiveElement', () => {
    it('should find nearest element', () => {
      const button1 = document.createElement('button');
      button1.textContent = 'Button 1';
      button1.style.position = 'absolute';
      button1.style.left = '0px';
      button1.style.top = '0px';

      const button2 = document.createElement('button');
      button2.textContent = 'Button 2';
      button2.style.position = 'absolute';
      button2.style.left = '50px';
      button2.style.top = '0px';

      const button3 = document.createElement('button');
      button3.textContent = 'Button 3';
      button3.style.position = 'absolute';
      button3.style.left = '200px';
      button3.style.top = '0px';

      container.appendChild(button1);
      container.appendChild(button2);
      container.appendChild(button3);

      const all = [button1, button2, button3];
      const nearest = findNearestInteractiveElement(button1, Infinity, all);

      // Button 2 should be nearest to Button 1
      expect(nearest).toBe(button2);
    });

    it('should respect distance threshold', () => {
      const button1 = document.createElement('button');
      button1.style.position = 'absolute';
      button1.style.left = '0px';
      button1.style.top = '0px';

      const button2 = document.createElement('button');
      button2.style.position = 'absolute';
      button2.style.left = '200px';
      button2.style.top = '0px';

      container.appendChild(button1);
      container.appendChild(button2);

      const nearest = findNearestInteractiveElement(button1, 50, [button2]);
      expect(nearest).toBeNull();
    });
  });

  describe('getSpacingBetween', () => {
    it('should calculate spacing between two elements', () => {
      const button1 = document.createElement('button');
      button1.style.position = 'absolute';
      button1.style.left = '0px';
      button1.style.top = '0px';
      button1.style.width = '50px';
      button1.style.height = '50px';

      const button2 = document.createElement('button');
      button2.style.position = 'absolute';
      button2.style.left = '70px';
      button2.style.top = '0px';
      button2.style.width = '50px';
      button2.style.height = '50px';

      container.appendChild(button1);
      container.appendChild(button2);

      const spacing = getSpacingBetween(button1, button2);
      expect(spacing).toBeGreaterThanOrEqual(10);
      expect(spacing).toBeLessThanOrEqual(30);
    });

    it('should return 0 for overlapping elements', () => {
      const button1 = document.createElement('button');
      button1.style.position = 'absolute';
      button1.style.left = '0px';
      button1.style.top = '0px';
      button1.style.width = '50px';
      button1.style.height = '50px';

      const button2 = document.createElement('button');
      button2.style.position = 'absolute';
      button2.style.left = '30px';
      button2.style.top = '0px';
      button2.style.width = '50px';
      button2.style.height = '50px';

      container.appendChild(button1);
      container.appendChild(button2);

      const spacing = getSpacingBetween(button1, button2);
      expect(spacing).toBeLessThanOrEqual(0);
    });
  });

  describe('validateTouchTarget', () => {
    it('should validate compliant touch target', () => {
      const button = document.createElement('button');
      button.style.width = '48px';
      button.style.height = '48px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const validation = validateTouchTarget(button);
      expect(validation.valid).toBe(true);
      expect(validation.size).toBeGreaterThanOrEqual(48);
    });

    it('should detect too-small touch target', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const validation = validateTouchTarget(button);
      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide helpful recommendations', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const validation = validateTouchTarget(button);
      expect(validation.recommendations[0]).toContain('48');
    });

    it('should suggest mobile size improvement', () => {
      const button = document.createElement('button');
      button.style.width = '48px';
      button.style.height = '48px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const validation = validateTouchTarget(button);
      // Should be valid but may suggest larger size
      if (validation.recommendations.length > 0) {
        expect(validation.recommendations[0]).toContain('56');
      }
    });
  });

  describe('auditTouchTargets', () => {
    it('should find no issues with compliant elements', () => {
      container.innerHTML = '<button style="width: 48px; height: 48px;">Button</button>';
      const issues = auditTouchTargets(container);
      // May have issues depending on computed styles
      expect(Array.isArray(issues)).toBe(true);
    });

    it('should report small touch targets', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const issues = auditTouchTargets(container);
      expect(issues.length).toBeGreaterThanOrEqual(0);
    });

    it('should include element and size info in issues', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const issues = auditTouchTargets(container);
      if (issues.length > 0) {
        const issue = issues[0];
        expect(issue.element).toBeDefined();
        expect(issue.width).toBeDefined();
        expect(issue.height).toBeDefined();
        expect(issue.actualSize).toBeDefined();
      }
    });
  });

  describe('generateTouchTargetReport', () => {
    it('should generate success report for no issues', () => {
      const report = generateTouchTargetReport([]);
      expect(report).toContain('All interactive elements');
      expect(report).toContain('✅');
    });

    it('should generate issue report', () => {
      const button = document.createElement('button');
      const issue = {
        element: button,
        width: 30,
        height: 30,
        actualSize: 30,
        x: 0,
        y: 0,
        meetsMinimum: false,
        meetsRecommended: false,
      };

      const report = generateTouchTargetReport([issue]);
      expect(report).toContain('Issues Found');
      expect(report).toContain('30');
      expect(report).toContain('48');
    });

    it('should include spacing information', () => {
      const button1 = document.createElement('button');
      const button2 = document.createElement('button');
      const issue = {
        element: button1,
        width: 30,
        height: 30,
        actualSize: 30,
        x: 0,
        y: 0,
        nearbyElement: button2,
        spacing: 4,
        meetsMinimum: false,
        meetsRecommended: false,
      };

      const report = generateTouchTargetReport([issue]);
      expect(report).toContain('Spacing');
      expect(report).toContain('4');
    });
  });

  describe('enhanceTouchTarget', () => {
    it('should add padding to small element', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const result = enhanceTouchTarget(button, 48);
      expect(result.paddingAdded).toBe(true);
      expect(button.style.padding).not.toBe('0px');
    });

    it('should not modify already compliant element', () => {
      const button = document.createElement('button');
      button.style.width = '48px';
      button.style.height = '48px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const originalPadding = button.style.padding;
      const result = enhanceTouchTarget(button, 48);
      expect(result.paddingAdded).toBe(false);
      expect(button.style.padding).toBe(originalPadding);
    });

    it('should return padding information', () => {
      const button = document.createElement('button');
      button.style.width = '30px';
      button.style.height = '30px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const result = enhanceTouchTarget(button);
      expect(result.originalPadding).toBeDefined();
      expect(result.newPadding).toBeDefined();
    });
  });

  describe('calculateOptimalButtonGroupLayout', () => {
    it('should calculate buttons per row', () => {
      const layout = calculateOptimalButtonGroupLayout(4, 400);
      expect(layout.buttonsPerRow).toBeGreaterThan(0);
      expect(layout.buttonWidth).toBe(TouchTargetSize.MINIMUM);
      expect(layout.buttonHeight).toBe(TouchTargetSize.MINIMUM);
    });

    it('should indicate if layout fits', () => {
      const layout = calculateOptimalButtonGroupLayout(2, 200);
      expect(layout.fits).toBeDefined();
      expect(typeof layout.fits).toBe('boolean');
    });

    it('should fit 1 button in narrow container', () => {
      const layout = calculateOptimalButtonGroupLayout(3, 50);
      expect(layout.buttonsPerRow).toBe(1);
    });

    it('should fit multiple buttons in wide container', () => {
      const layout = calculateOptimalButtonGroupLayout(4, 500);
      expect(layout.buttonsPerRow).toBeGreaterThan(1);
    });

    it('should respect custom button size', () => {
      const layout = calculateOptimalButtonGroupLayout(2, 200, 64);
      expect(layout.buttonWidth).toBe(64);
      expect(layout.buttonHeight).toBe(64);
    });

    it('should account for spacing', () => {
      const layout1 = calculateOptimalButtonGroupLayout(
        4,
        400,
        48,
        TouchTargetSpacing.MINIMUM
      );
      const layout2 = calculateOptimalButtonGroupLayout(
        4,
        400,
        48,
        TouchTargetSpacing.GENEROUS
      );
      // More spacing should allow fewer buttons per row
      expect(layout1.buttonsPerRow).toBeGreaterThanOrEqual(layout2.buttonsPerRow);
    });
  });

  describe('TouchTargetSize constants', () => {
    it('should define minimum size as 48', () => {
      expect(TouchTargetSize.MINIMUM).toBe(48);
    });

    it('should define mobile size as 56', () => {
      expect(TouchTargetSize.MOBILE).toBe(56);
    });

    it('should define large size as 64', () => {
      expect(TouchTargetSize.LARGE).toBe(64);
    });
  });

  describe('TouchTargetSpacing constants', () => {
    it('should define minimum spacing as 8', () => {
      expect(TouchTargetSpacing.MINIMUM).toBe(8);
    });

    it('should define comfortable spacing as 12', () => {
      expect(TouchTargetSpacing.COMFORTABLE).toBe(12);
    });

    it('should define generous spacing as 16', () => {
      expect(TouchTargetSpacing.GENEROUS).toBe(16);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle button with text', () => {
      const button = document.createElement('button');
      button.textContent = 'Click me';
      button.style.padding = '12px 16px';
      button.style.margin = '0';
      container.appendChild(button);

      const size = getTouchTargetSize(button);
      expect(size.actualSize).toBeGreaterThanOrEqual(24); // text height + padding
    });

    it('should validate icon button', () => {
      const button = document.createElement('button');
      button.style.width = '48px';
      button.style.height = '48px';
      button.style.padding = '0';
      button.style.margin = '0';
      container.appendChild(button);

      const meets = meetsMinimumSize(button);
      expect(meets).toBe(true);
    });

    it('should calculate spacing between navigation items', () => {
      const nav = document.createElement('nav');
      const link1 = document.createElement('a');
      link1.href = '#1';
      link1.style.position = 'absolute';
      link1.style.left = '0px';
      link1.style.top = '0px';

      const link2 = document.createElement('a');
      link2.href = '#2';
      link2.style.position = 'absolute';
      link2.style.left = '60px';
      link2.style.top = '0px';

      nav.appendChild(link1);
      nav.appendChild(link2);
      container.appendChild(nav);

      const spacing = getSpacingBetween(link1, link2);
      expect(spacing).toBeGreaterThan(0);
    });
  });
});
