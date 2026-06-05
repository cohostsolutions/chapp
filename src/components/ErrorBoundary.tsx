import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logError, devError } from '@/lib/logger';
import { AlertTriangle, RefreshCw, Home, Bug, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isDevelopmentMode } from '@/lib/env';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  fullPage?: boolean; // For root-level error boundary
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, { context: 'ErrorBoundary', errorInfo });
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleCopyError = async () => {
    const errorDetails = `Error: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack}\n\nComponent Stack: ${this.state.errorInfo?.componentStack}`;
    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      devError('Failed to copy error:', err);
    }
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Full-page error for root-level errors
      if (this.props.fullPage) {
        return (
          <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="max-w-lg w-full text-center space-y-8">
              {/* Animated error icon */}
              <div className="relative mx-auto w-24 h-24">
                <div className="absolute inset-0 bg-destructive/20 rounded-full animate-ping" />
                <div className="relative w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-12 h-12 text-destructive" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-foreground">Oops! Something went wrong</h1>
                <p className="text-muted-foreground text-lg">
                  We encountered an unexpected error. Don't worry, your data is safe.
                </p>
              </div>

              {/* Error details (dev mode or expandable) */}
              {this.state.error && (
                <Card className="text-left bg-muted/50 border-destructive/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm text-destructive font-mono">
                        <Bug className="w-4 h-4 shrink-0" />
                        <span className="truncate">{this.state.error.message}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 px-2"
                        onClick={this.handleCopyError}
                      >
                        {this.state.copied ? (
                          <Check className="w-3.5 h-3.5 text-success" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="outline" size="lg" onClick={this.handleGoHome}>
                  <Home className="w-4 h-4 mr-2" />
                  Go to Homepage
                </Button>
                <Button size="lg" onClick={this.handleReload}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                If this keeps happening, please contact support.
              </p>
            </div>
          </div>
        );
      }

      // Compact card error for nested components
      return (
        <div className="min-h-[400px] flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
                <AlertTriangle className="w-6 h-6 text-destructive" />
              </div>
              <CardTitle>Something went wrong</CardTitle>
              <CardDescription>
                An unexpected error occurred. Please try again or reload the page.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isDevelopmentMode() && this.state.error && (
                <div className="bg-muted p-3 rounded-lg overflow-auto max-h-32">
                  <code className="text-xs text-destructive">
                    {this.state.error.message}
                  </code>
                </div>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button onClick={this.handleReload}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook-based error boundary wrapper for functional components
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}

// Section-level error boundary props
interface SectionProps {
  children: ReactNode;
  name?: string;
  className?: string;
}

interface SectionState {
  hasError: boolean;
  error: Error | null;
}

// Compact error boundary for individual page sections
export class SectionErrorBoundary extends Component<SectionProps, SectionState> {
  public state: SectionState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): Partial<SectionState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError(error, { context: `SectionErrorBoundary [${this.props.name || 'unnamed'}]`, errorInfo });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Card className={`glass border-destructive/30 ${this.props.className || ''}`}>
          <CardContent className="p-4 lg:p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground">
                  {this.props.name ? `${this.props.name} failed to load` : 'Section failed to load'}
                </p>
                <p className="text-sm text-muted-foreground">
                  An error occurred while loading this section
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={this.handleRetry}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Inline error fallback for very small sections
export function InlineErrorFallback({ 
  message = 'Failed to load', 
  onRetry 
}: { 
  message?: string; 
  onRetry?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-destructive p-2 bg-destructive/10 rounded-lg">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="h-6 px-2">
          Retry
        </Button>
      )}
    </div>
  );
}