# T53 — UI Surfaces: BadgeGrid, Detail Drawer, Title System & i18n

## Goal

Build all user-facing achievement surfaces: the `BadgeGrid` on the Account page, `BadgeDetailDrawer` with title equip/unequip, `SessionBadges` in the post-workout summary, `AccountBadgeShowcase` header, `BadgeIcon` compositing component, CSS rank frames, and full i18n (FR + EN). After this ticket, users can browse their achievements, equip titles, and see newly unlocked badges in the session summary.

## Dependencies

- **T52** — hooks (`useBadgeStatus`), atoms (`achievementUnlockQueueAtom`, `lastSessionBadgesAtom`), types (`BadgeStatusRow`, `UnlockedAchievement`), and overlay must exist.

## Scope

### `BadgeIcon` component

File: `src/components/achievements/BadgeIcon.tsx`

Pure presentational. CSS frame class (`badge-frame-bronze` through `badge-frame-diamond`) + `<img>` for icon PNG.

Props: `rank`, `iconUrl`, `size` (`"sm" | "md" | "lg"`), `locked` (boolean — grayscale filter + reduced opacity).

Graceful fallback when `iconUrl` is null (during dev / before T54): render the CSS frame with a placeholder silhouette.

### CSS badge frames

In `file:src/styles/globals.css`:

5 rank classes with CSS custom properties:

| Class | `--badge-hue` | `--badge-sat` | Key visual |
|---|---|---|---|
| `.badge-frame-bronze` | 30 | 80% | Matte copper, thin border |
| `.badge-frame-silver` | 210 | 10% | Polished sheen, medium border |
| `.badge-frame-gold` | 45 | 90% | Metallic sheen + radial glow pseudo-element |
| `.badge-frame-platinum` | 200 | 30% | Iridescent shimmer via hue rotation keyframe |
| `.badge-frame-diamond` | 280 | 70% | Prismatic gradient rotation + particle pseudo-elements |

These variables also drive the overlay glow, particle burst colors, and rank pill styling (single source of truth for rank aesthetics).

### `BadgeGrid`

File: `src/components/achievements/BadgeGrid.tsx`

- Calls `useBadgeStatus()` for data
- 5 group sections, each with 5 `BadgeIcon` slots
- Unlocked: full color + title. Next: dimmed + progress bar ("12/25 workouts"). Locked: silhouette.
- Progress bar under each group showing `current_value` / next unlocked tier's `threshold_value`
- Tap on any badge → opens `BadgeDetailDrawer`

### `BadgeDetailDrawer`

File: `src/components/achievements/BadgeDetailDrawer.tsx`

Vaul drawer (matches `RestTimerDrawer`, `QuickWorkoutSheet` patterns):

- Large `BadgeIcon`
- Title (localized via `useTranslation`) + rank pill
- Unlock date or "X more to go"
- Group context (which group, what rank, next milestone)
- **"Equip title" button** (unlocked badges only): `supabase.from('user_profiles').update({ active_title_tier_id })` → invalidate `["user-profile", userId]` → `toast.success(t("achievements:titleEquipped"))`
- **"Unequip" button** if this badge is the active title: sets `active_title_tier_id` to `null`
- Handle `check_violation` error from the ownership trigger gracefully

### `SessionBadges`

File: `src/components/achievements/SessionBadges.tsx`

- Reads from `lastSessionBadgesAtom` (populated in T52 by `processSessionFinish`)
- Renders horizontal strip of `BadgeIcon` components below existing session stats
- Subtle entrance animation (slide-in-from-bottom) when atom is populated after async RPC returns
- If atom is empty after RPC: renders nothing
- Tappable → opens `BadgeDetailDrawer`

### Wire into `SessionSummary`

In `file:src/components/workout/SessionSummary.tsx`:

Render `<SessionBadges />` below the existing stats grid and PR list.

### `AccountBadgeShowcase`

File: `src/components/achievements/AccountBadgeShowcase.tsx`

- Reads from `useBadgeStatus()` cache + `useUserProfile()` for `active_title_tier_id`
- Active title under `display_name`, styled with rank color. Hidden if no title equipped.
- "X / 25 unlocked" counter pill
- Row of 5 small `BadgeIcon` (one per group) showing highest unlocked rank. Locked placeholder for groups with no unlocks.
- Tappable → scrolls to `BadgeGrid`

### Wire into `AccountPage`

In `file:src/pages/AccountPage.tsx`:

- `AccountBadgeShowcase` in the header area (below identity section, above training section)
- `BadgeGrid` as a new section before the danger zone

### i18n

New namespace: `achievements`

Files: `src/locales/en/achievements.json`, `src/locales/fr/achievements.json`

Register in `file:src/lib/i18n.ts`.

Keys include: overlay messages (`unlocked`, `newAchievement`), grid labels (`allAchievements`, `locked`, `progress`), detail sheet text (`equipTitle`, `unequipTitle`, `titleEquipped`, `titleRemoved`, `moreToGo`), showcase labels (`unlockedCount`), rank names (`bronze`, `silver`, `gold`, `platinum`, `diamond`), group names and descriptions.

### Tests

**New:**

| File | Scenarios |
|---|---|
| `src/components/achievements/BadgeGrid.test.tsx` | Renders 5 groups × 5 tiers; locked badges grayscale; progress bars reflect `progress_pct`; tap fires onSelect |
| `src/components/achievements/BadgeDetailDrawer.test.tsx` | Equip calls `update` with correct tier_id; Unequip sets null; invalidates profile query; toast on success; handles ownership error |
| `src/components/achievements/SessionBadges.test.tsx` | Renders strip when atom has unlocks; renders nothing when empty |

**Extend:**

| File | Scenarios |
|---|---|
| `src/pages/AccountPage.test.tsx` | Badge showcase renders title + counter; BadgeGrid section present |

## Out of Scope

- AI-generated icon PNGs — `BadgeIcon` uses placeholder when `iconUrl` is null (T54)
- Realtime provider, overlay, rest_seconds instrumentation (T52)
- DB schema or RPCs (T51)
- Streak-based achievements, social sharing, leaderboards (Phase 2)

## Acceptance Criteria

- [ ] `BadgeGrid` on Account page shows 5 groups with 5 tiers each (unlocked, next, locked states)
- [ ] Progress toward next rank displayed per group
- [ ] `BadgeDetailDrawer` shows full badge info on tap with localized title and rank pill
- [ ] "Equip title" button updates `active_title_tier_id` and shows success toast
- [ ] "Unequip" button clears the active title
- [ ] Ownership trigger rejection is handled gracefully (no crash, error toast)
- [ ] `SessionBadges` renders newly unlocked badges in session summary (or nothing if none)
- [ ] `AccountBadgeShowcase` displays active title, X/25 counter, and top-rank icons
- [ ] 5 CSS rank frames render correctly with distinct visual treatments (Bronze → Diamond)
- [ ] `BadgeIcon` gracefully handles null `iconUrl` (placeholder)
- [ ] All user-facing text available in FR and EN via `achievements` namespace
- [ ] All new and extended tests pass

## References

- [Tech Plan — Gamification Achievement Badge System #129](./Tech_Plan_—_Gamification_Achievement_Badge_System_#129.md) → Component Architecture, PR 3, Test Strategy
- [Discovery — Gamification Achievement Badge System #129](./Discovery_—_Gamification_Achievement_Badge_System_#129.md) → Frontend Components, Rank System, Badge Asset System, CSS Frame Specifications
