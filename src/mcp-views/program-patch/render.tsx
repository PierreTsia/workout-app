import { renderToStaticMarkup } from 'react-dom/server'

import { ProgramPatchCard } from './ProgramPatchCard'
import { examplePayload } from './example'
import { labelsFor } from './labels'
import type { ProgramPatchLabels, ProgramPatchPayload, ProgramPatchViewState } from './types'

export function renderMarkup(
  payload: ProgramPatchPayload,
  labels: ProgramPatchLabels,
  state: ProgramPatchViewState,
): string {
  return renderToStaticMarkup(
    <ProgramPatchCard payload={payload} labels={labels} state={state} onApply={() => {}} />,
  )
}

export function renderExampleProgramPatch(): string {
  return renderMarkup(examplePayload, labelsFor('en'), 'preview')
}
