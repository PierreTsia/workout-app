/**
 * Import specifiers of a module read with `?raw`, for the purity guards that
 * assert a pure lib pulls in neither React nor i18next.
 *
 * Covers all three ways a module can name a dependency — `from "x"`, the
 * side-effect `import "x"`, and the dynamic `import("x")` — because a guard
 * that only reads one of them announces a purity it isn't checking.
 *
 * Type-only imports are listed too. That is a deliberate false positive: a
 * module that claims to need no i18n has no reason to name i18next at all, and
 * the day one legitimately needs a type, the failing test is the right place to
 * have that conversation.
 */
export function importedModules(source: string): string[] {
  return [
    ...source.matchAll(/\b(?:from|import)\s*\(?\s*["']([^"']+)["']/g),
  ].map(([, specifier]) => specifier)
}

/** Specifiers that pull in `module`, directly or as part of its ecosystem. */
export function importsOf(source: string, module: string): string[] {
  return importedModules(source).filter((specifier) =>
    specifier.includes(module),
  )
}
