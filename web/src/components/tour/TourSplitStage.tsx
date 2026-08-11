import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { DeviceFrame } from './DeviceFrame'
import { shouldPinTourTheater, tourStageImageStyle } from '@/lib/tourMotion'
import {
  beatScrollOffset,
  formatTourProgress,
  pickActiveBeatIndex,
} from '@/lib/tourScroll'
import { cn } from '@/lib/utils'

export type TourResolvedScene = {
  id: number
  slug: string
  title: string
  lede: string
  facts: string[]
  device: 'phone' | 'desktop'
  src: string
  width: number
  height: number
  alt: string
  focal: string
}

type TourSplitStageProps = {
  scenes: TourResolvedScene[]
}

export function TourSplitStage({ scenes }: TourSplitStageProps) {
  const pinRef = useRef<HTMLDivElement>(null)
  const beatRefs = useRef<(HTMLDivElement | null)[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(false)

  const pinTheater = shouldPinTourTheater(reducedMotion)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReducedMotion(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!pinTheater) return

    const beats = beatRefs.current.filter(
      (el): el is HTMLDivElement => el !== null,
    )
    if (beats.length === 0) return

    const ratios = new Map<number, number>()

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(
            (entry.target as HTMLElement).dataset.beatIndex ?? -1,
          )
          if (index < 0) continue
          ratios.set(index, entry.intersectionRatio)
        }

        const next = pickActiveBeatIndex(
          [...ratios.entries()].map(([index, intersectionRatio]) => ({
            index,
            intersectionRatio,
          })),
        )
        if (next !== null) setActiveIndex(next)
      },
      {
        root: null,
        threshold: [0, 0.25, 0.5, 0.75, 1],
        rootMargin: '-40% 0px -40% 0px',
      },
    )

    for (const beat of beats) observer.observe(beat)
    return () => observer.disconnect()
  }, [scenes.length, pinTheater])

  const active = scenes[activeIndex] ?? scenes[0]
  if (!active) return null

  const onRailClick = (index: number) => {
    setActiveIndex(index)
    if (!pinTheater) return

    const pin = pinRef.current
    if (!pin) return
    const pinTop = pin.getBoundingClientRect().top + window.scrollY
    const offset = beatScrollOffset({
      pinHeight: pin.offsetHeight,
      sceneCount: scenes.length,
      index,
    })
    window.scrollTo({ top: pinTop + offset, behavior: 'smooth' })
  }

  const stage = (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-8 px-4',
        pinTheater
          ? 'sticky h-[calc(100vh-var(--header-h,4rem))]'
          : 'min-h-[calc(100vh-var(--header-h,4rem))]',
      )}
      style={pinTheater ? { top: 'var(--header-h, 4rem)' } : undefined}
    >
      <aside
        className="flex min-h-0 flex-col justify-center py-6"
        aria-label="Tour chapters"
      >
        <p className="text-xs font-medium tracking-widest text-muted uppercase">
          {formatTourProgress(activeIndex, scenes.length)}
        </p>
        <ol className="mt-6 space-y-1">
          {scenes.map((scene, index) => {
            const isActive = index === activeIndex
            return (
              <li key={scene.slug}>
                <button
                  type="button"
                  onClick={() => onRailClick(index)}
                  className={cn(
                    'w-full rounded-md border-l-2 px-3 py-2 text-left transition-colors duration-150',
                    isActive
                      ? 'border-accent bg-foreground/5 text-foreground'
                      : 'border-transparent text-muted hover:text-foreground',
                  )}
                  aria-current={isActive ? 'true' : undefined}
                >
                  <span className="text-xs tracking-widest uppercase">
                    {String(scene.id).padStart(2, '0')}
                  </span>
                  <span className="mt-0.5 block text-sm font-medium">
                    {scene.title}
                  </span>
                  {isActive && (
                    <>
                      <span className="mt-1 block text-sm leading-relaxed text-muted">
                        {scene.lede}
                      </span>
                      {scene.facts.length > 0 && (
                        <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs text-muted">
                          {scene.facts.map((fact) => (
                            <li key={fact}>{fact}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </button>
              </li>
            )
          })}
        </ol>
      </aside>

      <div className="relative flex min-h-0 items-center justify-center py-6">
        {scenes.map((scene, index) => {
          const motion = tourStageImageStyle({
            focal: scene.focal,
            active: index === activeIndex,
            reducedMotion,
          })
          return (
            <div
              key={scene.slug}
              className={cn(
                'absolute inset-0 flex items-center justify-center',
                reducedMotion
                  ? ''
                  : 'transition-opacity duration-300',
                index === activeIndex
                  ? 'z-10 opacity-100'
                  : 'z-0 opacity-0 pointer-events-none',
              )}
              aria-hidden={index !== activeIndex}
            >
              <DeviceFrame
                device={scene.device}
                src={scene.src}
                alt={scene.alt}
                width={scene.width}
                height={scene.height}
                className={
                  scene.device === 'desktop' ? 'w-full max-w-xl' : undefined
                }
                imageClassName="will-change-transform"
                imageStyle={{
                  transformOrigin: motion.transformOrigin,
                  animationName: motion.animationName,
                  animationDuration: '12s',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'forwards',
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div
      ref={pinRef}
      className="relative hidden md:block"
      style={
        pinTheater
          ? {
              height: `calc(${scenes.length} * (100vh - var(--header-h, 4rem)))`,
            }
          : undefined
      }
    >
      {stage}

      {pinTheater && (
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {scenes.map((scene, index) => (
            <div
              key={scene.slug}
              ref={(el) => {
                beatRefs.current[index] = el
              }}
              data-beat-index={index}
              style={
                { height: `${100 / scenes.length}%` } satisfies CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
