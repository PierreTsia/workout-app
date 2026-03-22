/** Thrown when display_name violates unique index (Postgres 23505). */
export class DisplayNameTakenError extends Error {
  constructor() {
    super("DisplayNameTakenError")
    this.name = "DisplayNameTakenError"
  }
}

export function isDisplayNameTakenError(e: unknown): boolean {
  return e instanceof DisplayNameTakenError
}
