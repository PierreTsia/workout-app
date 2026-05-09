import { describe, it, expect, beforeEach, vi } from "vitest"
import {
  buildErrorReport,
  formatReportAsMarkdown,
  makeErrorId,
} from "./errorReport"

describe("makeErrorId", () => {
  it("is deterministic across calls (same crash signature → same id)", () => {
    const error = new Error("Boom")
    error.stack = "Error: Boom\n  at foo.ts:1"
    const a = makeErrorId(error)
    const b = makeErrorId(error)
    expect(a).toEqual(b)
  })

  it("returns the err_xxxxxx format", () => {
    expect(makeErrorId(new Error("x"))).toMatch(/^err_[0-9a-f]{6}$/)
  })

  it("yields the same id for two different Error instances with the same signature", () => {
    const stack = "Error: same\n  at same.ts:1"
    const a = new Error("same")
    a.stack = stack
    const b = new Error("same")
    b.stack = stack
    expect(makeErrorId(a)).toEqual(makeErrorId(b))
  })

  it("differs when the message changes", () => {
    expect(makeErrorId(new Error("a"))).not.toEqual(makeErrorId(new Error("b")))
  })

  it("handles errors with no stack", () => {
    const e = new Error("no stack")
    delete (e as { stack?: string }).stack
    expect(() => makeErrorId(e)).not.toThrow()
  })
})

describe("buildErrorReport", () => {
  beforeEach(() => {
    vi.stubGlobal("__APP_VERSION__", "v-test")
  })

  it("captures all relevant fields", () => {
    const error = new Error("Boom")
    error.stack = "Error: Boom\n  at foo.ts:1"
    const report = buildErrorReport({
      id: "err_abc123",
      error,
      componentStack: "  at <Foo>\n  at <Bar>",
      route: "/historique",
      userAgent: "TestAgent/1.0",
      now: new Date("2026-05-09T12:30:00Z"),
    })

    expect(report).toEqual({
      id: "err_abc123",
      message: "Boom",
      stack: "Error: Boom\n  at foo.ts:1",
      componentStack: "  at <Foo>\n  at <Bar>",
      route: "/historique",
      userAgent: "TestAgent/1.0",
      appVersion: "v-test",
      timestamp: "2026-05-09T12:30:00.000Z",
    })
  })

  it("falls back to window.location when no route is provided", () => {
    const report = buildErrorReport({
      id: "err_x",
      error: new Error("x"),
    })
    expect(report.route).toContain("/")
  })

  it("uses 'unknown' when __APP_VERSION__ is missing", () => {
    vi.stubGlobal("__APP_VERSION__", undefined)
    const report = buildErrorReport({
      id: "err_x",
      error: new Error("x"),
    })
    expect(report.appVersion).toBe("unknown")
  })
})

describe("formatReportAsMarkdown", () => {
  it("includes id, route, ua, version, message", () => {
    const md = formatReportAsMarkdown({
      id: "err_abc123",
      message: "Boom",
      stack: null,
      componentStack: null,
      route: "/historique",
      userAgent: "TestAgent/1.0",
      appVersion: "v-test",
      timestamp: "2026-05-09T12:30:00.000Z",
    })
    expect(md).toContain("`err_abc123`")
    expect(md).toContain("/historique")
    expect(md).toContain("TestAgent/1.0")
    expect(md).toContain("v-test")
    expect(md).toContain("Boom")
  })

  it("omits stack and component stack sections when absent", () => {
    const md = formatReportAsMarkdown({
      id: "err_x",
      message: "x",
      stack: null,
      componentStack: null,
      route: "",
      userAgent: "",
      appVersion: "v",
      timestamp: "t",
    })
    expect(md).not.toContain("**Stack**")
    expect(md).not.toContain("**Component stack**")
  })

  it("includes stack and component stack sections when present", () => {
    const md = formatReportAsMarkdown({
      id: "err_x",
      message: "x",
      stack: "stack-trace",
      componentStack: "comp-stack",
      route: "/",
      userAgent: "ua",
      appVersion: "v",
      timestamp: "t",
    })
    expect(md).toContain("**Stack**")
    expect(md).toContain("stack-trace")
    expect(md).toContain("**Component stack**")
    expect(md).toContain("comp-stack")
  })
})
