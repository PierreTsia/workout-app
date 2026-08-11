import { useState, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import { DeviceFrame } from './DeviceFrame'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { tourStageImageStyle } from '@/lib/tourMotion'
import { tourShotFade } from '@/lib/tourTransitions'
import { cn } from '@/lib/utils'

export type TourResolvedShot = {
  src: string
  width: number
  height: number
  alt: string
  focal: string
}

type TourSceneStageProps = {
  device: 'phone' | 'desktop'
  shots: TourResolvedShot[]
  className?: string
  /** Align device to the end of the stage (desktop split) or center (mobile). */
  align?: 'end' | 'center'
}

export function TourSceneStage({
  device,
  shots,
  className,
  align = 'center',
}: TourSceneStageProps) {
  const [shotIndex, setShotIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion() ?? false
  const active = shots[shotIndex] ?? shots[0]
  if (!active) return null

  const isLaptop = device === 'desktop'

  const kenBurns = tourStageImageStyle({
    focal: active.focal,
    active: true,
    reducedMotion: prefersReducedMotion,
  })

  const justify =
    align === 'end'
      ? 'items-center justify-end'
      : 'items-center justify-center'

  const openShot = (index: number) => {
    setShotIndex(index)
    setLightboxOpen(true)
  }

  const stepShot = (delta: number) => {
    if (shots.length <= 1) return
    setShotIndex(
      (current) => (current + delta + shots.length) % shots.length,
    )
  }

  const handleLightboxKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (shots.length <= 1) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      stepShot(-1)
      return
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      stepShot(1)
    }
  }

  return (
    <div className={cn('flex h-full w-full flex-col gap-4', className)}>
      <div
        className={cn(
          'relative min-h-0 w-full flex-1 overflow-hidden',
          align === 'end' && 'ml-auto',
          isLaptop ? 'max-w-none' : 'max-w-md',
        )}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={`${active.src}-${shotIndex}`}
            className={cn('absolute inset-0 flex', justify)}
            initial={
              prefersReducedMotion
                ? false
                : { opacity: 0, filter: 'blur(4px)' }
            }
            animate={{
              opacity: 1,
              filter: 'blur(0px)',
              transition: {
                ...tourShotFade,
                opacity: { ...tourShotFade, delay: 0.04 },
                filter: { ...tourShotFade, delay: 0.04 },
              },
            }}
            exit={
              prefersReducedMotion
                ? undefined
                : {
                    opacity: 0,
                    filter: 'blur(3px)',
                    transition: {
                      duration: 0.22,
                      ease: tourShotFade.ease,
                    },
                  }
            }
          >
            <button
              type="button"
              onClick={() => openShot(shotIndex)}
              className={cn(
                'group relative max-h-full text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent',
                isLaptop
                  ? 'w-full max-w-full rounded-xl'
                  : 'rounded-[1.75rem]',
              )}
              aria-label={`Expand screenshot: ${active.alt}`}
            >
              <DeviceFrame
                device={device}
                src={active.src}
                alt={active.alt}
                width={active.width}
                height={active.height}
                objectPosition={active.focal}
                className={
                  isLaptop
                    ? 'w-full max-w-full self-center transition duration-150 group-hover:ring-2 group-hover:ring-accent/50'
                    : 'max-h-full max-w-[260px] transition duration-150 group-hover:ring-2 group-hover:ring-accent/50'
                }
                imageClassName={
                  isLaptop
                    ? 'aspect-video w-full object-cover will-change-transform'
                    : 'will-change-transform'
                }
                imageStyle={{
                  transformOrigin: kenBurns.transformOrigin,
                  animationName: kenBurns.animationName,
                  animationDuration: '14s',
                  animationTimingFunction: 'ease-out',
                  animationFillMode: 'forwards',
                }}
              />
              <span className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto w-fit rounded-md bg-background/80 px-2 py-1 text-xs text-muted opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
                Expand
              </span>
            </button>
          </motion.div>
        </AnimatePresence>
      </div>

      {shots.length > 1 && (
        <div
          className={cn(
            'flex shrink-0 gap-3 rounded-lg border border-border/80 bg-surface/80 p-2',
            align === 'end' ? 'ml-auto justify-end' : 'justify-center',
          )}
          role="tablist"
          aria-label="Scene screenshots"
        >
          {shots.map((shot, index) => {
            const selected = index === shotIndex
            return (
              <button
                key={shot.src}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-label={`Show screenshot ${index + 1} of ${shots.length}`}
                onClick={() => setShotIndex(index)}
                className={cn(
                  'relative shrink-0 overflow-hidden rounded-md border-2 bg-card shadow-md shadow-black/40 transition duration-150',
                  isLaptop ? 'h-16 w-28' : 'h-20 w-14',
                  selected
                    ? 'border-accent opacity-100 ring-2 ring-accent/40'
                    : 'border-border opacity-100 hover:border-foreground/40',
                )}
              >
                <img
                  src={shot.src}
                  alt=""
                  width={shot.width}
                  height={shot.height}
                  className="h-full w-full object-cover object-top"
                  loading="lazy"
                  decoding="async"
                />
              </button>
            )
          })}
        </div>
      )}

      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent
          className="flex h-[min(94vh,90rem)] max-h-[min(96vh,90rem)] w-[min(98vw,96rem)] max-w-none flex-col gap-4 overflow-hidden border-border bg-background p-3 sm:p-5"
          onKeyDown={handleLightboxKeyDown}
        >
          <DialogTitle className="shrink-0 pr-8 text-base">
            Screenshot {shotIndex + 1} of {shots.length}
          </DialogTitle>
          <DialogDescription className="sr-only">{active.alt}</DialogDescription>

          {/*
            Height-driven stage: DeviceFrame fills the flex-1 area (h-full +
            aspect) instead of a width-capped island centered in dead space.
            max-w-full keeps narrow viewports from overflowing horizontally.
            Prev/next chevrons flank the frame when a scene has multiple shots.
          */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center gap-1 overflow-hidden sm:gap-3">
            {shots.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute left-0 z-10 h-11 w-11 shrink-0 bg-background/90 sm:static sm:h-12 sm:w-12"
                aria-label="Previous screenshot"
                onClick={() => stepShot(-1)}
              >
                <ChevronLeft className="size-5" />
              </Button>
            )}

            <DeviceFrame
              device={device}
              src={active.src}
              alt={active.alt}
              width={active.width}
              height={active.height}
              objectPosition={active.focal}
              className={
                isLaptop
                  ? 'mx-auto h-full max-h-full w-auto max-w-full aspect-video'
                  : 'mx-auto h-full max-h-full w-auto max-w-full aspect-[9/19.5]'
              }
              imageClassName={
                // Outer frame owns aspect + height; image fills the bezel so
                // short captures cover instead of letterboxing inside the PNG.
                'aspect-auto h-full max-h-none w-full object-cover'
              }
            />

            {shots.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="absolute right-0 z-10 h-11 w-11 shrink-0 bg-background/90 sm:static sm:h-12 sm:w-12"
                aria-label="Next screenshot"
                onClick={() => stepShot(1)}
              >
                <ChevronRight className="size-5" />
              </Button>
            )}
          </div>

          {shots.length > 1 && (
            <div
              className="flex shrink-0 justify-center gap-3"
              role="tablist"
              aria-label="Choose screenshot"
            >
              {shots.map((shot, index) => {
                const selected = index === shotIndex
                return (
                  <button
                    key={`lightbox-${shot.src}`}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-label={`Show screenshot ${index + 1}`}
                    onClick={() => setShotIndex(index)}
                    className={cn(
                      'relative shrink-0 overflow-hidden rounded-md border-2 bg-card transition duration-150',
                      isLaptop ? 'h-16 w-28' : 'h-24 w-16',
                      selected
                        ? 'border-accent ring-2 ring-accent/40'
                        : 'border-border hover:border-foreground/40',
                    )}
                  >
                    <img
                      src={shot.src}
                      alt=""
                      width={shot.width}
                      height={shot.height}
                      className="h-full w-full object-cover object-top"
                    />
                  </button>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
