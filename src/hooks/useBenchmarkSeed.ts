import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/lib/supabase"
import { parseCatalogSeedRow } from "@/lib/previewCatalogCircuit"
import type { CatalogSeedRow } from "@/lib/previewCatalogCircuit"

export function useBenchmarkSeed(slug: string | undefined) {
  const trimmed = typeof slug === "string" ? slug.trim() : ""
  const enabled = trimmed !== ""

  return useQuery({
    queryKey: ["benchmark-seed", trimmed],
    queryFn: async (): Promise<CatalogSeedRow | null> => {
      const { data, error } = await supabase
        .from("benchmark_circuits")
        .select(
          "id, slug, label, rx, tagline_fr, tagline_en, story_fr, story_en, reference",
        )
        .eq("slug", trimmed)
        .is("owner_id", null)
        .maybeSingle()
      if (error) throw error
      return parseCatalogSeedRow(data)
    },
    enabled,
  })
}
