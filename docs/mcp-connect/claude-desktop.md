# Connect GymLogic to Claude Desktop

Use your training data and exercise catalog in Claude conversations via GymLogic's MCP server, and **save a new multi-day program** with `create_program` after you review a dry-run preview.

## Prerequisites

- A [GymLogic](https://gymlogic.me) account with at least one logged workout
- [Claude Desktop](https://claude.ai/download) installed

## Setup

### 1. Add a Custom Connector

1. Open Claude Desktop
2. Click the **MCP plug icon** (bottom-left, below the conversation list) or go to **Settings** > **Connectors**
3. Click **Add custom connector**
4. Fill in:
  - **Name**: `Gymlogic`
  - **URL**: `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp`
  - Leave **OAuth Client ID** and **OAuth Client Secret** empty (GymLogic uses dynamic registration)
5. Click **Add**

### 2. Authenticate via OAuth

After adding the connector, Claude Desktop will trigger the OAuth flow:

1. Your browser opens to `www.gymlogic.me/oauth/consent`
2. Sign in with your GymLogic account if prompted
3. Review the permissions and click **Approve**
4. Return to Claude Desktop — the connector now shows as connected

### 3. Start chatting

Look for the **hammer icon** in the chat input area — this confirms tools are loaded. Ask something and Claude will use the GymLogic tools when relevant.

## Available tools


| Tool                    | What it does                                                                                                                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_exercises`      | Search the exercise catalog by name (FR/EN), muscle group, equipment, or difficulty                                                                                                           |
| `get_exercise_details`  | Full exercise info: instructions, muscles, equipment, media                                                                                                                                   |
| `get_workout_history`   | Your past sessions with sets, weights, and PRs                                                                                                                                                |
| `get_training_stats`    | Volume by muscle group, personal records, session frequency                                                                                                                                   |
| `get_upcoming_workouts` | Your programmed training days and exercises                                                                                                                                                   |
| `list_programs`         | List all your training programs (active, drafts, optionally archived) with id, name, day count, creation date, active-cycle flag                                                              |
| `get_program_details`   | Full structure of one program by UUID — days, exercises, sets/reps/weights/rest. Works on active, draft, or archived programs. Use after `list_programs` to drill into a specific one         |
| `create_program`        | **Create / replace your active program**: pass `name`, `days` with `label` + ordered `**exercise_ids`** (UUIDs). `**dry_run` defaults to true** (preview); set `**dry_run: false`** to write. |


**Eight tools** — seven reads, one write.

## Example conversation

Try this sequence to test the full coaching experience:

1. **"What did I train this week?"** — pulls your recent sessions
2. **"How's my push/pull balance over the last month?"** — analyzes volume distribution
3. **"What's programmed for tomorrow?"** — checks your active program
4. **"Tell me about the Romanian Deadlift"** — searches and fetches exercise details
5. **"Based on all this, what should I focus on next?"** — Claude reasons across all the data
6. **"Propose a revised 4-day split from that, show me a `create_program` dry run, then apply if I confirm"** — end-to-end adapt + save (replaces the current active program when applied)

## Alternative: long-lived Personal Access Token (PAT)

OAuth is the default and the smoothest path for the desktop app. If you prefer not to re-authenticate after long idle periods, or you are wiring Claude into a headless setup, you can authenticate with a **Personal Access Token** instead.

1. Sign in at [gymlogic.me](https://gymlogic.me) and open [gymlogic.me/account/api-tokens](https://gymlogic.me/account/api-tokens)
2. Click **Create token**, give it a name (e.g. `Claude Desktop`), pick a lifetime, and copy the `glp_…` value (shown once)
3. Use a static-bearer config instead of the OAuth connector:

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

Some Claude Desktop builds do not expose a `headers` field for SSE servers in the UI. In that case, use the `mcp-remote` adapter below — it understands `--header`.

Revoke a PAT at any time from `/account/api-tokens`; revocation is immediate and the next request returns 401.

## Alternative: config file with `mcp-remote`

If the native connector UI doesn't work for your version, you can use the `mcp-remote` adapter instead. Requires Node.js 18+ — see the gotchas below before editing the config.

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gymlogic": {
      "command": "/Users/you/.nvm/versions/node/v20.9.0/bin/npx",
      "args": [
        "mcp-remote",
        "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp"
      ]
    }
  }
}
```

Fully quit Claude Desktop (`Cmd+Q`, not just close the window) and reopen after saving. `mcp-remote` opens your browser for OAuth on first use; tokens cache locally for subsequent runs.

To use a PAT instead of OAuth with `mcp-remote`, pass it as a header:

```json
{
  "mcpServers": {
    "gymlogic": {
      "command": "/Users/you/.nvm/versions/node/v20.9.0/bin/npx",
      "args": [
        "mcp-remote",
        "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp",
        "--header",
        "Authorization: Bearer <YOUR_PAT>"
      ]
    }
  }
}
```

### `mcp-remote` setup gotchas (validated empirically)

> - **Node.js 18+ required**. `mcp-remote` crashes on Node 12 / 14 with `SyntaxError`.
> - **nvm gotcha**: Claude Desktop walks `PATH` in order and grabs the *first* `npx` it finds. If your default Node is 12, the run fails. Either `nvm alias default 20` or pin the absolute path to a Node 20+ `npx` in your config (recommended — see snippet above).
> - **npm cache permissions**: if you've ever run `sudo npm install`, the first `mcp-remote` fetch fails with `EACCES`. Fix with `sudo chown -R $(id -u):$(id -g) ~/.npm` before retrying.
> - **Recommended absolute path**: `/Users/you/.nvm/versions/node/v20.9.0/bin/npx` (substitute your actual nvm version path — get it from `which node` after `nvm use 20`).

## Troubleshooting


| Problem                                                            | Fix                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connector shows "Not connected"                                    | Click the connector and re-authenticate — the OAuth token may have expired                                                                                                                |
| OAuth consent page doesn't load                                    | Make sure you're signed in to GymLogic at `gymlogic.me` first                                                                                                                             |
| "Authentication required" errors                                   | Disconnect and reconnect the connector to trigger a fresh OAuth flow, or swap to a PAT (see above) for a longer-lived auth                                                                |
| `401` with a PAT                                                   | Token was revoked, expired, or mistyped. Create a fresh one at `/account/api-tokens`                                                                                                      |
| No hammer icon / no tools available (config file method)           | Check JSON syntax, verify Node.js 18+ is on your PATH (`node -v`), and `Cmd+Q` Claude Desktop fully (closing the window doesn't stop the process)                                         |
| `mcp-remote` crashes with `SyntaxError`                            | Your Node.js is too old — `nvm use 20` or pin the absolute path to a Node 20+ `npx` in your config (e.g. `/Users/you/.nvm/versions/node/v20.9.0/bin/npx`)                                 |
| `mcp-remote` first run fails with `EACCES` on `~/.npm`             | npm cache is root-owned from a past `sudo npm install`. Fix: `sudo chown -R $(id -u):$(id -g) ~/.npm`                                                                                     |
| Can't disconnect a `mcp-remote`-added connector via the Settings UI | The disconnect endpoint requires a `mcpsrv_*` ID, which manually-added MCP servers don't have. Edit `claude_desktop_config.json` to remove the entry, then `Cmd+Q` Claude and reopen      |


