import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import type { ProgramTemplate } from "@/types/onboarding"

export function useTemplates() {
  return useQuery<ProgramTemplate[]>({
    queryKey: ["program-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_templates")
        .select(
          "id, name, description, min_days, max_days, primary_goal, experience_tags, template_days(id, template_id, day_label, day_number, muscle_focus, sort_order, template_exercises(id, template_day_id, exercise_id, sets, rep_range, rest_seconds, sort_order, exercise:exercises(*)))",
        )
        .order("name")

      if (error) throw error
      return data as unknown as ProgramTemplate[]
    },
  })
}
