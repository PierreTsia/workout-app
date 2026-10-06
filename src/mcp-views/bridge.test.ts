import { describe, expect, it, vi } from 'vitest'

import { connectAppBridge, PROTOCOL_VERSION } from './bridge'

function fakeWindow() {
  const listeners: Array<(event: MessageEvent) => void> = []
  const posted: Array<Record<string, unknown>> = []
  const win = {
    addEventListener: (_type: string, callback: (event: MessageEvent) => void) => {
      listeners.push(callback)
    },
    parent: { postMessage: (message: Record<string, unknown>) => posted.push(message) },
  }
  const emit = (data: unknown) => listeners.forEach((callback) => callback({ data } as MessageEvent))
  return { win: win as unknown as Window, posted, emit }
}

const connect = (win: Window, extra: Record<string, unknown> = {}) =>
  connectAppBridge(win, { appInfo: { name: 'x', version: '1' }, onToolResult: vi.fn(), ...extra })

describe("MCP Apps view bridge", () => {
  it("opens the handshake with ui/initialize and announces readiness", async () => {
    const { win, posted, emit } = fakeWindow()
    connect(win)

    const init = posted[0]
    expect(init.jsonrpc).toBe("2.0")
    expect(init.method).toBe("ui/initialize")
    expect(init.params).toMatchObject({
      appInfo: { name: "x", version: "1" },
      protocolVersion: PROTOCOL_VERSION,
    })

    emit({ jsonrpc: "2.0", id: init.id, result: {} })
    await Promise.resolve()
    expect(posted[1]).toMatchObject({ jsonrpc: "2.0", method: "ui/notifications/initialized" })
  })

  it("forwards the host theme carried by the ui/initialize result", async () => {
    const { win, posted, emit } = fakeWindow()
    const onHostContext = vi.fn()
    connect(win, { onHostContext })

    emit({ jsonrpc: "2.0", id: posted[0].id, result: { hostContext: { theme: "light" } } })
    await Promise.resolve()

    expect(onHostContext).toHaveBeenCalledWith({ theme: "light" })
  })

  it("forwards the host locale alongside the theme", async () => {
    const { win, posted, emit } = fakeWindow()
    const onHostContext = vi.fn()
    connect(win, { onHostContext })

    emit({
      jsonrpc: "2.0",
      id: posted[0].id,
      result: { hostContext: { theme: "dark", locale: "fr-FR" } },
    })
    await Promise.resolve()

    expect(onHostContext).toHaveBeenCalledWith({ theme: "dark", locale: "fr-FR" })
  })

  it("forwards locale-only host-context changes", () => {
    const { win, emit } = fakeWindow()
    const onHostContext = vi.fn()
    connect(win, { onHostContext })

    emit({
      jsonrpc: "2.0",
      method: "ui/notifications/host-context-changed",
      params: { locale: "fr-FR" },
    })

    expect(onHostContext).toHaveBeenCalledWith({ locale: "fr-FR" })
  })

  it("reports the view size so the host does not clip it", async () => {
    const { win, posted, emit } = fakeWindow()
    const observeSize = { scrollWidth: 400, scrollHeight: 900 } as HTMLElement
    connect(win, { observeSize })

    emit({ jsonrpc: "2.0", id: posted[0].id, result: {} })
    await Promise.resolve()
    await Promise.resolve()

    expect(posted.find((m) => m.method === "ui/notifications/size-changed")?.params).toEqual({
      width: 400,
      height: 900,
    })
  })

  it("delivers the tool result's structuredContent to the view", () => {
    const { win, emit } = fakeWindow()
    const onToolResult = vi.fn()
    connect(win, { onToolResult })

    emit({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: { status: "preview" } },
    })

    expect(onToolResult).toHaveBeenCalledWith({ status: "preview" })
  })

  it("ignores foreign postMessage traffic", () => {
    const { win, emit } = fakeWindow()
    const onToolResult = vi.fn()
    connect(win, { onToolResult })

    emit({ not: "jsonrpc" })
    emit({ jsonrpc: "2.0", method: "ui/notifications/tool-result" })

    expect(onToolResult).toHaveBeenCalledTimes(1)
    expect(onToolResult).toHaveBeenCalledWith(undefined)
  })

  it("asks the host to call a tool and resolves the result", async () => {
    const { win, posted, emit } = fakeWindow()
    const bridge = connect(win, { requestTimeoutMs: 50 })
    emit({ jsonrpc: "2.0", id: posted[0].id, result: {} })
    await Promise.resolve()

    const call = bridge.callTool("apply_program_patch", { preview_token: "t" })
    const req = posted.find((m) => m.method === "tools/call")
    expect(req?.params).toEqual({ name: "apply_program_patch", arguments: { preview_token: "t" } })

    emit({ jsonrpc: "2.0", id: req!.id, result: { structuredContent: { status: "applied" } } })
    await expect(call).resolves.toEqual({ structuredContent: { status: "applied" } })
  })

  it("rejects on a JSON-RPC error so the view cannot hang", async () => {
    const { win, posted, emit } = fakeWindow()
    const bridge = connect(win, { requestTimeoutMs: 50 })
    emit({ jsonrpc: "2.0", id: posted[0].id, result: {} })
    await Promise.resolve()

    const call = bridge.callTool("apply_program_patch", { preview_token: "t" })
    const req = posted.find((m) => m.method === "tools/call")
    emit({ jsonrpc: "2.0", id: req!.id, error: { code: -32000, message: "denied" } })

    await expect(call).rejects.toThrow("denied")
  })

  it("rejects on timeout", async () => {
    const { win, posted, emit } = fakeWindow()
    const bridge = connect(win, { requestTimeoutMs: 5 })
    emit({ jsonrpc: "2.0", id: posted[0].id, result: {} })
    await Promise.resolve()

    await expect(bridge.callTool("apply_program_patch", { preview_token: "t" })).rejects.toThrow(
      /timed out/,
    )
  })
})
