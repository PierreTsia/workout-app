import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { parseCatalogSeedRow } from "@/lib/previewCatalogCircuit"
import type { CatalogSeedRow } from "@/lib/previewCatalogCircuit"

export function useBenchmarkSeeds(enabled: boolean) {
  return useQuery({
    queryKey: ["benchmark-seeds"],
    queryFn: async (): Promise<CatalogSeedRow[]> => {
      const { data, error } = await supabase
        .from("benchmark_circuits")
        .select(
          "id, slug, label, aliases, rx, tagline_fr, tagline_en, story_fr, story_en, reference",
        )
        .is("owner_id", null)
        .order("slug", { ascending: true })
      if (error) throw error
      return (data ?? []).flatMap((row) => {
        const parsed = parseCatalogSeedRow(row)
        return parsed ? [parsed] : []
      })
    },
    enabled,
  })
}
