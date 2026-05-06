# T106 — Prepare Directory-Reviewer Test Account

## Goal

Anthropic Directory reviewers can install GymLogic in a fresh Claude Desktop and exercise every tool against an account with realistic data — so they see real workout history, real programs, real progression patterns, not a hollow shell. Create a dedicated `directory-reviewer@gymlogic.me` account, seed ~30 days of varied training data, generate a long-lived PAT (backup auth in case OAuth flakes for reviewers), and document the credentials privately.

Addresses Epic Brief story **5**: reviewer wants a test account with active program + 15 logged workouts + varied exercises + at least one PR-eligible session.

## Mode

**HITL** — judgment on what data realistically represents a 30-day-active user (program structure, exercise variety, set/rep patterns, PR-eligible session timing). Could automate the seeding via a script but the data choices are subjective.

## Slice

`auth (sign up via Google OAuth)` → `seed via app UI or seed script` → `PAT generation` → `private credentials doc`

End-to-end demoable: install GymLogic in a fresh Claude Desktop using the test account's OAuth, invoke `get_workout_history` → returns ≥15 sessions across the last 30 days.

## Dependencies

- **T105** (Worker deployed) — the test account's reviewer install points at `mcp.gymlogic.me`. If you set up the account before T105 ships, you'll be testing against the Supabase URL — workable but inconsistent with what reviewers will see.

## Scope

### 1. Account creation

- Sign up at https://www.gymlogic.me/auth using a dedicated email (e.g. `directory-reviewer@gymlogic.me` if you control the inbox, or a `+directory-reviewer@` alias).
- Complete onboarding: choose goal (e.g. "build muscle"), experience (e.g. "intermediate"), equipment (full gym), age/weight (realistic).
- Avatar: optional, use a generic placeholder.

### 2. Seed an active program

Two options:

**(a) Use the app UI** (more authentic-feeling for reviewers):
- Open Programs → Generate or Build → create a 4-day split (push / pull / legs / accessory or upper/lower split).
- Activate the program.

**(b) Use the existing seed script** (faster, more consistent):
- `npm run seed:history -- --user <directory-reviewer-uuid>` (script: `file:scripts/seed-local-history.ts` — verify it still works against prod).
- If the script targets local Supabase only, copy the pattern and run an ad-hoc SQL block via Supabase Studio.

Either way: the result must be one **active** program with 4 training days, each populated with 4-6 exercises spanning multiple muscle groups. Use real catalog exercises (no test fixtures).

### 3. Seed ≥15 logged workouts spanning the last 30 days

Target distribution:
- 15-20 logged sessions over the last 30 days (mix completed and planned).
- Spread across multiple training days from the active program.
- Variety: don't use the same 5 exercises repeatedly — show range.
- At least one **PR-eligible session**: a set where `weight_kg × reps` exceeds prior 1RM estimate for that exercise (the app auto-detects PRs; verify in History).
- At least one session with notes/RPE annotations (shows the annotation surfaces work).
- Realistic weight/rep patterns: no `999 kg × 999 reps` placeholder data.

If using the seed script doesn't naturally produce a PR-eligible session, manually log one through the app UI to ensure it's there.

### 4. Generate a long-lived PAT

- Navigate to https://www.gymlogic.me/account/api-tokens (signed in as the test account).
- Generate a new PAT with name `Anthropic Directory Reviewers — DO NOT REVOKE BEFORE APPROVAL`.
- Copy the PAT immediately (it won't be shown again).
- Note: PATs in this app default to no expiry (long-lived). Verify in the UI that no auto-expiry is set.

### 5. Document credentials privately

Store in the maintainer's password manager (1Password / Bitwarden / etc.):
- Account email + Google OAuth (no separate password — Google handles auth).
- PAT (copy the full token).
- Last seeding date (so you can refresh data if it ages out before review).

**Do NOT** commit credentials to the repo. Do NOT put them in `docs/` or any tracked file. The acceptance criterion is "PAT exists and is in the password manager", not "PAT is documented in version control".

### 6. Verify the account works for a fresh install

Test the reviewer experience yourself:

1. Open a clean Claude Desktop profile (or a colleague's machine if accessible).
2. Add Custom Connector → `https://mcp.gymlogic.me/functions/v1/mcp` → Name: `GymLogic`.
3. OAuth flow → log in with the test account's Google account → Accept consent.
4. Open chat, invoke each of these prompts:
   - "What programs do I have?" → should call `list_programs` → return the active 4-day split.
   - "Show me my workout history for the last 2 weeks" → `get_workout_history` → ≥10 sessions.
   - "What are my training stats?" → `get_training_stats` → meaningful numbers.
   - "What's coming up this week?" → `get_upcoming_workouts` → upcoming sessions from the active program.
   - "Search for bench press exercises" → `search_exercises` → catalog matches.

If any prompt returns "no data" or hits an error path, fix the seeding before declaring done.

### 7. Submission-form fields prep

The connector submission form (handled in T108) will ask for "test credentials". Prepare the snippet:

```
Account: directory-reviewer@gymlogic.me (Google OAuth)
Backup auth (if OAuth fails): Personal Access Token in /account/api-tokens — happy to share via secure channel on request.
Active program: 4-day split (Push/Pull/Legs/Accessory)
Logged sessions: ~18 across last 30 days
PR-eligible session: bench press, [date]
```

Save this snippet for T108 form-fill use.

## Out of Scope

- Automating the seeding via CI / fixtures — manual is fine for a one-off reviewer account.
- Refreshing data on a schedule (e.g. weekly cron to keep the account "active") — defer until reviewers actually flag stale data.
- PAT rotation post-approval — separate ops task (D2 ops checklist, not a ticket).
- Branding the test account UI to look more polished — same UI as every user; no special treatment.

## Acceptance Criteria

- [ ] Account `directory-reviewer@gymlogic.me` (or chosen alias) signed up and onboarded.
- [ ] One active program with 4 training days, each populated with realistic exercises.
- [ ] ≥15 logged workouts over the last 30 days with varied exercises across muscle groups.
- [ ] ≥1 PR-eligible session in History.
- [ ] Long-lived PAT generated with descriptive name; PAT stored in password manager (NOT in repo).
- [ ] Fresh Claude Desktop install via OAuth completes; all 5 verification prompts return meaningful responses.
- [ ] T108-ready snippet (test credentials + program summary) saved alongside the PAT in the password manager.
- [ ] Demoable: walk a colleague through the install flow on a fresh Claude profile; they see real-looking data immediately.

## References

- Epic Brief: `file:docs/Epic_Brief_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Track A6, story 5)
- Tech Plan: `file:docs/Tech_Plan_—_Publish_MCP_+_Skill_to_Anthropic_Directory_#296.md` (Implementation Notes → Deferred ticket scope: A6)
- Seed script reference: `file:scripts/seed-local-history.ts`
- App URLs: https://www.gymlogic.me/auth, https://www.gymlogic.me/account/api-tokens
- Predecessor: T64 OAuth setup (`file:docs/done/T64_—_OAuth_2.1_+_Consent_Page.md`), Long-Lived MCP Auth via PATs (`file:docs/done/Tech_Plan_—_Long-Lived_MCP_Auth_via_Personal_Access_Tokens.md`)
