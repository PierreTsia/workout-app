import { corsHeaders } from "../_shared/cors.ts"
import { decodeJwt } from "../_shared/aiQuota.ts"
import { createServiceClient } from "../_shared/supabase.ts"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Missing authorization header" }, 401)
  }

  const token = authHeader.replace("Bearer ", "")
  const jwt = decodeJwt(token)
  if (!jwt?.sub) {
    return jsonResponse({ error: "Could not extract user from token" }, 401)
  }

  const supabase = createServiceClient()
  const userId = jwt.sub

  // Purge avatar files before deleting the user — once the auth row is gone the
  // service client can still access storage, but doing it first is safer and
  // avoids orphaned objects if the delete step fails.
  const { data: avatarList } = await supabase.storage.from("avatars").list(userId)
  if (avatarList?.length) {
    const paths = avatarList.map((o) => `${userId}/${o.name}`)
    await supabase.storage.from("avatars").remove(paths)
  }

  const { error } = await supabase.auth.admin.deleteUser(userId)

  if (error) {
    console.error("delete-account error", error)
    return jsonResponse({ error: "Failed to delete account" }, 500)
  }

  return jsonResponse({ success: true })
})
