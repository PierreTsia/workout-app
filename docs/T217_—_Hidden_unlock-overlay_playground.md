# T217 — Hidden `/_unlock-overlay` playground

## Goal

HITL must not require farming sessions. Add a hidden route (underscore-prefixed, not in the drawer) with buttons that push fixture **Grant Batch**es onto `achievementUnlockQueueAtom` so the real overlay (already in `AppShell`) fires. Stories: 17.

## Mode

AFK — building the route is mechanical. Pixel-perfect eyeballing is T218.

## Slice

router path → playground page → buttons seed the atom → page test

## Dependencies

T214 (overlay consumes a batch). T215/T216 optional but preferred so the playground shows Equip + FX; do not block this ticket on them if the DAG has them in flight — seed the atom regardless.

## Scope

### Route

`file:src/router/index.tsx` — under `AppShell` (auth + overlay mounted):

```ts
{ path: "/_unlock-overlay", element: <UnlockOverlayPlaygroundPage /> }
```

No `SideDrawer` link. No sitemap. Not a design-system route (none exists).

### Page — `file:src/pages/UnlockOverlayPlaygroundPage.tsx`

Heading: “Unlock overlay playground”. Short note: not in nav, fixtures only.

Each button calls `pushAchievementsToQueue` with **fresh `tier_id`s** (`crypto.randomUUID()`) so a second click after dismiss retriggers (dedup would swallow static ids).

Buttons (labels exact enough to test by role/name):

| Button | Batch |
|---|---|
| Bronze | 1× bronze, slug `volume_king`, threshold 15000 |
| Silver | 1× silver |
| Gold | 1× gold — “Plateau Titan” stand-in title + Volume |
| Platinum | 1× platinum |
| Diamond | 1× diamond |
| 2 overlap | silver hero + bronze supporting (different slugs) |
| Burst 4 | diamond hero + gold + silver + bronze (matches v2 burst count) |
| Overflow 5+ | diamond + 4 supporting (row shows `+1`) |

Use real `group_slug` values from `achievements.json` `groups` so chips/hints resolve. Titles can be the Stitch names or existing seed titles — don’t invent new i18n groups.

### Tests — `file:src/pages/UnlockOverlayPlaygroundPage.test.tsx`

- Renders the eight buttons
- Clicking Gold puts one gold grant on the queue atom (via store, or by asserting the overlay heading appears if overlay is in the tree)

`vi.mock("@/lib/supabase")`.

## Out of Scope

- Linking from production IA
- DEV-only compile-out (preview deploys must work)
- Visual sign-off (T218)

## Acceptance Criteria

- [ ] `/_unlock-overlay` is reachable behind auth, absent from the drawer
- [ ] Eight buttons fire the batches in the table
- [ ] Re-click after dismiss opens a new ceremony (fresh ids)
- [ ] Page test green with Supabase env stripped

## References

- Epic Brief story 17
- Tech Plan playground decision
- Overlay: `file:src/components/achievements/AchievementUnlockOverlay.tsx`
