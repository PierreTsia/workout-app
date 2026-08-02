import { describe, it, expect, vi, afterEach } from "vitest"

import { copyToClipboard } from "./clipboard"

// Restored after every test: a leaked stub makes another file in the same
// Vitest worker pass or fail depending on the order it ran in.
const originalClipboard = Object.getOwnPropertyDescriptor(
  Navigator.prototype,
  "clipboard",
)
const originalExecCommand = Object.getOwnPropertyDescriptor(
  Document.prototype,
  "execCommand",
)

const restore = (
  target: object,
  property: string,
  descriptor: PropertyDescriptor | undefined,
) => {
  delete (target as Record<string, unknown>)[property]
  if (descriptor) Object.defineProperty(target, property, descriptor)
}

const stub = (target: object, property: string, value: unknown) =>
  Object.defineProperty(target, property, { value, configurable: true })

afterEach(() => {
  restore(navigator, "clipboard", originalClipboard)
  restore(document, "execCommand", originalExecCommand)
})

describe("copyToClipboard", () => {
  it("writes through the clipboard API when the browser offers one", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stub(navigator, "clipboard", { writeText })

    await expect(copyToClipboard("the request")).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith("the request")
  })

  // An insecure context — the app opened over the LAN on a phone — either hides
  // the API entirely or exposes it and rejects. Both have to reach the legacy
  // path, or the reviewer's only way to move the text is to select it by hand.
  it.each([
    ["there is no clipboard API", undefined],
    ["the clipboard API refuses", { writeText: () => Promise.reject(new Error("denied")) }],
  ])("falls back to the legacy copy when %s", async (_case, clipboard) => {
    stub(navigator, "clipboard", clipboard)
    const execCommand = vi.fn().mockReturnValue(true)
    stub(document, "execCommand", execCommand)

    await expect(copyToClipboard("the request")).resolves.toBe(true)
    expect(execCommand).toHaveBeenCalledWith("copy")
  })

  it("reports failure when both paths refuse", async () => {
    stub(navigator, "clipboard", undefined)
    stub(document, "execCommand", () => false)

    await expect(copyToClipboard("the request")).resolves.toBe(false)
  })

  // The carrier is appended to the body, so a leak is one hidden node per
  // attempt — invisible until a reviewer has pressed the button forty times.
  it("leaves no carrier behind, even when the legacy copy throws", async () => {
    stub(navigator, "clipboard", undefined)
    stub(document, "execCommand", () => {
      throw new Error("not supported")
    })

    await expect(copyToClipboard("the request")).resolves.toBe(false)
    expect(document.querySelectorAll("textarea")).toHaveLength(0)
  })
})
