import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import {
  TourSceneStage,
  type TourResolvedShot,
} from './TourSceneStage'
import {
  formatTourProgress,
  sceneIndexAfterWheel,
} from '@/lib/tourScroll'
import {
  tourProgressFade,
  tourRailExpand,
  tourStageFade,
} from '@/lib/tourTransitions'
import { cn } from '@/lib/utils'

export type TourResolvedScene = {
  id: number
  slug: string
  title: string
  lede: string
  facts: string[]
  device: 'phone' | 'desktop'
  shots: TourResolvedShot[]
}

type TourSplitStageProps = {
  scenes: TourResolvedScene[]
}

/** Wheel lock slightly past stage fade so a second flick doesn’t stack. */
const WHEEL_LOCK_MS = Math.round(tourStageFade.duration * 1000) + 40

export function TourSplitStage({ scenes }: TourSplitStageProps) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const activeIndexRef = useRef(0)
  const wheelLockUntilRef = useRef(0)
  const [activeIndex, setActiveIndex] = useState(0)
  const prefersReducedMotion = useReducedMotion() ?? false

  useEffect(() => {
    activeIndexRef.current = activeIndex
  }, [activeIndex])

  useEffect(() => {
    const section = sectionRef.current
    if (!section || prefersReducedMotion) return

    const onWheel = (event: WheelEvent) => {
      const now = performance.now()
      if (now < wheelLockUntilRef.current) {
        event.preventDefault()
        return
      }

      if (Math.abs(event.deltaY) < 12) return

      const next = sceneIndexAfterWheel({
        activeIndex: activeIndexRef.current,
        sceneCount: scenes.length,
        deltaY: event.deltaY,
      })

      if (!next.consume) return

      event.preventDefault()
      setActiveIndex(next.index)
      wheelLockUntilRef.current = now + WHEEL_LOCK_MS
    }

    section.addEventListener('wheel', onWheel, { passive: false })
    return () => section.removeEventListener('wheel', onWheel)
  }, [scenes.length, prefersReducedMotion])

  const active = scenes[activeIndex] ?? scenes[0]
  if (!active) return null

  return (
    <div
      ref={sectionRef}
      className="relative hidden md:block"
      aria-roledescription="carousel"
      aria-label="Product Tour stages"
    >
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-4 md:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] md:gap-8 md:py-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-10">
        <aside
          className="flex min-h-0 flex-col justify-start"
          aria-label="Tour chapters"
        >
          <div className="relative h-[1.35em] overflow-hidden font-mono text-sm font-medium tracking-[0.18em] text-accent uppercase md:text-base">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={active.slug}
                className="absolute inset-0"
                initial={
                  prefersReducedMotion ? false : { opacity: 0, y: 6 }
                }
                animate={{ opacity: 1, y: 0 }}
                exit={
                  prefersReducedMotion
                    ? undefined
                    : { opacity: 0, y: -6 }
                }
                transition={tourProgressFade}
              >
                {formatTourProgress(activeIndex, scenes.length)}
              </motion.p>
            </AnimatePresence>
          </div>
          <ol className="mt-5 flex flex-col gap-0.5">
            {scenes.map((scene, index) => {
              const isActive = index === activeIndex
              return (
                <li key={scene.slug}>
                  <button
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'group w-full rounded-r-lg border-l-2 px-3 py-2.5 text-left transition-[color,background-color,border-color] duration-300 ease-out',
                      isActive
                        ? 'border-accent bg-surface text-foreground'
                        : 'border-transparent hover:bg-foreground/[0.03]',
                    )}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    <span className="flex items-baseline gap-3">
                      <span
                        className={cn(
                          'shrink-0 font-mono text-xs tracking-wider tabular-nums transition-colors duration-300',
                          isActive
                            ? 'font-medium text-accent'
                            : 'text-muted/70 group-hover:text-muted',
                        )}
                      >
                        {String(scene.id).padStart(2, '0')}
                      </span>
                      <span
                        className={cn(
                          'text-[0.95rem] leading-snug tracking-tight transition-colors duration-300',
                          isActive
                            ? 'font-semibold text-foreground'
                            : 'font-medium text-muted group-hover:text-foreground/85',
                        )}
                      >
                        {scene.title}
                      </span>
                    </span>
                    <AnimatePresence initial={false} mode="popLayout">
                      {isActive && (
                        <motion.div
                          key={`${scene.slug}-copy`}
                          initial={
                            prefersReducedMotion
                              ? false
                              : { opacity: 0, height: 0 }
                          }
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={
                            prefersReducedMotion
                              ? undefined
                              : { opacity: 0, height: 0 }
                          }
                          transition={tourRailExpand}
                          className="overflow-hidden"
                        >
                          <p className="mt-2.5 pl-8 text-sm leading-relaxed text-foreground/70">
                            {scene.lede}
                          </p>
                          {scene.facts.length > 0 && (
                            <ul className="mt-2.5 space-y-1 pl-8 text-sm leading-snug text-muted">
                              {scene.facts.map((fact) => (
                                <li
                                  key={fact}
                                  className="flex gap-2 before:mt-[0.55em] before:size-1 before:shrink-0 before:rounded-full before:bg-accent/80 before:content-['']"
                                >
                                  {fact}
                                </li>
                              ))}
                            </ul>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                </li>
              )
            })}
          </ol>
          <p className="mt-6 text-xs text-muted">
            Scroll or use the rail to change steps.
          </p>
        </aside>

        <div className="flex min-h-0 items-start justify-center md:justify-start md:pl-2">
          <div
            className={cn(
              'relative h-[min(34rem,70vh)] w-full',
              active.device === 'desktop' ? 'max-w-4xl' : 'max-w-md',
            )}
          >
            <AnimatePresence initial={false}>
              <motion.div
                key={active.slug}
                className="absolute inset-0 flex items-start justify-end"
                initial={
                  prefersReducedMotion
                    ? false
                    : { opacity: 0, filter: 'blur(6px)' }
                }
                animate={{
                  opacity: 1,
                  filter: 'blur(0px)',
                  transition: {
                    ...tourStageFade,
                    opacity: { ...tourStageFade, delay: 0.06 },
                    filter: { ...tourStageFade, delay: 0.06 },
                  },
                }}
                exit={
                  prefersReducedMotion
                    ? undefined
                    : {
                        opacity: 0,
                        filter: 'blur(4px)',
                        transition: {
                          duration: 0.28,
                          ease: tourStageFade.ease,
                        },
                      }
                }
              >
                <TourSceneStage
                  device={active.device}
                  shots={active.shots}
                  align="center"
                  className="h-full w-full"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
