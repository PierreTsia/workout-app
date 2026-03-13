import { supabase } from "@/lib/supabase"

const MAX_DIMENSION = 512
const QUALITY = 0.82

function toKebabCase(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

async function optimizeImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap

  let targetW = width
  let targetH = height
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    targetW = Math.round(width * ratio)
    targetH = Math.round(height * ratio)
  }

  const canvas = new OffscreenCanvas(targetW, targetH)
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close()

  const webpBlob = await canvas.convertToBlob({ type: "image/webp", quality: QUALITY })
  return webpBlob
}

export async function uploadExerciseImage(
  file: File,
  exerciseName: string,
  previousFilename?: string | null,
): Promise<string> {
  const optimized = await optimizeImage(file)
  const filename = `${toKebabCase(exerciseName)}.webp`

  if (previousFilename && previousFilename !== filename) {
    try {
      await supabase.storage.from("exercise-media").remove([previousFilename])
    } catch(error) {
      console.error(`Failed to delete previous image: ${error}`)
      // best-effort cleanup — don't block the upload
    }
  }

  const { error } = await supabase.storage
    .from("exercise-media")
    .upload(filename, optimized, {
      contentType: "image/webp",
      upsert: true,
    })

  if (error) throw error
  return filename
}
