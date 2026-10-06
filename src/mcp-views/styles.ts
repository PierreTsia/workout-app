/**
 * Layout styles shared by the GymLogic **MCP App Views** (ADR 0027). Kept minimal: only what
 * is *not* a Nomos component token (the outer panel box). Semantic type and color come from
 * Nomos primitives; this file stops the two cards from duplicating the same box.
 */
export const panel = {
  width: '100%',
  maxWidth: 520,
  margin: '0 auto',
  padding: 12,
  boxSizing: 'border-box' as const,
}

export type ViewTheme = 'dark' | 'light'
