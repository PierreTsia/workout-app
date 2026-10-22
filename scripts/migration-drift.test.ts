import { describe, expect, it } from "vitest"
import { compareMigrationVersions } from "./migration-drift.js"

describe("compareMigrationVersions", () => {
  it("reports nothing when the repo and the database agree", () => {
    expect(compareMigrationVersions(["1", "2"], ["1", "2"])).toEqual({
      remoteOnly: [],
      localOnly: [],
    })
  })

  it("names a version applied in the database but absent from the repo", () => {
    expect(compareMigrationVersions(["1"], ["1", "19990101000000"])).toEqual({
      remoteOnly: ["19990101000000"],
      localOnly: [],
    })
  })

  it("reports repo-only versions without calling them drift", () => {
    expect(compareMigrationVersions(["1", "2"], ["1"])).toEqual({
      remoteOnly: [],
      localOnly: ["2"],
    })
  })

  it("sorts both sides so the output is stable", () => {
    expect(compareMigrationVersions(["3", "1"], ["4", "2"])).toEqual({
      remoteOnly: ["2", "4"],
      localOnly: ["1", "3"],
    })
  })
})
