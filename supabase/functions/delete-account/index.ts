import { corsHeaders } from "../_shared/cors.ts"
import { createServiceClient, createUserClient } from "../_shared/supabase.ts"

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

Deno.serve(async (req) => {
  try {
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

    const userClient = createUserClient(authHeader)
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser()
    if (userErr || !user?.id) {
      return jsonResponse({ error: "Invalid or expired session" }, 401)
    }

    const supabase = createServiceClient()
    const userId = user.id

    // Purge avatar files before deleting the user — once the auth row is gone the
    // service client can still access storage, but doing it first is safer and
    // avoids orphaned objects if the delete step fails. Never block delete on cleanup.
    const { data: avatarList, error: listErr } = await supabase.storage
      .from("avatars")
      .list(userId)
    if (listErr) {
      console.error("delete-account avatars list error", listErr)
    } else if (avatarList?.length) {
      const paths = avatarList.map((o) => `${userId}/${o.name}`)
      const { error: removeErr } = await supabase.storage.from("avatars").remove(paths)
      if (removeErr) console.error("delete-account avatars remove error", removeErr)
    }

    const { error } = await supabase.auth.admin.deleteUser(userId)

    if (error) {
      console.error("delete-account auth.admin.deleteUser error", error)
      return jsonResponse(
        {
          error: "Failed to delete account",
          details: error.message,
        },
        500,
      )
    }

    return jsonResponse({ success: true })
  } catch (e) {
    console.error("delete-account unhandled error", e)
    return jsonResponse({ error: "Failed to delete account" }, 500)
  }
})
