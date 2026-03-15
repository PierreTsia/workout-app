import { useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ExerciseContentFeedback, FeedbackStatus } from "@/types/database"

interface UpdateStatusParams {
  id: string
  status: FeedbackStatus
  adminEmail: string
}

export function useAdminUpdateFeedbackStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, status, adminEmail }: UpdateStatusParams) => {
      const payload =
        status === "resolved"
          ? { status, resolved_at: new Date().toISOString(), resolved_by: adminEmail }
          : status === "pending"
            ? { status, resolved_at: null, resolved_by: null }
            : { status }

      const { error } = await supabase
        .from("exercise_content_feedback")
        .update(payload)
        .eq("id", id)
      if (error) throw error
    },
    onMutate: async ({ id, status, adminEmail }) => {
      await queryClient.cancelQueries({ queryKey: ["admin-feedback"] })
      const previous = queryClient.getQueryData<ExerciseContentFeedback[]>(["admin-feedback"])

      queryClient.setQueryData<ExerciseContentFeedback[]>(["admin-feedback"], (old) =>
        old?.map((f) =>
          f.id === id
            ? {
                ...f,
                status,
                resolved_at:
                  status === "resolved"
                    ? new Date().toISOString()
                    : status === "pending"
                      ? null
                      : f.resolved_at,
                resolved_by:
                  status === "resolved"
                    ? adminEmail
                    : status === "pending"
                      ? null
                      : f.resolved_by,
              }
            : f,
        ),
      )

      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["admin-feedback"], context.previous)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-feedback"] })
    },
  })
}
