import { Component, type ErrorInfo, type ReactNode } from "react"
import { makeErrorId } from "@/lib/errorReport"

interface AppErrorBoundaryFallbackContext {
  error: Error
  errorId: string
  componentStack: string | null
  caughtAt: Date
  resetError: () => void
}

interface AppErrorBoundaryProps {
  children: ReactNode
  fallback: (ctx: AppErrorBoundaryFallbackContext) => ReactNode
}

interface AppErrorBoundaryState {
  error: Error | null
  errorId: string | null
  componentStack: string | null
  caughtAt: Date | null
}

/**
 * Tiny error boundary that keeps `@sentry/react` out of the main bundle.
 * The Sentry SDK is only imported on the error path, so in the happy path
 * we ship zero Sentry bytes here.
 *
 * Two reliability fixes vs the original implementation:
 *
 * 1. We import `@/lib/sentry` alongside `@sentry/react` and call
 *    `initSentry()` before `captureException`. `initSentry` is idempotent
 *    (no-op when no DSN, and Sentry's own `init` short-circuits on second
 *    call), but this closes the race where an error fires during the
 *    `requestIdleCallback` window in `main.tsx` — without this guard the
 *    capture is silently dropped because the global hub has no client.
 *
 * 2. The fallback receives an `errorId` (short hash) we tag on the Sentry
 *    event, so the user-visible ID and the dashboard event line up.
 */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    error: null,
    errorId: null,
    componentStack: null,
    caughtAt: null,
  }

  static getDerivedStateFromError(error: Error): Partial<AppErrorBoundaryState> {
    return {
      error,
      errorId: makeErrorId(error),
      caughtAt: new Date(),
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const componentStack = info.componentStack ?? null
    this.setState({ componentStack })

    const errorId = this.state.errorId ?? makeErrorId(error)

    void Promise.all([import("@sentry/react"), import("@/lib/sentry")])
      .then(([sentry, { initSentry }]) => {
        initSentry()
        sentry.captureException(error, {
          tags: { error_id: errorId },
          contexts: {
            react: { componentStack: componentStack ?? undefined },
          },
        })
      })
      .catch(() => {
        // Sentry SDK chunk failed to load (offline / stale SW cache) —
        // swallow to avoid loops. The user-facing fallback still surfaces
        // the error id + payload so the crash isn't fully invisible.
      })
  }

  private resetError = (): void => {
    this.setState({
      error: null,
      errorId: null,
      componentStack: null,
      caughtAt: null,
    })
  }

  render(): ReactNode {
    const { error, errorId, componentStack, caughtAt } = this.state
    if (error && errorId && caughtAt) {
      return this.props.fallback({
        error,
        errorId,
        componentStack,
        caughtAt,
        resetError: this.resetError,
      })
    }
    return this.props.children
  }
}
