import { renderToStaticMarkup } from 'react-dom/server'

import { SessionCard } from './SessionCard'
import { examplePayload } from './example'
import { labelsFor } from './labels'
import type { SessionCardLabels, SessionCardPayload } from './types'

export function renderMarkup(payload: SessionCardPayload, labels: SessionCardLabels): string {
  return renderToStaticMarkup(<SessionCard payload={payload} labels={labels} />)
}

export function renderExampleSessionCard(): string {
  return renderMarkup(examplePayload, labelsFor(examplePayload.locale))
}
