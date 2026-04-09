# T54 — Assets & Polish: AI Icons, Storage Upload & Retroactive Grant

## Goal

Complete the visual layer: generate 25 AI icon PNGs (5 per group × 5 ranks), upload to Supabase Storage, update seed data with URLs, run the retroactive badge grant for existing users, and perform visual QA on the full badge compositing (CSS frame + icon). After this ticket, the gamification system is fully operational with production-quality visuals.

## Dependencies

- **T53** — UI surfaces must be in place to verify visual output (CSS frames, BadgeIcon, BadgeGrid).

## Scope

### AI icon generation

Generate 25 transparent PNG icons (512×512) using AI image generation. Use the prompts from the Discovery doc → "AI icon generation prompts" section.

Prompt template:
```
"[ICON_DESCRIPTION], [STYLE_LEVEL] style, centered composition,
transparent background, game UI icon asset, no border, no frame,
no text, high detail, 512×512 PNG"
```

Style escalates with rank: minimalist (Bronze) → bold (Silver) → dramatic (Gold) → luxurious (Platinum) → epic (Diamond).

| Group | Bronze | Silver | Gold | Platinum | Diamond |
|---|---|---|---|---|---|
| Consistency | dumbbell + flame | crossed dumbbells | demon skull + barbell | war machine crest | crown + laurel wreath |
| Volume | weight plate | stacked plates + dolly | Atlas + globe | anvil + molten steel | divine steel figure |
| Rhythm | hourglass | pendulum | metronome + waves | Swiss watch gears | cosmic clock |
| Records | fist through glass | crosshair + arrow | explosion + PR marker | lightning + anvil | hammer + mountain |
| Variety | magnifying glass | compass rose | Vitruvian man | anatomy blueprint | Frankenstein monster |

### Supabase Storage upload

Create `badge-icons` bucket (public read). Upload 25 PNGs with naming convention:

```
badge-icons/{group_slug}/{rank}.png
```

Example: `badge-icons/consistency_streak/bronze.png`

### Update seed data with URLs

File: `supabase/migrations/20260401000007_update_icon_urls.sql`

UPDATE each `achievement_tiers` row with the public URL from Storage:

```sql
UPDATE achievement_tiers SET icon_asset_url = '...'
WHERE group_id = (SELECT id FROM achievement_groups WHERE slug = '...')
AND rank = '...';
```

### Run retroactive badge grant

Execute `scripts/retroactive-badge-grant.sql` against production:

```sql
SELECT check_and_grant_achievements(user_id) FROM user_profiles;
```

Verify: existing users see pre-populated BadgeGrid on next app open. No overlay flood (badges granted server-side before Realtime subscription).

### Visual QA

- Verify all 25 badge icons render correctly within CSS frames at all 3 sizes (sm, md, lg)
- Verify locked state (grayscale + opacity) looks correct with real icons
- Verify overlay shows badge with icon (not placeholder) for newly-unlocked achievements
- Verify BadgeGrid, BadgeDetailDrawer, and AccountBadgeShowcase display icons correctly
- Verify dark/light theme compatibility for all rank frames

## Out of Scope

- CSS frame design changes (finalized in T53)
- Overlay behavior or Realtime logic (T52)
- DB schema or RPC changes (T51)
- Admin page for managing achievements (Phase 2)
- Social sharing of badges (Phase 2)

## Acceptance Criteria

- [ ] 25 AI-generated transparent PNG icons uploaded to `badge-icons` bucket in Supabase Storage
- [ ] All `achievement_tiers` rows have a valid `icon_asset_url` pointing to the correct icon
- [ ] Badge compositing works: CSS frame + icon overlay renders a complete badge at all sizes
- [ ] Locked badges show correctly with grayscale + opacity filter over real icons
- [ ] Existing users have retroactive badges granted (all groups except Rhythm Master)
- [ ] Retroactive grant did not trigger overlay floods — badges appear silently in the grid
- [ ] Visual QA passes for all 25 badges in both light and dark themes
- [ ] No regressions in overlay, BadgeGrid, or session summary rendering

## References

- [Discovery — Gamification Achievement Badge System #129](./Discovery_—_Gamification_Achievement_Badge_System_#129.md) → Badge Asset System, AI Icon Generation Prompts, Icon Matrix, Existing Users — Retroactive Badge Grant
- [Tech Plan — Gamification Achievement Badge System #129](./Tech_Plan_—_Gamification_Achievement_Badge_System_#129.md) → PR 4
