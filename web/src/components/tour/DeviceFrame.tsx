import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

export type DeviceFrameProps = {
  device: 'phone' | 'desktop'
  src: string
  alt: string
  width: number
  height: number
  className?: string
  imageClassName?: string
  imageStyle?: CSSProperties
  /**
   * CSS object-position for cover cropping (Tour focals, e.g. "50% 35%").
   * Short captures still fill the bezel; the focal keeps the useful UI in view.
   */
  objectPosition?: string
}

export function DeviceFrame({
  device,
  src,
  alt,
  width,
  height,
  className,
  imageClassName,
  imageStyle,
  objectPosition = '50% 20%',
}: DeviceFrameProps) {
  if (device === 'desktop') {
    return (
      <div
        className={cn(
          'flex w-full max-w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/40',
          className,
        )}
      >
        <div className="flex shrink-0 items-center gap-1.5 border-b border-border bg-background/80 px-3 py-2">
          <span className="size-2.5 rounded-full bg-muted" aria-hidden />
          <span className="size-2.5 rounded-full bg-muted" aria-hidden />
          <span className="size-2.5 rounded-full bg-muted" aria-hidden />
          <span className="ml-3 truncate text-xs text-muted">
            Laptop · Your agent
          </span>
        </div>
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          className={cn(
            'block min-h-0 w-full flex-1 aspect-video object-cover',
            imageClassName,
          )}
          style={{ objectPosition, ...imageStyle }}
          loading="lazy"
          decoding="async"
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-[280px] flex-col overflow-hidden rounded-[1.75rem] border-[3px] border-border bg-card shadow-lg shadow-black/40',
        className,
      )}
    >
      <div
        className="mx-auto mt-2 h-1.5 w-16 shrink-0 rounded-full bg-muted"
        aria-hidden
      />
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={cn(
          'mt-2 block min-h-0 w-full flex-1 aspect-[9/19.5] object-cover',
          imageClassName,
        )}
        style={{ objectPosition, ...imageStyle }}
        loading="lazy"
        decoding="async"
      />
    </div>
  )
}
