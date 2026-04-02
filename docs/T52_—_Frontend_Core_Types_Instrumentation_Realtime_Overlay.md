# T52 — Frontend Core: Types, Instrumentation, Realtime & Overlay

## Goal

Wire the frontend to the achievement backend: TypeScript types, `rest_seconds` instrumentation in the set-log flow, achievement RPC call after session finish, Realtime subscription for live unlock events, overlay queue with deduplication, and the full-screen `AchievementUnlockOverlay`. After this ticket, finishing a workout session can grant badges and display the unlock overlay.

## Dependencies

- **T51** — DB tables, RPCs, and seed data must exist.

## Scope

### TypeScript types

File: `src/types/achievements.ts`

New types: `AchievementGroup`, `AchievementTier`, `UserAchievement`, `BadgeStatusRow` (matches `get_badge_status` return shape), `UnlockedAchievement` (matches `check_and_grant_achievements` return shape).

### Type updates on existing interfaces

| File | Change |
|---|---|
| `file:src/types/database.ts` | Add `rest_seconds?: number \| null` to `SetLog` |
| `file:src/types/onboarding.ts` | Add `active_title_tier_id?: string \| null` to `UserProfile` |

### Jotai atoms

File: `file:src/store/atoms.ts`

| Atom | Type | Purpose |
|---|---|---|
| `achievementUnlockQueueAtom` | `atom<UnlockedAchievement[]>` | Overlay queue — consumed on display |
| `achievementShownIdsAtom` | `atom<Set<string>>` | Tier IDs already shown this session — prevents Realtime + RPC overlap duplicates. In-memory only, reset on reload. |
| `lastSessionBadgesAtom` | `atom<UnlockedAchievement[]>` | Populated by `processSessionFinish`, read by `SessionBadges` (T53). Cleared on next session start. |

### `rest_seconds` instrumentation

**Export utility from `file:src/hooks/useRestTimer.ts`:**

```typescript
export function getRestElapsedSeconds(
  rest: RestState | null,
  sessionPausedAt: number | null,
): number | null
```

Returns effective elapsed rest in seconds (pause-aware, clamped to ≥ 0), or `null` if no rest is active.

**Compute in `file:src/components/workout/SetsTable.tsx`:**

Before calling `enqueueSetLog`, read `restAtom` and call `getRestElapsedSeconds`. Pass the result as `restSeconds` in the payload. This MUST happen before `setRest(newRest)` overwrites the atom.

**Add to `file:src/lib/syncService.ts`:**

- Add `restSeconds?: number | null` to `SetLogPayloadReps` and `SetLogPayloadDuration`
- In `processSetLog`: include `rest_seconds: p.restSeconds ?? null` in the upsert row

### Achievement RPC call after session finish

In `file:src/lib/syncService.ts` → `processSessionFinish`:

After the successful session upsert (and optional progression updates), call the RPC in a separate try/catch:

```typescript
try {
  const { data } = await supabase.rpc('check_and_grant_achievements', { p_user_id: userId })
  if (data?.length) {
    // Push to overlay queue (with dedup)
    // Write to lastSessionBadgesAtom
  }
} catch {
  // Swallowed — session is already saved
}
```

The function must still return `true` if the session upsert succeeded, regardless of RPC outcome.

### `useBadgeStatus` hook

File: `src/hooks/useBadgeStatus.ts`

React Query hook wrapping `get_badge_status` RPC. Pattern: `queryKey: ["badge-status", user?.id]`, `enabled: !!user`, returns `BadgeStatusRow[]`.

### `AchievementRealtimeProvider`

File: `src/components/achievements/AchievementRealtimeProvider.tsx`

- Subscribes to `user_achievements` INSERT events via `supabase.channel('achievements').on('postgres_changes', ...)`
- On INSERT: enriches event with tier/group data from `useBadgeStatus` query cache
- Pushes into `achievementUnlockQueueAtom` with dedup by `tier_id` (checks `achievementShownIdsAtom`)
- Auth-gated: subscribes when `authAtom` is non-null, unsubscribes on logout
- Cleanup: `channel.unsubscribe()` + `supabase.removeChannel()` on unmount

### `AchievementUnlockOverlay`

File: `src/components/achievements/AchievementUnlockOverlay.tsx`

