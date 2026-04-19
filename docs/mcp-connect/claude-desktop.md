# Connect GymLogic to Claude Desktop

Use your training data and exercise catalog in Claude conversations via GymLogic's MCP server.

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

| Tool | What it does |
|---|---|
| `search_exercises` | Search the exercise catalog by name (FR/EN), muscle group, equipment, or difficulty |
| `get_exercise_details` | Full exercise info: instructions, muscles, equipment, media |
| `get_workout_history` | Your past sessions with sets, weights, and PRs |
| `get_training_stats` | Volume by muscle group, personal records, session frequency |
| `get_upcoming_workouts` | Your programmed training days and exercises |

## Example conversation

Try this sequence to test the full coaching experience:

1. **"What did I train this week?"** — pulls your recent sessions
2. **"How's my push/pull balance over the last month?"** — analyzes volume distribution
3. **"What's programmed for tomorrow?"** — checks your active program
4. **"Tell me about the Romanian Deadlift"** — searches and fetches exercise details
5. **"Based on all this, what should I focus on next?"** — Claude reasons across all the data

## Alternative: config file with `mcp-remote`

If the native connector UI doesn't work for your version, you can use the `mcp-remote` adapter instead. Requires Node.js 18+.

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gymlogic": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp"
      ]
    }
  }
}
```

Restart Claude Desktop after saving. `mcp-remote` will open your browser for OAuth on first use.

> **Node version matters**: Claude Desktop uses the first `npx` on your PATH. If you use nvm, make sure your default Node is 18+ (`nvm alias default 20`). Node 12/14 will crash `mcp-remote`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Connector shows "Not connected" | Click the connector and re-authenticate — the OAuth token may have expired |
| OAuth consent page doesn't load | Make sure you're signed in to GymLogic at `www.gymlogic.me` first |
| "Authentication required" errors | Disconnect and reconnect the connector to trigger a fresh OAuth flow |
| No hammer icon (config file method) | Check JSON syntax, verify Node.js 18+ is on your PATH (`node -v`) |
| `mcp-remote` crashes with `SyntaxError` | Your Node.js is too old — run `nvm use 20` or use the full path `/opt/homebrew/opt/node@22/bin/npx` in the config |
