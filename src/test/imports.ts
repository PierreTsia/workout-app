/**
 * Import specifiers of a module read with `?raw`, for the purity guards that
 * assert a pure lib pulls in neither React nor i18next.
 *
 * Parsing the specifiers and matching against the whole string is the point.
 * A regex anchored on the opening quote — `from\s+["']i18next` — reads as if it
 * forbids i18next while silently allowing `from "react-i18next"`, which is
 * exactly how a React developer would break purity.
 */
export function importedModules(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
    ([, specifier]) => specifier,
  )
}

/** Specifiers that pull in `module`, directly or as part of its ecosystem. */
export function importsOf(source: string, module: string): string[] {
  return importedModules(source).filter((specifier) =>
    specifier.includes(module),
  )
}
