/**
 * Minimal, dependency-free **MCP Apps view bridge** (ADR 0027, SEP-1865). The view's own
 * contract is tiny — a handshake and receiving the tool result — so we implement it
 * directly instead of pulling the `@modelcontextprotocol/ext-apps` SDK (+ its
 * `client`/`core`/`zod` tree) into every host's sandboxed iframe.
 *
 * The bridge only speaks JSON-RPC 2.0 over `postMessage`; it never mutates anything the
 * host owns (ADR 0023). If it fails, the view keeps its pre-rendered fallback.
 */

export const PROTOCOL_VERSION = '2026-01-26'

export type AppBridgeOptions = {
  appInfo: { name: string; version: string }
  /** The host pushed a tool result — its `structuredContent` carries the view's payload. */
  onToolResult: (structuredContent: unknown) => void
  /** Optional host appearance (theme) pushed after the handshake. */
  onHostContext?: (context: { theme?: string }) => void
}

type JsonRpcMessage = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: unknown
  result?: unknown
}

export function connectAppBridge(win: Window, { appInfo, onToolResult, onHostContext }: AppBridgeOptions): void {
  const pending = new Map<number, (result: unknown) => void>()
  let seq = 0

  const post = (message: Record<string, unknown>) => win.parent.postMessage(message, '*')

  win.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as JsonRpcMessage | undefined
    if (!message || message.jsonrpc !== '2.0') return

    if (typeof message.id === 'number' && pending.has(message.id)) {
      pending.get(message.id)?.(message.result)
      pending.delete(message.id)
      return
    }

    if (message.method === 'ui/notifications/tool-result') {
      const params = message.params as { structuredContent?: unknown } | undefined
      onToolResult(params?.structuredContent)
    }

    if (message.method === 'ui/notifications/host-context-changed') {
      onHostContext?.(message.params as { theme?: string })
    }
  })

  const request = (method: string, params: unknown) =>
    new Promise<unknown>((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      post({ jsonrpc: '2.0', id, method, params })
    })

  void request('ui/initialize', {
    appInfo,
    appCapabilities: {},
    protocolVersion: PROTOCOL_VERSION,
  }).then(() => {
    post({ jsonrpc: '2.0', method: 'ui/notifications/initialized' })
  })
}
