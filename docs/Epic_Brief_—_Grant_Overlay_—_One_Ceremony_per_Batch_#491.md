# Epic Brief — Grant Overlay — One Ceremony per Batch #491

## Summary

Finishing a session that unlocks several achievement tiers currently plays a 4-second slot machine — one medal, then the next, same chrome every time. This epic replaces that with one **Grant Batch** ceremony: the highest rank is the **Hero**, everything else is a **Supporting medal**, Equip title sits on the hero, and tap/Escape dismisses the whole batch. Pixel-perfect against the v2 Stitch screens. A hidden `/_unlock-overlay` playground is how we sign it off.

---

## Context & Problem

**Who is affected:** Anyone who finishes a session that grants more than one tier (common on first Circuit runs, volume jumps, and retroactive-adjacent bursts). Also anyone reviewing the overlay against design.

**Current state:**
- `AchievementUnlockOverlay` renders `queue[0]`, auto-dismisses after 4s, shifts on tap
- Copy is the group blurb (`groupDescriptions`), not the threshold the hero just cleared
- Equip title only lives in `BadgeDetailDrawer`
- No overlay component tests
- No playground — HITL means finishing real sessions and hoping for the right burst

**Pain points:**
| Pain | Impact |
|---|---|
| Serial 4s medals | A 3–4 tier finish is 12–16s of identical ceremony |
| Equal treatment of every unlock | Diamond and Bronze get the same stage; the batch has no hierarchy |
| Group blurb instead of threshold | User doesn't see *what they just cleared* |
| Auto-dismiss | Can't read, can't equip, can't compare to the Stitch |
| No fixture route | Pixel-perfect review requires farming grants |

---

## User Stories

1. As a lifter who just unlocked several tiers, I want one overlay for the whole **Grant Batch**, so that I am not queued through a slot machine.
2. As a lifter, I want the **Hero** to be the highest rank in the batch, so that the ceremony celebrates the biggest jump.
3. As a lifter with a single unlock, I want the Gold (or any single) layout: hero medal ~112px, eyebrow `Unlocked`, title, metal rank chip + track name, threshold line, so that it matches the v2 single screen.
4. As a lifter with exactly two unlocks, I want a ~120px hero and a ~72px supporting medal overlapping bottom-right (not a second hero), eyebrow `2 unlocked`, copy still about the hero, so that two grants read as one moment with a satellite.
5. As a lifter with 3 or 4 unlocks, I want one horizontal under-row of supporting medals (~56px) with rank + title captions, so that extras are a set, not a 2×2 grid or a carousel.
6. As a lifter with 5+ unlocks, I want that same row with a `+N` overflow tile as the last slot, so that a burst never paginates or serializes.
7. As a lifter, I want a primary **Equip title** button that equips the hero via the same `user_profiles.active_title_tier_id` path as the badge drawer, so that I can wear the new title without opening Succès.
8. As a lifter, I want Equip to stay on the overlay (toast, then tap to leave), so that equipping is not also dismiss.
9. As a lifter whose hero is already the active title, I want no Equip button, so that I never see a dead CTA.
10. As a lifter, I want tap-outside / overlay tap / Escape to dismiss the entire batch without equipping, so that skip is one gesture.
11. As a lifter, I want no auto-dismiss, so that I can actually look at the medals.
12. As a lifter, I want the threshold line to use existing `thresholdHint.{group_slug}` + the hero's `threshold_value` (on its own line, not crammed on the chip row), so that FR strings don't collide and copy stays honest.
13. As a lifter, I want late Realtime grants that arrive after the overlay opened to wait for the next ceremony, so that medals don't pop into a live takeover.
14. As a lifter with `prefers-reduced-motion`, I want static medals (no scale burst, no particles, no rain), so that the ceremony is still readable.
15. As a lifter on a Gold single, I want sparse gold dust + a short particle burst around the medal and rank glow behind the hero only, so that the emotional reference stays quiet.
16. As a lifter whose hero is Diamond, I want one purple/cyan square-particle burst behind type (not infinite rain, not a purple backdrop), so that Diamond is special without becoming a different game.
17. As a reviewer, I want a hidden `/_unlock-overlay` route with buttons for Bronze → Diamond singles plus 2 / 4 / 5+ batches, so that HITL does not require farming sessions.
18. As a lifter whose Equip request fails, I want an error toast and the overlay still open, so that a network blip doesn't eat the ceremony.

### Success measures

| Story # | Measure |
|---|---|
| 1 | One overlay open per Grant Batch; `AUTO_DISMISS_MS` gone |
| 6 | 5+ grants never open a second overlay or a carousel |
| 14 | `prefers-reduced-motion: reduce` → zero particle/scale animation |

---

## Scope

**In scope:**
- Grant Batch freeze + consume-whole-queue-on-open
- Hero pick + supporting layouts (1 / 2 overlap / 3+ row / 5+ `+N`)
- v2 chrome: dimmed session-summary backdrop, eyebrow, metal chip + track, threshold line, Equip
- `threshold_value` on `check_and_grant_achievements` return + Realtime mapper
- Shared Equip mutation (drawer + overlay)
- Overlay component tests
- Motion/FX as specified (quiet; Diamond-only extra particles)
- Hidden `/_unlock-overlay` playground + HITL visual closeout against Stitch v2 PNGs

**Out of scope:**
- Badge detail sheet restyle (progress bar, unlocked-on date stay there)
- New tracks / threshold numbers / icon assets
- Achievements page / accordion IA
- Recoloring the whole screen gold or purple
- Confetti cannons, emoji, “CONGRATS!!!”, toasts-as-the-ceremony
- Design-system / Storybook route (none exists; playground is the fixture)

---

## Success Criteria

- **Qualitative:** A 4-grant finish is one takeover whose hero is the highest rank; supporting medals sit in one under-row; Equip is optional; tap dismisses the batch.
- **Qualitative:** Single Gold and burst Diamond match the v2 Stitch PNGs at HITL (pixel-perfect, not “inspired by”).
- **Qualitative:** Reduced-motion users get static medals.
- **Numeric:** Overlay tests cover 1 / 2 / 4 / overflow, Equip vs dismiss, batch dismiss, reduced-motion skips FX.
- **Qualitative:** `/_unlock-overlay` can fire Bronze → Diamond and the batch cases without finishing a session.
