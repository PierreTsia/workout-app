import { useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form"
import { useCreateProgram } from "@/hooks/useCreateProgram"

const schema = z.object({
  name: z.string().max(60).optional(),
})

type BlankForm = z.infer<typeof schema>

export function BlankProgramStep() {
  const { t } = useTranslation("create-program")
  const navigate = useNavigate()
  const createProgram = useCreateProgram()

  const form = useForm<BlankForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: "" },
  })

  function handleSubmit(data: BlankForm) {
    const trimmed = data.name?.trim() || t("programNamePlaceholder")

    createProgram.mutate(
      { name: trimmed },
      {
        onSuccess: (programId) => {
          navigate(`/builder/${programId}`, { state: { from: "/create-program" } })
        },
        onError: () => toast.error(t("errorGeneric")),
      },
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-1 flex-col gap-4 px-6 pt-4">
        <h2 className="text-lg font-semibold">{t("pathBlank")}</h2>

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("programName")}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder={t("programNamePlaceholder")}
                  autoFocus
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={createProgram.isPending} className="mt-2">
          {createProgram.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            t("create")
          )}
        </Button>
      </form>
    </Form>
  )
}
