# T231 — Hero + Succès + streak + hop

## Goal

Wire Hero (avatar, name, equipped title, active Program, **Training streak**, **Hero hop line**) and Succès (Latest + Highest career, Recently earned in window, `{n}/{total}`, Voir tout → `/achievements`) from profile + `get_badge_status` + snapshot days. Addresses Epic stories 6, 7.

## Mode

AFK — streak vs `consistency_streak`, hop vs QW, and the three Succès jobs are locked.

## Slice

user profile + `get_badge_status` → Hero / Succès strip → `lib/profile` streak + hop from snapshot → vitest (yesterday grace, hop ≥2 program_id, badges not top-3-by-tier)

## Dependencies

T227 (snapshot for hop + recently-earned window; streak from finished session days). T225 shell.

## Scope

### Hero

- Avatar, name, equipped title, active **Program** from existing profile/program reads (no new RPC if already loaded).
- **Training streak**: consecutive **local** days with ≥1 finished session; yesterday grace; `0` is a real number, not empty. Not `consistency_streak`.
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

- Streak 0 vs missing data
- Yesterday-only chain is not 0
- One Program + QW → no hop line
- Two programs in window → hop line
- Recently earned ignores career-only grants outside the window

## Out of Scope

- Regulars (T232)
- Ungate (T236)
- Redesigning `/achievements`

## Acceptance Criteria

- [ ] Streak uses local-day chain + yesterday grace; `0` renders as 0
- [ ] Hop line hidden unless ≥2 distinct `program_id` in **this** window
- [ ] Succès Latest/Highest are career; Recently earned is window-filtered
- [ ] Voir tout navigates to `/achievements`
- [ ] Demoable: admin Hero shows live streak; toggling 7j vs 100j can show/hide hop without changing Latest badge
- [ ] Env-stripped vitest + `tsc -p tsconfig.app.json --noEmit`

## References

- Epic Brief stories 6–7
- Tech Plan: first-paint badge RT, window context
- Glossary: **Training streak**, **Hero hop line**, **Profil achievements strip**
