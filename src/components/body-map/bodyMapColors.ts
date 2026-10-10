/**
 * Seven-step ramp for volume-weighted maps (must stay in sync with
 * BODY_MAP_VOLUME_BUCKET_COUNT).
 */
export const BODY_MAP_INTENSITY_COLORS = [
  "hsl(var(--nomos-color-primary) / 0.18)",
  "hsl(var(--nomos-color-primary) / 0.30)",
  "hsl(var(--nomos-color-primary) / 0.44)",
  "hsl(var(--nomos-color-primary) / 0.56)",
  "hsl(var(--nomos-color-primary) / 0.70)",
  "hsl(var(--nomos-color-primary) / 0.84)",
  "hsl(var(--nomos-color-primary))",
] as const
