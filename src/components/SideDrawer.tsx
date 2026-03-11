import { useAtom, useAtomValue } from "jotai"
import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { LogOut } from "lucide-react"
import { authAtom, drawerOpenAtom, themeAtom } from "@/store/atoms"
import { supabase } from "@/lib/supabase"

export function SideDrawer() {
  const [open, setOpen] = useAtom(drawerOpenAtom)
  const [currentTheme, setThemeAtom] = useAtom(themeAtom)
  const user = useAtomValue(authAtom)
  const { setTheme } = useTheme()

  function closeDrawer() {
    setOpen(false)
  }

  function handleSignOut() {
    supabase.auth.signOut()
    closeDrawer()
  }

  function toggleTheme() {
    const next = currentTheme === "dark" ? "light" : "dark"
    setTheme(next)
    setThemeAtom(next)
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="w-72 bg-card">
        <SheetHeader>
          <SheetTitle className="text-foreground">Menu</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-2 py-4">
          <div className="flex items-center gap-3 px-2 pb-4">
            <Avatar>
              <AvatarImage
                src={user?.user_metadata?.avatar_url}
                alt={user?.user_metadata?.full_name ?? ""}
                referrerPolicy="no-referrer"
              />
              <AvatarFallback>👤</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {user?.user_metadata?.full_name ?? "Guest"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user?.email ?? "Not signed in"}
              </p>
            </div>
          </div>

          <Separator />

          <nav className="flex flex-col gap-1 py-2">
            <Button variant="ghost" className="justify-start" asChild>
              <Link to="/history" onClick={closeDrawer}>
                History
              </Link>
            </Button>
            <Button variant="ghost" className="justify-start" asChild>
              <Link to="/builder" onClick={closeDrawer}>
                Workout Builder
              </Link>
            </Button>
          </nav>

          <Separator />

          <div className="flex flex-col gap-3 px-2 py-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Dark mode</span>
              <Switch
                checked={currentTheme === "dark"}
                onCheckedChange={toggleTheme}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              disabled
            >
              Install app
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-muted-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
