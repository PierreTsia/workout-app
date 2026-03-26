import { useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { Link } from "react-router-dom"
import { Copy, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ImageDropZone } from "@/components/admin/enrichment/ImageDropZone"
import { uploadExerciseImage } from "@/lib/imageUpload"
import { buildImagePrompt } from "@/lib/imagePrompt"
import { supabase } from "@/lib/supabase"
import { authAtom } from "@/store/atoms"
import type { Exercise } from "@/types/database"

interface EnrichmentCardProps {
  exercise: Exercise
}

export function EnrichmentCard({ exercise }: EnrichmentCardProps) {
  const queryClient = useQueryClient()
  const user = useAtomValue(authAtom)
  const [copied, setCopied] = useState(false)

  const mutation = useMutation({
    mutationFn: async (file: File) => {
      const filename = await uploadExerciseImage(file, exercise.name)
      const { error } = await supabase
        .from("exercises")
        .update({
          image_url: filename,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.email ?? "unknown",
        })
        .eq("id", exercise.id)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success(`Image saved for ${exercise.name}`)
      queryClient.invalidateQueries({ queryKey: ["exercises-needing-images"] })
      queryClient.invalidateQueries({ queryKey: ["admin-exercises"] })
      queryClient.invalidateQueries({ queryKey: ["exercise-library-paginated"] })
    },
    onError: (err) => {
      toast.error(`Upload failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    },
  })

  const promptName = exercise.name_en || exercise.name

  async function handleCopyPrompt() {
    const prompt = buildImagePrompt(promptName)
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.info(prompt, { duration: 8000 })
    }
  }

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-border/80 bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{exercise.emoji}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-tight">{exercise.name}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {exercise.muscle_group} · {exercise.equipment}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyPrompt}
          className="gap-2"
        >
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy prompt"}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" asChild>
          <Link to={`/admin/exercises/${exercise.id}`}>
            <ExternalLink className="h-3.5 w-3.5" />
            Details
          </Link>
        </Button>
      </div>

      <ImageDropZone
        onFileSelected={(file) => mutation.mutate(file)}
        isUploading={mutation.isPending}
      />
    </div>
  )
}
