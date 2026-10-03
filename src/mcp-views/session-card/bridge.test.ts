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

describe("MCP Apps view bridge", () => {
  it("opens the handshake with ui/initialize and announces readiness", async () => {
    const { win, posted, emit } = fakeWindow()
    connectAppBridge(win, { appInfo: { name: "x", version: "1" }, onToolResult: vi.fn() })

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

  it("delivers the tool result's structuredContent to the view", () => {
    const { win, emit } = fakeWindow()
    const onToolResult = vi.fn()
    connectAppBridge(win, { appInfo: { name: "x", version: "1" }, onToolResult })

    emit({
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: { session: null, tonnageKg: 0, items: [] } },
    })

    expect(onToolResult).toHaveBeenCalledWith({ session: null, tonnageKg: 0, items: [] })
  })

  it("ignores foreign postMessage traffic", () => {
    const { win, emit } = fakeWindow()
    const onToolResult = vi.fn()
    connectAppBridge(win, { appInfo: { name: "x", version: "1" }, onToolResult })

    emit({ not: "jsonrpc" })
    emit({ jsonrpc: "2.0", method: "ui/notifications/tool-result" })

    expect(onToolResult).toHaveBeenCalledTimes(1)
    expect(onToolResult).toHaveBeenCalledWith(undefined)
  })
})
