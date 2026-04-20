import { Loader2 } from "lucide-react"

/**
 * Shared `<Suspense>` fallback for lazy-loaded routes.
 *
 * Kept intentionally minimal: most lazy routes are non-critical (admin,
 * history, library, builder, account). The logged-in home (`/`), `/login`,
 * `/onboarding`, and `/create-program` stay eager so the auth + LCP path
 * never hits this fallback. Upgrade to a per-route skeleton only if a
 * specific lazy surface suffers a visible flash.
 */
export function RouteSkeleton() {
  return (
    <div
      className="flex flex-1 items-center justify-center"
      aria-hidden="true"
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}
