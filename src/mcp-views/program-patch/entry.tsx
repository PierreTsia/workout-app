import { createRoot } from 'react-dom/client'

import { connectAppBridge } from '../bridge'
import { resolveViewLocale } from '../locale'
import { ProgramPatchCard } from './ProgramPatchCard'
import { examplePayload } from './example'
import { labelsFor } from './labels'
import type { ViewTheme } from '../styles'
import type { ProgramPatchPayload, ProgramPatchViewState } from './types'

/**
 * The Decision Card view entry (ADR 0028/0031): it receives the `update_program` preview
 * through the bridge, renders the structured program, and on **Apply** asks the host to call
 * `apply_program_patch` with the preview token. It never writes directly — the host
 * arbitrates (SEP-1865 `tools/call`). Copy locale comes from the payload; when the payload
 * carries none (no explicit argument, no stored seed) the **host** locale decides (Display
 * Locale). The host theme drives `data-theme`.
 */
const rootElement = document.getElementById('gl-view-root')

if (rootElement) {
  const root = createRoot(rootElement)
  let payload: ProgramPatchPayload = examplePayload
  let state: ProgramPatchViewState = 'preview'
  let theme: ViewTheme = 'dark'
  let hostLocale: string | undefined

  const render = () => {
    root.render(
      <ProgramPatchCard
        payload={payload}
        labels={labelsFor(resolveViewLocale(payload.locale, hostLocale))}
        state={state}
        onApply={apply}
        theme={theme}
      />,
    )
  }

  const bridge = connectAppBridge(window, {
    appInfo: { name: 'gymlogic-program-patch', version: '1.0.0' },
    observeSize: rootElement,
    onToolResult: (structuredContent) => {
      if (
        structuredContent &&
        typeof structuredContent === 'object' &&
        'status' in structuredContent
      ) {
        payload = structuredContent as ProgramPatchPayload
        state = payload.status === 'applied' ? 'applied' : 'preview'
        render()
      }
    },
    onHostContext: (context) => {
      // Partial updates (SEP-1865): merge, never reset a field the host didn't send.
      if (context.theme) theme = context.theme === 'light' ? 'light' : 'dark'
      if (context.locale) hostLocale = context.locale
      render()
    },
  })

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
