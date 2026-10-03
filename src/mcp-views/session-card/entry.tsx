import { App } from '@modelcontextprotocol/ext-apps'
import { createRoot } from 'react-dom/client'

import { SessionCard } from './SessionCard'
import { examplePayload } from './example'
import { labelsFor } from './labels'
import type { SessionCardPayload } from './types'

/**
 * The view's client entry (ADR 0027, T285): it connects to the MCP Apps host, receives the
 * tool result and re-renders the card with the real payload. Until the result arrives (or
 * on a host that pushes none), it shows the pre-rendered example.
 */
const rootElement = document.getElementById('gl-view-root')

if (rootElement) {
  const root = createRoot(rootElement)
  const render = (payload: SessionCardPayload) => {
    root.render(<SessionCard payload={payload} labels={labelsFor(payload.locale ?? 'en')} />)
  }

  render(examplePayload)

  const app = new App({ name: 'gymlogic-session-card', version: '1.0.0' })
  app.ontoolresult = (params) => {
    const payload = params.structuredContent
    if (payload && typeof payload === 'object' && 'session' in payload) {
      render(payload as SessionCardPayload)
    }
  }
  app.connect().catch(() => {})
}
