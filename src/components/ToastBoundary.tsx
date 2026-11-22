import React from 'react';
import { captureClientException } from '../observability/sentry';

type ToastBoundaryProps = { children: React.ReactNode };
type ToastBoundaryState = { failed: boolean };

/**
 * Keeps a broken toast from taking the app down (WIEZ-P01B-0001).
 *
 * <Toaster> sits outside the router, so anything it threw while rendering a
 * toast reached RootErrorBoundary and replaced every screen, losing unsaved
 * work. Here a failure only drops the toasts on screen: it is reported, the
 * toaster renders nothing, and it remounts a moment later, empty, so later
 * toasts still appear.
 */
export class ToastBoundary extends React.Component<ToastBoundaryProps, ToastBoundaryState> {
  state: ToastBoundaryState = { failed: false };
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(): ToastBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    captureClientException(error, { boundary: 'toast' });
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.setState({ failed: false }), 1000);
  }

  componentWillUnmount() {
    clearTimeout(this.resetTimer);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}
