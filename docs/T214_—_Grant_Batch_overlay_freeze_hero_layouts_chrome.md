# T214 — Grant Batch overlay: freeze, hero, layouts, chrome

## Goal

Replace the serial 4s `queue[0]` player with one **Grant Batch** ceremony whose **Hero** is the highest rank and whose chrome matches Stitch v2 (eyebrow, metal chip + track, threshold line, 1 / 2-overlap / 3+ row / 5+ `+N`). Kill auto-dismiss. Stories: 1–6, 10–12, 13.

## Mode

AFK — pixel-perfect is specified by the v2 PNGs + this ticket; visual sign-off is T218.

## Slice

`pickHero` utils → overlay snapshot/dismiss → layouts + i18n chrome → overlay component tests

## Dependencies

T213 (`threshold_value` on `UnlockedAchievement`)

## Scope

### Pure helpers — `file:src/lib/achievementUtils.ts`

| Export | Contract |
|---|---|
| `pickHero(batch)` | `diamond > platinum > gold > silver > bronze`; tie → first in array |
| `supportingMedals(batch, hero)` | All items whose `tier_id !== hero.tier_id`, original order |
| `supportingOverflow(supporting)` | `{ visible, overflowCount }` with `visible = supporting.slice(0, 3)`, `overflowCount = max(0, length - 3)` |

Unit tests in `file:src/lib/achievementUtils.test.ts` (or extend an existing test file if one exists).

### Overlay freeze — `file:src/components/achievements/AchievementUnlockOverlay.tsx`

- Overlay stays mounted in `AppShell`.
- When `batch === null && queue.length > 0`, `setBatch(queue)` **during render** (no `useEffect` snapshot).
- Render `batch`, never live `queue[0]`.
- Dismiss (Escape, overlay/backdrop click): add every batch `tier_id` to `achievementShownIdsAtom`; `setQueue(prev => prev.filter(a => !batchIds.has(a.tier_id)))`; `setBatch(null)`.
- Delete `AUTO_DISMISS_MS` and the `setTimeout(dismiss, …)` effect. Chime + vibrate once per ceremony (on batch capture), not per medal.
- Late inbox items remain for the next ceremony.

### Layouts (pixel-perfect vs gist `*-v2.png`)

Source: https://gist.github.com/PierreTsia/1cf2af5c3010f43a5625cac5f3ab78e9 (`unlock-moment-single-gold-v2.png`, `unlock-moment-burst-4-v2.png`). Two-at-once has no PNG — follow the table, **not** a 2×2 grid.

| Count | Layout |
|---|---|
| 1 | Hero `BadgeIcon` size `lg` (~112px). Eyebrow `ceremonyEyebrow`. |
| 2 | Hero ~120px. Supporting ~72px overlapping bottom-right. Eyebrow `ceremonyEyebrowCount` with `count: 2`. |
| 3–4 | Hero ~112px. One under-row of supporting ~56px, each with rank word + title, muted. |
| 5+ | Same row; last slot is `ceremonyOverflow` (`+N`), `N = supporting.length - 3`. No carousel. |

Backdrop: `bg-[#0f0f13]/70 backdrop-blur-sm` over the dimmed session summary. Rank glow **behind the hero only**. Do not purple/gold the page.

Copy describes the **hero only**:
- Title = localized hero title (`text-2xl` / tracking-tight stand-in for Stitch `headline-lg`)
- Rank = shadcn `Badge` metal chip (`ranks.{rank}`) using overlay-local hexes: Bronze `#C26A16` · Silver `#c8c8dc` · Gold `#F0C014` · Platinum `#93c5fd` · Diamond `#a855f7` (chip text/border; not the backdrop)
- Track = sibling `Badge` / muted tag: `groups.{hero.group_slug}` (e.g. Volume, Spidey)
- Threshold **next line**: `t(\`thresholdHint.${hero.group_slug}\`, { target: formatCompactNumber(hero.threshold_value, locale) })`. Hide the line if `threshold_value` is missing. Do **not** use `groupDescriptions`.

Muted “tap to continue” (`ceremonyTapToContinue`).

### i18n

Add to `file:src/locales/en/achievements.json` and `file:src/locales/fr/achievements.json`:

| Key | EN | FR |
|---|---|---|
| `ceremonyEyebrow` | `Unlocked` | `Débloqué` |
| `ceremonyEyebrowCount` | `{{count}} unlocked` | `{{count}} débloqués` |
| `ceremonyOverflow` | `+{{count}}` | `+{{count}}` |
| `ceremonyTapToContinue` | `Tap to continue` | `Toucher pour continuer` |

Do not reuse `unlocked` (`Unlocked!` / `Débloqué !`).

### Tests — `file:src/components/achievements/AchievementUnlockOverlay.test.tsx`

`renderWithProviders` + Jotai store preloaded with `achievementUnlockQueueAtom`. `vi.mock("@/lib/supabase")`.

Cases:
- 1 grant: eyebrow Unlocked, hero title, rank chip, track, threshold line; no supporting row
- 2 grants: Silver+Bronze → Silver is hero, Bronze overlaps (not a second equal hero); eyebrow `2 unlocked`
- 4 grants including Diamond: Diamond is hero; 3 supporting in one row; not a 2×2
- 6 grants: `+N` overflow (`N = 2` if 5 supporting / 3 visible)
- Tap / Escape dismisses the **whole** batch (queue empty unless a leftover was pushed after snapshot)
- No auto-dismiss: fake timers + 4s does **not** close
- Reduced-motion: assert medals present without relying on animation classes if possible; if FX aren’t in this ticket, skip motion assertions (T216)

Equip button may be absent this ticket (T215). Don’t fail tests for a missing CTA unless you stub the hook.

## Out of Scope

- Equip title CTA (T215)
- Particle FX / scale polish beyond whatever glow already exists (T216) — existing glow tokens may stay
- Playground route (T217)
- Badge drawer restyle

## Acceptance Criteria

- [ ] `AUTO_DISMISS_MS` and `queue.slice(1)` player are gone
- [ ] Opening snapshots the current queue; late pushes do not appear in the open overlay
- [ ] Dismiss clears the whole snapshot and leaves post-snapshot inbox items for the next ceremony
- [ ] Hero is always highest rank; copy (title, chip, track, threshold) is hero-only
- [ ] Layouts 1 / 2-overlap / 3+ row / 5+ `+N` match the table; no 2×2 grid
- [ ] Threshold line uses `thresholdHint` + `threshold_value` on its own line
- [ ] Overlay tests cover 1 / 2 / 4 / overflow, hero pick, batch dismiss, no auto-dismiss
- [ ] `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run src/lib/achievementUtils.test.ts src/components/achievements/AchievementUnlockOverlay.test.tsx` green

## References

- Epic Brief stories 1–6, 10–13
- Tech Plan: snapshot-during-render, layouts, i18n
- Stitch v2: https://gist.github.com/PierreTsia/1cf2af5c3010f43a5625cac5f3ab78e9
- Original overlay: T52 / #129