- Radix Dialog, rendered at `AppShell` level
- Reads `achievementUnlockQueueAtom`; opens when non-empty
- Visual sequence (CSS only): backdrop fade → badge scale-in (spring overshoot) → rank glow → particle burst → staggered text (title, rank pill, group name)
- Haptic: `navigator.vibrate([100, 50, 200])` on reveal
- Audio: two-tone ascending chime via Web Audio (523 Hz → 784 Hz) — reuse `playBeep` pattern
- Auto-dismiss after 4s or on tap/Escape
- On dismiss: shift queue, record `tier_id` in `achievementShownIdsAtom`, show next after 500ms delay
- Diamond rank + null `active_title_tier_id` → auto-equip (plain `user_profiles.update`)

### CSS keyframes

In `file:src/styles/globals.css`:

- `@keyframes badge-reveal` — scale(0) → scale(1.15) → scale(1)
- `@keyframes rank-glow` — opacity pulse with rank-colored radial gradient
- `@keyframes particle-burst` — box-shadow dots animating outward

### Wire into AppShell

In `file:src/components/AppShell.tsx`:

Wrap content with `AchievementRealtimeProvider`, render `AchievementUnlockOverlay` at the shell level (above `<Outlet />`).

### Tests

**Extend existing:**

| File | New scenarios |
|---|---|
| `src/lib/syncService.test.ts` | `rest_seconds` in upsert row; RPC called after session upsert; RPC failure swallowed; RPC response pushed to queue atom; RPC not called when upsert fails |
| `src/components/workout/SetsTable.test.tsx` | `restSeconds` computed and included in `enqueueSetLog` payload; `null` when rest timer inactive |
| `src/hooks/useRestTimer.test.ts` | `getRestElapsedSeconds` returns correct values with/without pauses; clamps to 0; returns null when no rest |
| `src/store/atoms.test.ts` | Queue dedup by `tier_id`; shown IDs prevent re-display |

**New:**

| File | Scenarios |
|---|---|
| `src/components/achievements/AchievementRealtimeProvider.test.tsx` | Subscribe on mount + auth; unsubscribe on unmount/logout; INSERT event pushes to queue with dedup |
| `src/components/achievements/AchievementUnlockOverlay.test.tsx` | Renders when queue non-empty; shows correct badge info; auto-dismiss; queue shift on dismiss; auto-equip on Diamond; no render when empty |
| `src/hooks/useBadgeStatus.test.ts` | Calls RPC with correct params; disabled when no auth |

## Out of Scope

- `BadgeGrid`, `BadgeDetailDrawer`, `BadgeIcon` components (T53)
- `SessionBadges` component rendering (T53 — atom is populated here, component is built there)
- Title equip/unequip UI (T53)
- Account page integration (T53)
- CSS badge frame classes for ranks (T53)
- i18n keys (T53)
- AI icon assets (T54)

## Acceptance Criteria

- [ ] `rest_seconds` is included in `set_logs` upsert when rest timer was active; `null` otherwise
- [ ] `rest_seconds` value is pause-aware (excludes accumulated pause time)
- [ ] `check_and_grant_achievements` RPC is called after successful session finish in `processSessionFinish`
- [ ] RPC failure does not affect session save result (`processSessionFinish` still returns `true`)
- [ ] RPC response populates both `achievementUnlockQueueAtom` and `lastSessionBadgesAtom`
- [ ] `AchievementUnlockOverlay` renders as full-screen takeover with badge animation, rank glow, particle burst, and staggered text
- [ ] Overlay includes haptic feedback and audio chime on reveal
- [ ] Multiple unlocks are queued and shown sequentially with 500ms gap
- [ ] Overlay deduplicates by `tier_id` — no double display from Realtime + RPC overlap
- [ ] Realtime subscription is auth-gated and properly cleaned up on logout/unmount
- [ ] `useBadgeStatus` hook returns typed `BadgeStatusRow[]` from `get_badge_status` RPC
- [ ] All new and extended tests pass

## References

- [Tech Plan — Gamification Achievement Badge System #129](./Tech_Plan_—_Gamification_Achievement_Badge_System_#129.md) → Component Architecture, Interaction Flows, PR 2, Test Strategy
