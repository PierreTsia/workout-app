export function getExerciseImageUrl(imagePath: string): string {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string
  return `${baseUrl}/storage/v1/object/public/exercise-media/${imagePath}`
}
