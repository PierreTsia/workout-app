# Epic Brief — Workout App v2

## Summary

Workout App v2 is a full rebuild of the existing single-file vanilla JS workout tracker into a modern, production-grade React + TypeScript application. The rebuild introduces a Supabase backend (Postgres + Google OAuth) to unlock persistent session history, progression analytics, and personal record detection — features that are impossible without a real data store. Alongside the backend, v2 ships a PWA layer for home-screen installability, a custom workout builder with an exercise library, a dark/light theme toggle, and a hamburger-driven side drawer for navigation. The result is a personal training tool that grows with the user over time, replacing the current stateless, hardcoded experience.

---

## Context & Problem

**Who is affected:** Pierre Tsiakkaros — sole user, 45yo, trains 6 days/week at Neoness gym across a push/pull/legs/full-body split.

**Current state (`file:index.html`):**
- A single 426-line HTML file with inline CSS and JS — no build tooling, no persistence
- Workout programs are hardcoded constants; changing them requires editing source code
- Session state lives only in memory — closing the tab loses everything
- No history, no trends, no way to know if today's lift was a personal best
- The `☰` menu icon is decorative — it does nothing
- No installability; must open a browser tab every session

**Pain points:**
| Pain | Impact |
|---|---|
| No session persistence | Can't track progress week-over-week |
| Hardcoded workouts | Can't adapt programs without editing code |
| No PR detection | Misses motivational moments |
| No analytics | No visibility into strength trends |
| Not installable | Friction at gym — extra taps to open |
| Single theme | No flexibility for different lighting conditions |

---

## Scope

All 7 planned v2 features ship in this Epic:

1. **Project migration** — Vite + React + TypeScript, replacing the monolith
2. **Supabase backend** — Postgres schema, Google OAuth, persistent session & set logging, plus offline queueing with auto-sync on reconnect
3. **Progression tracking** — inline "last session" reference per exercise + dedicated history/analytics dashboard
4. **PR badges** — personal record detection using best estimated 1RM (weight + reps formula) and celebration on set completion
5. **PWA** — installable to home screen via `vite-plugin-pwa`, offline app shell
6. **Theme toggle** — dark/light switch in Settings, persisted to `localStorage`
7. **Custom workout builder** — full CRUD on workout days and exercises, backed by a Supabase exercise library catalogue

**Out of scope (v3):** multi-user, cloud sync across devices, AI rep suggestions, wearable integration, social features.

---

## Goals

- **Primary:** Give Pierre a single tool that replaces spreadsheet + timer + fitness app — with history and progression built in
- **Secondary:** Make the app feel native on mobile (PWA, fast, offline-capable)
- **Tertiary:** Make workout programs editable without touching code

---

## Success Criteria

- **Numeric:** ≥95% of completed workouts are successfully synced to cloud history within 5 minutes after connectivity is restored.
- **Numeric:** 100% of core workout actions (mark set done, progress through exercises, finish session) remain usable while offline.
- **Numeric:** 100% of session finishes with skipped sets show an explicit confirmation before saving.
- **Qualitative:** Pierre can complete an entire gym session without switching to spreadsheet/timer/other fitness tools.
