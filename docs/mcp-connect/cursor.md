# Connect GymLogic to Cursor

Use your training data, exercise catalog, and workout stats from Cursor's AI agent via GymLogic's MCP server — and **save a new multi-day program** when you have validated a plan (`create_program`: dry run, then apply).

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- [Cursor](https://cursor.com) installed

## Setup

### 1. Get your access token

1. Go to [gymlogic.me](https://gymlogic.me) and sign in
2. Open browser DevTools (`Cmd+Option+I` on macOS)
3. Go to **Application** > **Local Storage** > find the key starting with `sb-`
4. Expand the JSON value and copy the `access_token` field

> The token expires after 1 hour. You'll need to refresh it when it expires.

### 2. Add the MCP server

Edit your global MCP config at `~/.cursor/mcp.json` (create it if it doesn't exist):

```json
{
  "mcpServers": {
    "gymlogic": {
      "url": "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp",
      "headers": {
        "Authorization": "Bearer <YOUR_ACCESS_TOKEN>"
      }
    }
  }
}
```

Replace `<YOUR_ACCESS_TOKEN>` with the token from step 1.

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

## Troubleshooting

| Problem | Fix |
|---|---|
| Only `search_exercises` shows up | Close Cursor entirely, reopen the project, start a new Agent chat |
| "Authentication required" errors | Your token expired — get a fresh one from step 1 |
| Tools not listed at all | Check `~/.cursor/mcp.json` syntax, restart MCP in Cursor Settings |
