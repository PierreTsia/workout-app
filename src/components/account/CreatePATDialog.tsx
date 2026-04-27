import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AlertTriangle, Check, Copy, KeyRound } from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DuplicateNameError,
  PATForbiddenError,
  QuotaExceededError,
  useCreatePAT,
} from "@/hooks/useCreatePAT"
import type { CreatePATResponse } from "@/types/personalAccessToken"

interface CreatePATDialogProps {
  open: boolean
  onClose: () => void
}

const LIFETIME_VALUES = ["30", "90", "365", "never"] as const
type LifetimeValue = (typeof LIFETIME_VALUES)[number]

// Lock the schema to camelCase i18n keys that exist in api-tokens.json. This
// gives us field-level error messages without coupling react-hook-form to the
// i18n instance.
//
// PAT_NAME_MAX_LENGTH must stay in sync with the backend cap defined in
// supabase/functions/create-pat/createPatLogic.ts. If you change one, change
// the other (or the backend will 400 inputs the UI happily accepted).
const PAT_NAME_MAX_LENGTH = 64

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "validationNameRequired")
    .max(PAT_NAME_MAX_LENGTH, "validationNameMax"),
  lifetime: z.enum(LIFETIME_VALUES),
})

type FormValues = z.infer<typeof formSchema>

function lifetimeToDays(value: LifetimeValue): 30 | 90 | 365 | null {
  if (value === "never") return null
  return Number(value) as 30 | 90 | 365
}

export function CreatePATDialog({ open, onClose }: CreatePATDialogProps) {
  const { t } = useTranslation(["api-tokens", "common"])
  const [success, setSuccess] = useState<CreatePATResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const createMutation = useCreatePAT()

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", lifetime: "30" },
  })

  // Reset everything once the dialog has fully closed. Keying off `open`
  // rather than the success state means we don't flicker the form while the
  // user is mid-copy, and we keep state cleanup local instead of pushing it
  // into every onClose call site.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps --
     Transient post-close cleanup. `form` and `createMutation` are stable refs
     across renders; depending on them would re-fire the reset on every
     keystroke. */
  useEffect(() => {
    if (!open) {
      setSuccess(null)
      setCopied(false)
      form.reset({ name: "", lifetime: "30" })
      createMutation.reset()
    }
  }, [open])
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  const lifetime = useWatch({ control: form.control, name: "lifetime" })
  const showNeverWarning = lifetime === "never"

  async function onSubmit(values: FormValues) {
    try {
      const response = await createMutation.mutateAsync({
        name: values.name,
        lifetime_days: lifetimeToDays(values.lifetime),
      })
      setSuccess(response)
    } catch (err) {
      if (err instanceof DuplicateNameError) {
        form.setError("name", {
          type: "server",
          message: "duplicateName",
        })
        return
      }
      if (err instanceof QuotaExceededError) {
        toast.error(t("api-tokens:quotaReached", { max: 10 }))
        onClose()
        return
      }
      if (err instanceof PATForbiddenError) {
        toast.error(t("api-tokens:patForbidden"))
        onClose()
        return
      }
      toast.error(t("api-tokens:createError"))
    }
  }

  async function handleCopy() {
    if (!success) return
    try {
      await navigator.clipboard.writeText(success.token)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can fail in non-secure contexts. Surface it but don't block
      // the user — they can still select/copy manually.
      toast.error(t("api-tokens:createError"))
    }
  }

  function handleOpenChange(next: boolean) {
    if (next) return
    // In success mode we force the explicit "Done" button: closing via Escape
    // or outside-click would lose the plaintext token forever.
    if (success) return
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {success ? (
          <SuccessView
            token={success.token}
            copied={copied}
            onCopy={handleCopy}
            onDone={onClose}
            t={t}
          />
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4" />
                  {t("api-tokens:createDialogTitle")}
                </DialogTitle>
                <DialogDescription>
                  {t("api-tokens:createDialogDescription")}
                </DialogDescription>
              </DialogHeader>

              <FormField
                control={form.control}
                name="name"
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t("api-tokens:name")}</FormLabel>
                    <FormControl>
                      <Input
                        autoFocus
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={t("api-tokens:namePlaceholder")}
                        maxLength={PAT_NAME_MAX_LENGTH}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      {t("api-tokens:nameHint")}
                    </p>
                    {fieldState.error?.message ? (
                      <FormMessage>
                        {t(`api-tokens:${fieldState.error.message}`)}
                      </FormMessage>
                    ) : null}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lifetime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("api-tokens:lifetime")}</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="30">
                          {t("api-tokens:lifetime30")}
                        </SelectItem>
                        <SelectItem value="90">
                          {t("api-tokens:lifetime90")}
                        </SelectItem>
                        <SelectItem value="365">
                          {t("api-tokens:lifetime365")}
                        </SelectItem>
                        <SelectItem value="never">
                          {t("api-tokens:lifetimeNever")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {showNeverWarning ? (
                      <div className="flex items-start gap-2 rounded-md bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{t("api-tokens:lifetimeNeverWarning")}</span>
                      </div>
                    ) : null}
                  </FormItem>
                )}
              />

              <DialogFooter className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={createMutation.isPending}
                >
                  {t("api-tokens:cancel")}
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending
                    ? t("api-tokens:creating")
                    : t("api-tokens:create")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

interface SuccessViewProps {
  token: string
  copied: boolean
  onCopy: () => void
  onDone: () => void
  t: ReturnType<typeof useTranslation>["t"]
}

function SuccessView({ token, copied, onCopy, onDone, t }: SuccessViewProps) {
  return (
    <div className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Check className="h-4 w-4 text-emerald-500" />
          {t("api-tokens:successTitle")}
        </DialogTitle>
        <DialogDescription>{t("api-tokens:successWarning")}</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-2">
        <div
          className="break-all rounded-md border border-border bg-muted px-3 py-3 font-mono text-xs"
          data-testid="pat-plaintext"
        >
          {token}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCopy}
          className="self-start"
        >
          {copied ? (
            <>
              <Check className="mr-1.5 h-3.5 w-3.5" />
              {t("api-tokens:copied")}
            </>
          ) : (
            <>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {t("api-tokens:copy")}
            </>
          )}
        </Button>
      </div>

      <DialogFooter>
        <Button type="button" onClick={onDone}>
          {t("api-tokens:done")}
        </Button>
      </DialogFooter>
    </div>
  )
}
