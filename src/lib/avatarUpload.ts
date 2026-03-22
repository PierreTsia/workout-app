import { supabase } from "@/lib/supabase"

export const AVATAR_MAX_BYTES = 1.5 * 1024 * 1024

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export function assertAvatarFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("INVALID_AVATAR_TYPE")
  }
  if (file.size > AVATAR_MAX_BYTES) {
    throw new Error("INVALID_AVATAR_SIZE")
  }
}

function extensionForMime(mime: string): string {
  if (mime === "image/png") return "png"
  if (mime === "image/webp") return "webp"
  return "jpg"
}

/** Uploads to `avatars/{userId}/avatar.{ext}` (upsert). Returns public URL. */
export async function uploadUserAvatar(userId: string, file: File): Promise<string> {
  assertAvatarFile(file)
  const ext = extensionForMime(file.type)
  const path = `${userId}/avatar.${ext}`
  const { error } = await supabase.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "600",
  })
  if (error) throw error
  const { data } = supabase.storage.from("avatars").getPublicUrl(path)
  return data.publicUrl
}

/** Removes all objects under `avatars/{userId}/` (best-effort). */
export async function removeUserAvatarFiles(userId: string): Promise<void> {
  const { data: list, error: listErr } = await supabase.storage.from("avatars").list(userId)
  if (listErr || !list?.length) return
  const paths = list.map((o) => `${userId}/${o.name}`)
  await supabase.storage.from("avatars").remove(paths)
}
