/**
 * The shared, dependency-free **MCP Apps view bridge** (ADR 0027/0028, SEP-1865). It speaks
 * JSON-RPC 2.0 over `postMessage`: handshake, receiving the tool result, reporting size, and
 * — for a **Decision Card** — calling a tool through the host (`tools/call`).
 *
 * It never writes anything the host owns (ADR 0028): `callTool` *asks* the host to run a
 * tool; the host arbitrates. Requests reject on a JSON-RPC `error` and on a timeout, so a
 * view can never get stuck in an "applying" state.
 */

export const PROTOCOL_VERSION = '2026-01-26'

/** Default per-request timeout. Generous enough for a slow host, short enough to unblock the UI. */
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000

export type AppBridgeOptions = {
  appInfo: { name: string; version: string }
  /** The host pushed a tool result — its `structuredContent` carries the view's payload. */
  onToolResult: (structuredContent: unknown) => void
  /** Optional host appearance (theme) and locale pushed after the handshake. */
  onHostContext?: (context: { theme?: string; locale?: string }) => void
  /**
   * Element whose size is reported to the host (`ui/notifications/size-changed`). Without
   * it the host keeps a default iframe height and **clips** tall views.
   */
  observeSize?: HTMLElement
  /** Override the per-request timeout. */
  requestTimeoutMs?: number
}

export type AppBridge = {
  /** Ask the host to call an MCP tool (SEP-1865 `tools/call`). Rejects on error or timeout. */
  callTool: (name: string, args?: Record<string, unknown>) => Promise<unknown>
}

type JsonRpcMessage = {
  jsonrpc?: string
  id?: string | number | null
  method?: string
  params?: unknown
  result?: unknown
  error?: { code?: number; message?: string }
}

type Pending = {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export function connectAppBridge(
  win: Window,
  { appInfo, onToolResult, onHostContext, observeSize, requestTimeoutMs }: AppBridgeOptions,
): AppBridge {
  const pending = new Map<number, Pending>()
  const timeoutMs = requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  let seq = 0

  const post = (message: Record<string, unknown>) => win.parent.postMessage(message, '*')

  win.addEventListener('message', (event: MessageEvent) => {
    const message = event.data as JsonRpcMessage | undefined
    if (!message || message.jsonrpc !== '2.0') return

    if (typeof message.id === 'number' && pending.has(message.id)) {
      const entry = pending.get(message.id)!
      pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error) {
        entry.reject(new Error(message.error.message ?? 'MCP Apps request failed'))
      } else {
        entry.resolve(message.result)
      }
      return
    }

    if (message.method === 'ui/notifications/tool-result') {
      const params = message.params as { structuredContent?: unknown } | undefined
      onToolResult(params?.structuredContent)
    }

    if (message.method === 'ui/notifications/host-context-changed') {
      onHostContext?.(message.params as { theme?: string; locale?: string })
    }
  })

  const request = (method: string, params: unknown) =>
    new Promise<unknown>((resolve, reject) => {
      const id = ++seq
      const timer = setTimeout(() => {
        pending.delete(id)
        reject(new Error(`MCP Apps request timed out: ${method}`))
      }, timeoutMs)
      pending.set(id, { resolve, reject, timer })
      post({ jsonrpc: '2.0', id, method, params })
    })

  const reportSize = () => {
    if (!observeSize) return
    post({
      jsonrpc: '2.0',
      method: 'ui/notifications/size-changed',
      params: { width: observeSize.scrollWidth, height: observeSize.scrollHeight },
    })
  }

  // A failed handshake is silent: the view keeps its pre-rendered fallback (ADR 0027).
  void request('ui/initialize', {
    appInfo,
    appCapabilities: {},
    protocolVersion: PROTOCOL_VERSION,
  })
    .then((result) => {
      // SEP-1865: the initial host context (theme + locale) rides the initialize result.
      const hostContext = (result as { hostContext?: { theme?: string; locale?: string } } | undefined)
        ?.hostContext
      if (hostContext) onHostContext?.(hostContext)
      post({ jsonrpc: '2.0', method: 'ui/notifications/initialized' })
      reportSize()
      if (observeSize && typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(reportSize).observe(observeSize)
      }
    })
    .catch(() => {})

  return {
    callTool: (name, args) => request('tools/call', { name, arguments: args ?? {} }),
  }
}
