import { useState } from 'react'
import { Menu, Plug2, BookOpen, UserRound } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

interface MobileNavProps {
  currentPath: string
}

const links: Array<{ href: string; label: string; Icon: LucideIcon }> = [
  { href: '/connect/claude', label: 'Claude connector', Icon: Plug2 },
  { href: '/blog', label: 'Blog', Icon: BookOpen },
  { href: '/about', label: 'About', Icon: UserRound },
]

export function MobileNav({ currentPath }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  const isActive = (href: string) =>
    currentPath === href || (href !== '/' && currentPath.startsWith(href))

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className="md:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex flex-col gap-6 bg-background"
      >
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <SheetDescription className="sr-only">
          Site navigation links and external CTAs
        </SheetDescription>

        <nav
          aria-label="Mobile primary"
          className="mt-8 flex flex-col gap-4"
        >
          {links.map(({ href, label, Icon }) => (
            <a
              key={href}
              href={href}
              aria-current={isActive(href) ? 'page' : undefined}
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-3 text-lg text-muted hover:text-foreground transition-colors aria-[current=page]:text-accent aria-[current=page]:hover:text-accent aria-[current=page]:underline aria-[current=page]:underline-offset-8 aria-[current=page]:decoration-1"
            >
              <Icon className="size-5 shrink-0" aria-hidden="true" />
              {label}
            </a>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
