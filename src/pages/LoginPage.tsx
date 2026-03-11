import { Button } from "@/components/ui/button"

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-4">
      <h1 className="text-3xl font-bold text-foreground">Login</h1>
      <Button size="lg" disabled>
        Sign in with Google
      </Button>
      <p className="text-sm text-muted-foreground">
        Authentication coming in T2
      </p>
    </div>
  )
}
