import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { parseCatalogPreviewRow } from "@/lib/previewCatalogCircuit"
import type { CatalogPreviewRow } from "@/lib/previewCatalogCircuit"

export function useBenchmarkSeeds(enabled: boolean) {
  return useQuery({
    queryKey: ["benchmark-seeds"],
    queryFn: async (): Promise<CatalogPreviewRow[]> => {
      const { data, error } = await supabase
        .from("benchmark_circuits")
        .select("id, slug, aliases, rx, tagline_fr, tagline_en")
        .is("owner_id", null)
      if (error) throw error
      return (data ?? []).flatMap((row) => {
        const parsed = parseCatalogPreviewRow(row)
        return parsed ? [parsed] : []
      })
    },
    enabled,
  })
}
