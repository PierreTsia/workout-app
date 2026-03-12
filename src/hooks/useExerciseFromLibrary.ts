import { useExerciseLibrary } from "@/hooks/useExerciseLibrary"

export function useExerciseFromLibrary(exerciseId: string) {
  const { data: exercises, isLoading } = useExerciseLibrary()
  return {
    data: exercises?.find((e) => e.id === exerciseId),
    isLoading,
  }
}
