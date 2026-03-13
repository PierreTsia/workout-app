import { useExerciseById } from "@/hooks/useExerciseById"

export function useExerciseFromLibrary(exerciseId: string) {
  const { data, isLoading } = useExerciseById(exerciseId)
  return {
    data: data ?? undefined,
    isLoading,
  }
}
