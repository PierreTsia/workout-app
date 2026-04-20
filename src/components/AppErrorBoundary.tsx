import { Component, type ErrorInfo, type ReactNode } from "react"

interface AppErrorBoundaryProps {
  children: ReactNode
  fallback: (ctx: { error: Error; resetError: () => void }) => ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
}

/**
 * Tiny error boundary that keeps `@sentry/react` out of the main bundle.
 * The Sentry SDK is only imported on the error path, so in the happy path
 * we ship zero Sentry bytes here. Error reporting still flows through the
 * SDK once an error occurs (it initializes via `initSentry()` on idle, so
 * early-boot errors that fire before idle won't be captured — acceptable
 * trade for LCP/TBT).
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    void import("@sentry/react")
      .then(({ captureException }) => {
        captureException(error, {
          contexts: {
            react: { componentStack: info.componentStack ?? undefined },
          },
        })
      })
      .catch(() => {
        // Sentry unavailable (network/offline) — swallow to avoid loops.
      })
  }

  private resetError = (): void => {
    this.setState({ error: null })
  }

  render(): ReactNode {
    if (this.state.error) {
      return this.props.fallback({
        error: this.state.error,
        resetError: this.resetError,
      })
    }
    return this.props.children
  }
}
