import { createRoot } from 'react-dom/client'

import { connectAppBridge } from '../bridge'
import { ProgramPatchCard } from './ProgramPatchCard'
import { examplePayload } from './example'
import { labelsFor } from './labels'
import type { ProgramPatchPayload, ProgramPatchViewState } from './types'

/**
 * The Decision Card view entry (ADR 0028): it receives the `update_program` preview through
 * the bridge, and on **Apply** asks the host to call `apply_program_patch` with the preview
 * token. It never writes directly — the host arbitrates (SEP-1865 `tools/call`).
 */
const rootElement = document.getElementById('gl-view-root')

if (rootElement) {
  const root = createRoot(rootElement)
  const locale: 'en' | 'fr' =
    typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')
      ? 'fr'
      : 'en'

  let payload: ProgramPatchPayload = examplePayload
  let state: ProgramPatchViewState = 'preview'

  const bridge = connectAppBridge(window, {
    appInfo: { name: 'gymlogic-program-patch', version: '1.0.0' },
    observeSize: rootElement,
    onToolResult: (structuredContent) => {
      if (structuredContent && typeof structuredContent === 'object' && 'status' in structuredContent) {
        payload = structuredContent as ProgramPatchPayload
        state = payload.status === 'applied' ? 'applied' : 'preview'
        render()
      }
    },
  })

  function render() {
    root.render(
      <ProgramPatchCard
        payload={payload}
        labels={labelsFor(locale)}
        state={state}
        onApply={apply}
      />,
    )
  }

  function apply() {
    if (!payload.preview_token) return
    state = 'applying'
    render()
    bridge
      .callTool('apply_program_patch', { preview_token: payload.preview_token })
      .then((result) => {
        const res = result as { isError?: boolean; structuredContent?: ProgramPatchPayload }
        if (res?.isError) {
          state = 'error'
        } else {
          if (res?.structuredContent) payload = res.structuredContent
          state = 'applied'
        }
        render()
      })
      .catch(() => {
        state = 'error'
        render()
      })
  }

  render()
}
