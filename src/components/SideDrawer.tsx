import { useAtom } from "jotai"
import { Link } from "react-router-dom"
import { useTheme } from "next-themes"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { drawerOpenAtom, themeAtom } from "@/store/atoms"

export function SideDrawer() {
  const [open, setOpen] = useAtom(drawerOpenAtom)
  const [, setThemeAtom] = useAtom(themeAtom)
  const { theme, setTheme } = useTheme()

  function closeDrawer() {
    setOpen(false)
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark"
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
          {/* User placeholder */}
          <div className="flex items-center gap-3 px-2 pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-lg">
              👤
            </div>
            <div>
              <p className="font-medium text-foreground">Guest</p>
              <p className="text-xs text-muted-foreground">Not signed in</p>
            </div>
          </div>

          <Separator />

          {/* Nav links */}
          <nav className="flex flex-col gap-1 py-2">
            <Link
              to="/history"
              onClick={closeDrawer}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              History
            </Link>
            <Link
              to="/builder"
              onClick={closeDrawer}
              className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              Workout Builder
            </Link>
          </nav>

          <Separator />

          {/* Settings */}
          <div className="flex flex-col gap-3 py-2 px-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-foreground">Dark mode</span>
              <Switch
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
              />
            </div>
            <button
              disabled
              className="text-left text-sm text-muted-foreground opacity-50"
            >
              Install app
            </button>
            <button
              disabled
              className="text-left text-sm text-muted-foreground opacity-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
