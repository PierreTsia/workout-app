# T231 — Hero + Succès + tenure + hop

## Goal

Wire Hero (avatar, name, equipped title, active Program, **Profil tenure**, **Hero hop line**) and Succès (Latest + Highest career, Recently earned in window, `{n}/{total}`, Voir tout → `/achievements`) from profile + `get_badge_status` + first-session date. Addresses Epic stories 6, 7. **Training streak** is not on this Hero.

## Mode

AFK — tenure vs streak, hop vs QW, and the three Succès jobs are HITL-locked.

## Slice

user profile + `get_badge_status` → Hero / Succès strip → `file:src/lib/profile/tenure.ts` + hop from snapshot → vitest (first session, hop ≥2 program_id, badges not top-3-by-tier)

## Dependencies

T227 (snapshot for hop + recently-earned window; tenure from `MIN(sessions.started_at)`, fallback `profiles.created_at`) — **not started**. T225 **done**. Do not start until T227 is committed.

## Scope

### Hero

- Avatar, name, equipped title, active **Program** from existing profile/program reads (no new RPC if already loaded).
- **Profil tenure**: human duration since first finished session (`file:src/lib/profile/tenure.ts`). Not a day-chain streak. Not `consistency_streak`.
- **Hero hop line**: only if ≥2 distinct non-null `program_id` produced a session **in the current window**. QW does not count. Copy may still say “cette semaine” in FR — use the copy deck; do not switch the predicate to ISO week on 100d.

### Succès

- Latest = max `granted_at` career
- Highest = max rank / `tier_level` career
- Recently earned = `granted_at` in window
- Count career `{n}/{total}`
- CTA **Voir tout** → `/achievements`
- Do not copy Account’s top-3-by-`tier_level` vitrine

First-paint budget: `get_badge_status` is the extra RT allowed beside snapshot (Tech Plan). Do not add a third session-list fetch.

### Tests

- Tenure uses first finished session, not `created_at`, when sessions exist
- No-session user falls back to `profiles.created_at`
- One Program + QW → no hop line
- Two programs in window → hop line
- Recently earned ignores career-only grants outside the window

## Out of Scope

- Regulars (T232)
- Ungate (T236)
- Redesigning `/achievements`
- Putting **Training streak** back on the Hero

## Acceptance Criteria

- [ ] Hero caption is **Profil tenure**, not a streak
- [ ] Hop line hidden unless ≥2 distinct `program_id` in **this** window
- [ ] Succès Latest/Highest are career; Recently earned is window-filtered
- [ ] Voir tout navigates to `/achievements`
- [ ] Demoable: admin Hero shows live tenure; toggling 7j vs 100j can show/hide hop without changing Latest badge
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 6–7
- Tech Plan: first-paint badge RT, window context
- Glossary: **Profil tenure**, **Hero hop line**
