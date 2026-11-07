import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  fallback: (error: Error, reset: () => void) => ReactNode;
  children: ReactNode;
  /** When this value changes the boundary resets (e.g. after the input is edited). */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
  resetKey: unknown;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, resetKey: this.props.resetKey };

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error };
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: ErrorBoundaryState): Partial<ErrorBoundaryState> | null {
    if (props.resetKey !== state.resetKey) return { error: null, resetKey: props.resetKey };
    return null;
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.warn('Render error caught by boundary:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  override render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.reset);
    return this.props.children;
  }
}
