import { Component, type ErrorInfo, type ReactNode } from "react"
import { captureException } from "@sentry/react"
import { initSentry } from "@/lib/sentry"
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
 * Tiny error boundary that captures React-render-time errors to Sentry and
 * hands the fallback a stable, paste-able `errorId` derived from the error
 * signature.
 *
 * Why static imports: a previous iteration dynamic-imported `@sentry/react`
 * here to keep the SDK out of the main bundle, but the SDK was already
 * eagerly pulled in by other call-sites (`OnboardingPage` →
 * `captureOnboardingError`). The dynamic import bought nothing and risked
 * silently dropping the capture when the SDK chunk failed to load (which
 * is exactly what happens during the bug class tracked in #356: stale
 * service-worker cache vs new deploy → chunk-load failures across the
 * board). Direct static import is cheaper to reason about and removes the
 * `.catch(() => {})` swallow path.
 *
 * `initSentry()` is still called defensively before `captureException` in
 * case `componentDidCatch` fires before `main.tsx`'s top-level init (e.g.
 * an error thrown during module evaluation). It's idempotent.
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

    try {
      initSentry()
      captureException(error, {
        tags: { error_id: errorId },
        contexts: {
          react: { componentStack: componentStack ?? undefined },
        },
      })
    } catch {
      // Sentry init / capture should never throw, but if it does the
      // user-facing fallback still surfaces the error id + payload so the
      // crash isn't fully invisible.
    }
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
