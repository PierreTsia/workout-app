import { createRoot } from 'react-dom/client'

import { connectAppBridge } from './bridge'
import { SessionCard } from './SessionCard'
import { examplePayload } from './example'
import { labelsFor } from './labels'
import type { SessionCardPayload } from './types'

/**
 * The view's client entry (ADR 0027, T285): it connects to the MCP Apps host through the
 * dependency-free bridge, receives the tool result and re-renders the card with the real
 * payload. Until the result arrives (or on a host that pushes none), the pre-rendered
 * example stays visible.
 */
const rootElement = document.getElementById('gl-view-root')

if (rootElement) {
  const root = createRoot(rootElement)
  const render = (payload: SessionCardPayload) => {
    root.render(<SessionCard payload={payload} labels={labelsFor(payload.locale ?? 'en')} />)
  }

  render(examplePayload)

  connectAppBridge(window, {
    appInfo: { name: 'gymlogic-session-card', version: '1.0.0' },
    observeSize: rootElement,
    onToolResult: (structuredContent) => {
      if (structuredContent && typeof structuredContent === 'object' && 'session' in structuredContent) {
        render(structuredContent as SessionCardPayload)
      }
    },
  })
}
