/**
 * Layout-matching skeleton for the logged-in home route while `daysLoading` is true.
 * Heights are tuned to the real `CycleProgressHeader`, `WorkoutDayCarousel` + `WorkoutDayCard`,
 * and pre-session exercise list so the spinner → data swap does not cause CLS.
 */
export function WorkoutHomeSkeleton() {
  return (
    <div className="flex-1 flex flex-col gap-4 overflow-hidden pb-20" aria-hidden="true">
      <div className="mx-4 flex items-center gap-3 pt-4">
        <div className="h-4 w-4 shrink-0 animate-pulse rounded-full bg-muted" />
        <div className="flex-1">
          <div className="mb-1 flex items-baseline justify-between">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-3 w-8 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-1.5 w-full animate-pulse rounded-full bg-muted" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="px-4">
          <div className="h-[340px] animate-pulse rounded-xl border border-border bg-card" />
        </div>
        <div className="flex items-center justify-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2"
          >
            <div className="h-8 w-8 animate-pulse rounded bg-muted" />
            <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
