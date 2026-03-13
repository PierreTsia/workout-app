import { useRef, useState, useCallback } from "react"
import { useForm, FormProvider } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, AlertTriangle, Settings2, Upload, Wind } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { Exercise } from "@/types/database"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import { getYouTubeEmbedUrl } from "@/lib/youtube"
import { getExerciseImageUrl } from "@/lib/storage"
import { uploadExerciseImage } from "@/lib/imageUpload"
import { exerciseFormSchema, type ExerciseFormValues } from "./schema"
import { toFormValues } from "./transforms"
import { InstructionFieldArray } from "./InstructionFieldArray"

interface ExerciseEditFormProps {
  exercise: Exercise
  onSubmit: (values: ExerciseFormValues) => void
  isPending: boolean
}

export function ExerciseEditForm({
  exercise,
  onSubmit,
  isPending,
}: ExerciseEditFormProps) {
  const { t } = useTranslation("admin")
  const { data: filterOptions } = useExerciseFilterOptions()

  const methods = useForm<ExerciseFormValues>({
    resolver: zodResolver(exerciseFormSchema),
    defaultValues: toFormValues(exercise),
  })

  const { formState: { errors } } = methods

  const muscleGroups = filterOptions?.muscle_groups ?? []
  const equipmentOptions = filterOptions?.equipment ?? []
  const [imgVersion, setImgVersion] = useState(0)

  const handleImageUploaded = useCallback(
    (filename: string) => {
      methods.setValue("image_url", filename, { shouldDirty: true })
      setImgVersion((v) => v + 1)
    },
    [methods],
  )

  return (
    <FormProvider {...methods}>
      <form
        onSubmit={methods.handleSubmit(onSubmit)}
        className="flex flex-col gap-6"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.name")} required error={errors.name?.message}>
            <Input {...methods.register("name")} />
          </Field>
          <Field label={t("form.nameEn")}>
            <Input {...methods.register("name_en")} />
          </Field>
          <Field label={t("form.muscleGroup")} required error={errors.muscle_group?.message}>
            <select
              {...methods.register("muscle_group")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              {muscleGroups.map((mg) => (
                <option key={mg} value={mg}>{mg}</option>
              ))}
            </select>
          </Field>
          <Field label={t("form.equipment")}>
            <select
              {...methods.register("equipment")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">—</option>
              {equipmentOptions.map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </Field>
          <Field label={t("form.emoji")} required error={errors.emoji?.message}>
            <Input {...methods.register("emoji")} className="w-20" />
          </Field>
          <Field label={t("form.secondaryMuscles")}>
            <Input
              {...methods.register("secondary_muscles")}
              placeholder="e.g. biceps, forearms"
            />
          </Field>
        </div>

        <Separator />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-3">
            <Field label={t("form.youtubeUrl")}>
              <Input
                {...methods.register("youtube_url")}
                type="url"
                placeholder="https://youtube.com/watch?v=..."
              />
            </Field>
            <YouTubePreview url={methods.watch("youtube_url")} />
          </div>
          <div className="flex flex-col gap-3">
            <Field label={t("form.imageUrl")}>
              <div className="flex gap-2">
                <Input
                  {...methods.register("image_url")}
                  placeholder="e.g. bird-dog.webp"
                  className="flex-1"
                  readOnly
                />
                <ImageUploadButton
                  exerciseName={methods.getValues("name")}
                  previousFilename={methods.getValues("image_url")}
                  onUploaded={handleImageUploaded}
                />
              </div>
            </Field>
            <ImagePreview path={methods.watch("image_url")} version={imgVersion} />
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-6">
          <h3 className="text-lg font-semibold">Instructions</h3>
          <InstructionFieldArray
            name="setup"
            label={t("form.setup")}
            icon={Settings2}
          />
          <InstructionFieldArray
            name="movement"
            label={t("form.movement")}
            icon={Activity}
          />
          <InstructionFieldArray
            name="breathing"
            label={t("form.breathing")}
            icon={Wind}
          />
          <InstructionFieldArray
            name="common_mistakes"
            label={t("form.commonMistakes")}
            icon={AlertTriangle}
          />
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t("form.saving") : t("form.save")}
          </Button>
        </div>
      </form>
    </FormProvider>
  )
}

function ImageUploadButton({
  exerciseName,
  previousFilename,
  onUploaded,
}: {
  exerciseName: string
  previousFilename?: string | null
  onUploaded: (filename: string) => void
}) {
  const { t } = useTranslation("admin")
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const filename = await uploadExerciseImage(file, exerciseName, previousFilename)
      onUploaded(filename)
    } catch {
      toast.error(t("form.uploadError"))
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mr-1 h-3.5 w-3.5" />
        {uploading ? t("form.uploading") : t("form.uploadImage")}
      </Button>
    </>
  )
}

function ImagePreview({ path, version = 0 }: { path: string | null | undefined; version?: number }) {
  if (!path) return null

  const base = path.startsWith("http") ? path : getExerciseImageUrl(path)
  const src = version ? `${base}?v=${version}` : base

  return (
    <div className="overflow-hidden rounded-md border">
      <img
        src={src}
        alt="Exercise illustration"
        className="max-h-48 w-full object-contain bg-muted/20"
        onError={(e) => {
          e.currentTarget.style.display = "none"
        }}
      />
    </div>
  )
}

function YouTubePreview({ url }: { url: string | null | undefined }) {
  const embedUrl = url ? getYouTubeEmbedUrl(url) : null
  if (!embedUrl) return null

  return (
    <div className="overflow-hidden rounded-md border">
      <iframe
        src={embedUrl}
        title="YouTube preview"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full"
      />
    </div>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
