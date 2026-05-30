-- #379 — Isometric/duration exercises plateau prematurely.
-- T75 froze `duration_range_max_seconds` to the starting target, so the progression
-- engine declared PLATEAU on the first successful session (planks, hollow holds, hangs
-- stuck at e.g. 5×35s). Bodyweight holds progress on TIME, not load — raise the ceiling
-- to 90s so the engine keeps suggesting DURATION_UP before a real plateau.
--
-- `GREATEST` preserves any deliberately higher ceiling (e.g. a 120s plank stays 120),
-- and since we only raise the max, the `we_duration_range_order_chk` (min <= max)
-- invariant always holds. Mirrors the new web/Edge persistence default
-- (`deriveDurationRangeMax` in src/lib/progression.ts).

UPDATE workout_exercises
SET duration_range_max_seconds = GREATEST(duration_range_max_seconds, 90)
WHERE duration_range_max_seconds IS NOT NULL
  AND duration_range_max_seconds < 90;
