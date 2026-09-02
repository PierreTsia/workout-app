export function listLibraryPrograms<T extends { is_active: boolean }>(
  programs: readonly T[],
): T[] {
  return [
    ...programs.filter((program) => program.is_active),
    ...programs.filter((program) => !program.is_active),
  ]
}
