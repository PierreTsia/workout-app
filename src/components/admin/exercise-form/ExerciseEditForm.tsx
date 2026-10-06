import { useRef, useState, useCallback } from "react"
import { useForm, FormProvider, useWatch, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Activity, AlertTriangle, Settings2, Upload, Wind } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import {
  Button,
  Field,
  Form,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@nomosui/react"
import type { Exercise } from "@/types/database"
import { useExerciseFilterOptions } from "@/hooks/useExerciseFilterOptions"
import { getYouTubeEmbedUrl } from "@/lib/youtube"
import { getExerciseImageUrl } from "@/lib/storage"
import { uploadExerciseImage } from "@/lib/imageUpload"
import { exerciseFormSchema, type ExerciseFormValues } from "./schema"
import { toFormValues } from "./transforms"
import { InstructionFieldArray } from "./InstructionFieldArray"
import { LlmJsonImport } from "./LlmJsonImport"

interface ExerciseEditFormProps {
  exercise: Exercise
  onSubmit: (values: ExerciseFormValues) => void
  isPending: boolean
}

const requiredMark = (
  <span className="ml-0.5 text-destructive" aria-hidden>
    *
  </span>
)

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

  const { formState: { errors }, control } = methods

  const youtubeUrl = useWatch({ control, name: "youtube_url" })
  const imageUrl = useWatch({ control, name: "image_url" })

  const muscleGroups = filterOptions?.muscle_groups ?? []
  const equipmentOptions = filterOptions?.equipment ?? []
  const [imgVersion, setImgVersion] = useState(0)

  const measurementType = useWatch({ control, name: "measurement_type" })

  const handleImageUploaded = useCallback(
    (filename: string) => {
      methods.setValue("image_url", filename, { shouldDirty: true })
      setImgVersion((v) => v + 1)
    },
    [methods],
  )

  return (
    <FormProvider {...methods}>
      <Form
        columns={2}
        onSubmit={methods.handleSubmit(onSubmit)}
        actions={
          <Button type="submit" disabled={isPending}>
            {isPending ? t("form.saving") : t("form.save")}
          </Button>
        }
      >
        <Field
          htmlFor="name"
          label={
            <>
              {t("form.name")}
              {requiredMark}
            </>
          }
          error={errors.name?.message}
        >
          <Input id="name" {...methods.register("name")} />
        </Field>
        <Field htmlFor="name_en" label={t("form.nameEn")}>
          <Input id="name_en" {...methods.register("name_en")} />
        </Field>
        <Field
          htmlFor="muscle_group"
          label={
            <>
              {t("form.muscleGroup")}
              {requiredMark}
            </>
          }
          error={errors.muscle_group?.message}
        >
          <Controller
            control={control}
            name="muscle_group"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="muscle_group">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {muscleGroups.map((mg) => (
                    <SelectItem key={mg} value={mg}>
                      {mg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field htmlFor="equipment" label={t("form.equipment")}>
          <Controller
            control={control}
            name="equipment"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={field.onChange}
              >
                <SelectTrigger id="equipment">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {equipmentOptions.map((eq) => (
                    <SelectItem key={eq} value={eq}>
                      {eq}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field
          htmlFor="emoji"
          label={
            <>
              {t("form.emoji")}
              {requiredMark}
            </>
          }
          error={errors.emoji?.message}
        >
          <Input id="emoji" {...methods.register("emoji")} className="w-20" />
        </Field>
        <Field htmlFor="secondary_muscles" label={t("form.secondaryMuscles")}>
          <Input
            id="secondary_muscles"
            {...methods.register("secondary_muscles")}
            placeholder="e.g. biceps, forearms"
          />
        </Field>

        <div className="md:col-span-2">
          <Separator />
        </div>

        <Field htmlFor="source" label={t("form.source")}>
          <Input id="source" {...methods.register("source")} readOnly />
        </Field>
        <Field htmlFor="difficulty_level" label={t("form.difficultyLevel")}>
          <Controller
            control={control}
            name="difficulty_level"
            render={({ field }) => (
              <Select
                value={field.value || undefined}
                onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)}
              >
                <SelectTrigger id="difficulty_level">
                  <SelectValue placeholder={t("form.nonePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t("form.nonePlaceholder")}
                  </SelectItem>
                  {(["beginner", "intermediate", "advanced"] as const).map(
                    (level) => (
                      <SelectItem key={level} value={level}>
                        {t(`form.difficulty.${level}`)}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        <Field htmlFor="measurement_type" label={t("form.measurementType")}>
          <Controller
            control={control}
            name="measurement_type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="measurement_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["reps", "duration"] as const).map((mt) => (
                    <SelectItem key={mt} value={mt}>
                      {t(`form.measurement.${mt}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </Field>
        {measurementType === "duration" && (
          <Field
            htmlFor="default_duration_seconds"
            label={t("form.defaultDuration")}
          >
            <Input
              id="default_duration_seconds"
              {...methods.register("default_duration_seconds", {
                setValueAs: (v: string) => (v === "" ? null : Number(v)),
              })}
              type="number"
              min={1}
              placeholder="30"
            />
          </Field>
        )}

        <div className="md:col-span-2">
          <Separator />
        </div>

        <div className="flex flex-col gap-3">
          <Field htmlFor="youtube_url" label={t("form.youtubeUrl")}>
            <Input
              id="youtube_url"
              {...methods.register("youtube_url")}
              type="url"
              placeholder="https://youtube.com/watch?v=..."
            />
          </Field>
          <YouTubePreview url={youtubeUrl} />
        </div>
        <div className="flex flex-col gap-3">
          <Field htmlFor="image_url" label={t("form.imageUrl")}>
            <div className="flex gap-2">
              <Input
                id="image_url"
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
          <ImagePreview path={imageUrl} version={imgVersion} />
        </div>

        <div className="md:col-span-2">
          <Separator />
        </div>

        <div className="flex flex-col gap-6 md:col-span-2">
          <h3 className="text-lg font-semibold">{t("form.instructions")}</h3>
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

        <div className="md:col-span-2">
          <Separator />
        </div>

        <div className="md:col-span-2">
          <LlmJsonImport />
        </div>
      </Form>
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
