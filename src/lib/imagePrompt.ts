export function buildImagePrompt(exerciseName: string): string {
  return `Crée une illustration simple style SVG d'un exercice de fitness ${exerciseName}. No text, only the illustration. Le résultat doit être optimisé pour le web (webp et moins de 500 kb).`
}
