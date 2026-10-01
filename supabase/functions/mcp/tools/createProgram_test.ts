/**
 * Description-drift guard for `create_program` (#289).
 *
 * The dry-run payload is flat (`{ dry_run, program, days }`), so the rendered
 * lines live at `days[].rendered` — there is no `preview` wrapper. The tool
 * description must point agents at the real key.
 */

import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { createProgram } from "./createProgram.ts"

Deno.test("create_program description points at flat days[].rendered, not preview.days", () => {
  const description = createProgram.description
  assert(
    !description.includes("preview.days"),
    "description must not reference the non-existent preview.days wrapper",
  )
  assertStringIncludes(description, "days[].rendered")
})
