/**
 * Navigation Utilities for Settings Page
 * NAV-001: Clear back navigation and breadcrumbs
 * ACCESSIBILITY: Keyboard shortcuts for navigation
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Hook to handle Escape key for navigation
 * Usage:
 * ```tsx
 * const navigate = useNavigate();
 * useBackNavigation(() => navigate('/dashboard'));
 * ```
 */
export function useBackNavigation(onBack?: () => void) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (onBack) {
          onBack();
        } else {
          navigate(-1);
        }
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onBack, navigate]);
}

/**
 * Breadcrumb navigation component
 * Shows hierarchical path: Dashboard > Section > Current
 */
export interface BreadcrumbItem {
  label: string;
  path?: string;
  onClick?: () => void;
  isActive?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-2 text-sm mb-4 ${className}`}
    >
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          {index > 0 && (
            <span className="text-gray-400" aria-hidden="true">
              /
            </span>
          )}
          {item.onClick || item.path ? (
            <button
              onClick={item.onClick}
              className="text-blue-600 hover:text-blue-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-current={item.isActive ? 'page' : undefined}
            >
              {item.label}
            </button>
          ) : (
            <span
              className={
                item.isActive ? 'text-gray-900 font-medium' : 'text-gray-600'
              }
              aria-current={item.isActive ? 'page' : undefined}
            >
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}

/**
 * Back button component with chevron icon
 * NAV-001 implementation
 */
import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export function BackButton({
  onClick,
  label = 'Back',
  className = '',
}: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 mb-4 px-3 py-2 rounded-md text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${className}`}
      aria-label={`${label} to previous page`}
    >
      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

/**
 * Settings page header with back navigation
 * Combines breadcrumb + back button + title
 */
interface SettingsHeaderProps {
  title: string;
  subtitle?: string;
  onBack: () => void;
  showBreadcrumb?: boolean;
}

export function SettingsHeader({
  title,
  subtitle,
  onBack,
  showBreadcrumb = true,
}: SettingsHeaderProps) {
  // Enable Escape key to go back
  useBackNavigation(onBack);

  return (
    <div className="mb-6">
      {showBreadcrumb && (
        <Breadcrumb
          items={[
            { label: 'Dashboard', onClick: onBack },
            { label: title, isActive: true },
          ]}
        />
      )}

      <BackButton onClick={onBack} label="Back to Dashboard" />

      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
      {subtitle && <p className="text-gray-600 mt-2">{subtitle}</p>}
    </div>
  );
}
