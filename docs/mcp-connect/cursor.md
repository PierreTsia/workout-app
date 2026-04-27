# Connect GymLogic to Cursor

Use your training data, exercise catalog, and workout stats from Cursor's AI agent via GymLogic's MCP server — and **save a new multi-day program** when you have validated a plan (`create_program`: dry run, then apply).

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- [Cursor](https://cursor.com) installed

## Setup

### 1. Create a Personal Access Token (PAT)

1. Sign in at [gymlogic.me](https://gymlogic.me)
2. Open **Account** > **Security & access** > **Manage API tokens** (or go directly to [gymlogic.me/account/api-tokens](https://gymlogic.me/account/api-tokens))
3. Click **Create token**
4. Give it a clear name (e.g. `Cursor laptop`) and pick a lifetime (30 / 90 / 365 days, or never)
5. **Copy the token now** — it starts with `glp_` and is shown only once. Treat it like a password.

> Tokens are scoped to your account (full read + program write). Lost a token? Revoke it from the same page; the next request from that token will return 401.

### 2. Add the MCP server

Edit your global MCP config at `~/.cursor/mcp.json` (create it if it doesn't exist):

```json
{
  "mcpServers": {
    "gymlogic": {
      "url": "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_PAT>"
      }
    }
  }
}
```

Replace `<YOUR_PAT>` with the token from step 1 (the full `glp_…` string).

### 3. Activate in Cursor

1. Open **Cursor Settings** > **MCP**
2. You should see `gymlogic` listed — click the refresh icon if needed
3. Open a **new Agent chat** (existing chats won't pick up new tools)

## Available tools

| Tool | What it does |
|---|---|
| `search_exercises` | Search the exercise catalog by name (FR/EN), muscle group, equipment, or difficulty |
| `get_exercise_details` | Full exercise info: instructions, muscles, equipment, media |
| `get_workout_history` | Your past sessions with sets, weights, and PRs |
| `get_training_stats` | Volume by muscle group, personal records, session frequency |
| `get_upcoming_workouts` | Your programmed training days and exercises |
| `create_program` | **Create / replace your active program** from structured days + exercise UUIDs. Default **`dry_run: true`** returns the insert plan only; **`dry_run: false`** writes to Supabase (deactivates other active programs). Use after `search_exercises` / `get_exercise_details` to resolve IDs. |

There is also **1 MCP Resource** (`exercise_catalog_schema`) that exposes the exercise taxonomy (muscle groups, equipment types, difficulty levels).

**Six tools** total — five for reads/analysis, one for persisting a full program.

## Example prompts

- "Montre-moi mes 5 dernieres seances"
- "Cherche les exercices pour les pectoraux"
- "Analyse mon equilibre push/pull sur le dernier mois"
- "C'est quoi mon prochain training ?"
- "Donne-moi les details du Romanian Deadlift"
- "Voici ma semaine type en 4 jours — enregistre ça comme programme actif (dry run puis apply avec create_program)"

## Rotating or revoking a token

- **Rotate**: create a new token, swap it into `mcp.json`, restart Cursor, then revoke the old one from `/account/api-tokens`.
- **Revoke**: hit **Revoke** next to the token. Revocation is immediate and irreversible — there is no soft-delete.
- **Lost laptop**: revoke the corresponding token. Any other PATs you created keep working.

## Troubleshooting

| Problem | Fix |
|---|---|
| Only `search_exercises` shows up | Close Cursor entirely, reopen the project, start a new Agent chat |
| `401 Authentication required` | Token was revoked, expired, or mistyped. Create a fresh one from `/account/api-tokens`. |
| Tools not listed at all | Check `~/.cursor/mcp.json` syntax, restart MCP in Cursor Settings |
| Token works in `curl` but not Cursor | Make sure the value in `mcp.json` is the full `glp_…` string with no quotes inside the bearer or trailing whitespace |

## Legacy: pasting a 1-hour session JWT

> Deprecated — use a PAT instead.

You may still see older guides telling you to copy `access_token` from the browser's `localStorage`. That works but expires in 1 hour, which means a fresh OAuth dance every time you reopen Cursor. PATs replace that workaround.
