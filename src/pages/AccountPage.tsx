import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useAtomValue } from "jotai"
import { ArrowLeft, UserRound } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { accountProfileSchema, type AccountProfileFormValues } from "@/components/account/accountProfileSchema"
import { QuestionnaireTrainingFields } from "@/components/onboarding/QuestionnaireTrainingFields"
import { toQuestionnaireOutput } from "@/components/onboarding/schema"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { assertAvatarFile, removeUserAvatarFiles, uploadUserAvatar } from "@/lib/avatarUpload"
import { supabase } from "@/lib/supabase"
import { resolveAvatarUrl } from "@/lib/userDisplay"
import { authAtom, weightUnitAtom } from "@/store/atoms"
import { isDisplayNameTakenError } from "@/hooks/profileErrors"
import { useUpdateUserProfile } from "@/hooks/useUpdateUserProfile"
import { useUserProfile } from "@/hooks/useUserProfile"

const LBS_TO_KG = 0.453592

export function AccountPage() {
  const { t } = useTranslation(["account", "onboarding"])
  const navigate = useNavigate()
  const user = useAtomValue(authAtom)
  const weightUnit = useAtomValue(weightUnitAtom)
  const queryClient = useQueryClient()
  const { data: profile, isLoading, isError } = useUserProfile()
  const updateProfile = useUpdateUserProfile()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null)
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null)

  const form = useForm<AccountProfileFormValues>({
    resolver: zodResolver(accountProfileSchema),
    mode: "onTouched",
    defaultValues: {
      display_name: "",
      gender: undefined,
      goal: undefined,
      experience: undefined,
      equipment: undefined,
      training_days_per_week: 3,
      session_duration_minutes: "60",
      age: "",
      weight: "",
    },
  })

  useEffect(() => {
    if (!profile) return
    const weightDisplay =
      weightUnit === "lbs"
        ? String(Math.round((profile.weight_kg / LBS_TO_KG) * 10) / 10)
        : String(profile.weight_kg)
    form.reset({
      display_name: profile.display_name ?? "",
      gender: profile.gender,
      goal: profile.goal,
      experience: profile.experience,
      equipment: profile.equipment,
      training_days_per_week: profile.training_days_per_week,
      session_duration_minutes: String(profile.session_duration_minutes) as AccountProfileFormValues["session_duration_minutes"],
      age: String(profile.age),
      weight: weightDisplay,
    })
  }, [profile, weightUnit, form])

  useEffect(() => {
    if (!pendingAvatarFile) {
      setPreviewObjectUrl(null)
      return
    }
    const url = URL.createObjectURL(pendingAvatarFile)
    setPreviewObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingAvatarFile])

  const removeCustomAvatar = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated")
      await removeUserAvatarFiles(user.id)
      const { error } = await supabase
        .from("user_profiles")
        .update({ avatar_url: null })
        .eq("user_id", user.id)
      if (error) throw error
    },
    onSuccess: () => {
      setPendingAvatarFile(null)
      if (user?.id) {
        queryClient.invalidateQueries({ queryKey: ["user-profile", user.id] })
      }
      toast.success(t("account:saved"))
    },
    onError: () => toast.error(t("account:saveError")),
  })

  const avatarSrc =
    previewObjectUrl ??
    (user && profile ? resolveAvatarUrl(user, profile) : undefined)

  function onPickAvatarFile(f: File | null) {
    if (!f) return
    try {
      assertAvatarFile(f)
      setPendingAvatarFile(f)
    } catch (e) {
      const code = e instanceof Error ? e.message : ""
      if (code === "INVALID_AVATAR_TYPE") toast.error(t("account:avatarTypeError"))
      else if (code === "INVALID_AVATAR_SIZE") toast.error(t("account:avatarSizeError"))
      else toast.error(t("account:avatarUploadError"))
    }
  }

  async function onSubmit(values: AccountProfileFormValues) {
    if (!user || !profile) return
    const { display_name, ...questionnairePart } = values
    const training = toQuestionnaireOutput(questionnairePart)
    let avatarUrl: string | null = profile.avatar_url
    if (pendingAvatarFile) {
      try {
        avatarUrl = await uploadUserAvatar(user.id, pendingAvatarFile)
      } catch {
        toast.error(t("account:avatarUploadError"))
        return
      }
    }
    try {
      await updateProfile.mutateAsync({
        display_name: display_name.trim() || null,
        avatar_url: avatarUrl,
        gender: training.gender,
        age: training.age,
        weight_kg_display: training.weight,
        goal: training.goal,
        experience: training.experience,
        equipment: training.equipment,
        training_days_per_week: training.training_days_per_week,
        session_duration_minutes: training.session_duration_minutes,
      })
      setPendingAvatarFile(null)
      toast.success(t("account:saved"))
    } catch (e) {
      if (isDisplayNameTakenError(e)) {
        form.setError("display_name", { message: t("account:displayNameTaken") })
        toast.error(t("account:displayNameTaken"))
        return
      }
      toast.error(t("account:saveError"))
    }
  }

  if (isError) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-4">
        <p className="text-destructive">{t("account:loadError")}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          {t("account:back")}
        </Button>
      </div>
    )
  }

  if (isLoading || !profile) {
    return (
      <div className="flex flex-1 flex-col gap-4 px-4 pb-8 pt-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 pb-10 pt-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t("account:back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{t("account:title")}</h1>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">{t("account:identitySection")}</h2>
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <Avatar className="h-24 w-24 border border-border">
                <AvatarImage src={avatarSrc} alt="" referrerPolicy="no-referrer" />
                <AvatarFallback>
                  <UserRound className="h-10 w-10 text-muted-foreground" />
                </AvatarFallback>
              </Avatar>
              <div className="flex w-full flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null
                    e.target.value = ""
                    onPickAvatarFile(f)
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    {t("account:changePhoto")}
                  </Button>
                  {profile.avatar_url ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground"
                      disabled={removeCustomAvatar.isPending}
                      onClick={() => removeCustomAvatar.mutate()}
                    >
                      {t("account:removeCustomPhoto")}
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{t("account:photoHint")}</p>
              </div>
            </div>

            <Separator className="my-6" />

            <FormField
              control={form.control}
              name="display_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("account:displayName")}</FormLabel>
                  <FormControl>
                    <Input autoComplete="nickname" placeholder="" {...field} />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">{t("account:displayNameHint")}</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </section>

          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-4 text-sm font-semibold text-foreground">{t("account:trainingSection")}</h2>
            <QuestionnaireTrainingFields control={form.control} />
          </section>

          <Button type="submit" size="lg" className="w-full" disabled={updateProfile.isPending}>
            {updateProfile.isPending ? t("account:saving") : t("account:save")}
          </Button>
        </form>
      </Form>
    </div>
  )
}
