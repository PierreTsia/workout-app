# T215 — Equip title on the ceremony

## Goal

v2 puts a full-width primary **Equip title** on the overlay. Wire it through the same `user_profiles.active_title_tier_id` mutation as the badge drawer — extracted, not forked. Equip does not dismiss. Stories: 7–9, 18.

## Mode

AFK

## Slice

`useEquipTitle` hook + tests → drawer switchover → overlay CTA + overlay tests

## Dependencies

T214 (ceremony chrome exists)

## Scope

### Hook — `file:src/hooks/useEquipTitle.ts`

Lift the mutation from `file:src/components/achievements/BadgeDetailDrawer.tsx`:

- `mutationFn`: `user_profiles.update({ active_title_tier_id: tierId }).eq("user_id", user.id)` (`tierId: string \| null` so the drawer can still unequip)
- `onSuccess`: invalidate `["user-profile", user.id]`; toast `titleEquipped` or `titleRemoved`
- `onError`: toast `titleError`

`file:src/hooks/useEquipTitle.test.ts` via `renderHookWithProviders`. Mock supabase. Cases: equip success invalidates + equipped toast; null unequips + removed toast; error toast.

### Drawer

`BadgeDetailDrawer` calls the hook. Unequip button stays here only.

### Overlay CTA

- shadcn `Button` `size="lg"` full-width, default variant (primary ≈ `#00c9a7` — Equip accent, not celebration color)
- Label `t("equipTitle")`
- `onClick` **must** `stopPropagation` (overlay click dismisses)
- Equips **hero** `tier_id` only. Any rank. No Diamond special case.
- Does **not** dismiss. Toast, stay, tap/Escape to leave.
- Hide the button when `useUserProfile().data?.active_title_tier_id === hero.tier_id`
- Overlay tests: Equip click does not clear the batch; calls update with hero id; already-active hero → no button; click on overlay (not button) still dismisses without equipping

## Out of Scope

- Unequip on the overlay
- FX (T216)
- Playground (T217)

## Acceptance Criteria

- [ ] Drawer and overlay share `useEquipTitle` (no copied `useMutation` in the overlay)
- [ ] Equip hero succeeds → toast, overlay still open, profile query invalidated
- [ ] Equip click does not dismiss; overlay tap / Escape still dismisses without equipping
- [ ] Button hidden when hero is already the active title
- [ ] Equip failure → error toast, overlay stays
- [ ] `VITE_SUPABASE_URL= VITE_SUPABASE_ANON_KEY= npx vitest run src/hooks/useEquipTitle.test.ts src/components/achievements/AchievementUnlockOverlay.test.tsx` green

## References

- Epic Brief stories 7–9, 18
- Tech Plan: `useEquipTitle`
- Existing mutation: `file:src/components/achievements/BadgeDetailDrawer.tsx`
