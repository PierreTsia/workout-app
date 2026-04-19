# T65 — Manual Testing Guide (Post-Merge)

## Pre-flight (do this once)

### 0.1 — Merge and deploy

1. Merge PR #234 into `main`
2. Wait for Vercel deploy to complete (check [Vercel dashboard](https://vercel.com) — the consent page at `https://gymlogic.me/oauth/consent` must be live)
3. Deploy the Edge Function:
   ```bash
   supabase functions deploy --no-verify-jwt mcp
   ```
4. In [Supabase Dashboard](https://supabase.com/dashboard) > Authentication > OAuth Server:
   - Confirm OAuth 2.1 is **enabled**
   - Authorization URL path = `/oauth/consent`
   - Dynamic client registration = **enabled**
   - Site URL = `https://gymlogic.me`

### 0.2 — Get a fresh Bearer token

Go to `https://gymlogic.me`, sign in, open browser DevTools > Application > Local Storage > find the `sb-*-auth-token` key, copy the `access_token` value. You'll need this for Cursor and for smoke-testing.

### 0.3 — Verify the server is alive

```bash
curl -s -X POST https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | jq .
```

Expected: JSON response with 5 tools. If this fails, stop — nothing else will work.

---

## Client 1 — Cursor (Bearer auth, easiest)

Cursor uses Bearer auth via the existing config. No OAuth needed.

### Step 1 — Update the token

Edit `~/.cursor/mcp.json`. Replace the `Authorization` header value with `Bearer <YOUR_FRESH_TOKEN>` from step 0.2.

### Step 2 — Restart Cursor MCP

Cursor Settings > MCP > click the refresh icon next to `gymlogic` (or toggle off/on).

### Step 3 — Verify discovery

Open a **new Agent chat** (not an existing one — Cursor caches tools per session).

Ask: **"What tools does gymlogic have?"**

Expected: the agent lists all 5 tools + 1 resource (`search_exercises`, `get_exercise_details`, `get_workout_history`, `get_training_stats`, `get_upcoming_workouts`, `exercise_catalog_schema`).

If only `search_exercises` shows up: close Cursor entirely, reopen the project, and try again (known Cursor caching issue).

### Step 4 — Run test prompts

One by one, in the same chat:

| Prompt | Expected tool call | What to check |
|---|---|---|
| "Cherche 'rowing'" | `search_exercises` | Returns multiple results, no IDs exposed |
| "Cherche 'kroc row'" | `search_exercises` | Single result WITH exercise ID shown |
| "Donne-moi les details de cet exercice" | `get_exercise_details` | Uses the UUID from above, returns full instructions |
| "Mes 5 dernieres seances" | `get_workout_history` | Returns your session data with dates and sets |
| "Mes stats de volume ce mois" | `get_training_stats` | Returns volume by muscle group + PRs |
| "C'est quoi mon prochain training ?" | `get_upcoming_workouts` | Returns program schedule or graceful "no active program" |

### Step 5 — Coaching conversation

Ask: **"Analyse mon equilibre push/pull sur le dernier mois et dis-moi ce que je devrais ameliorer"**

Expected: agent calls `get_training_stats` and possibly `get_workout_history`, then reasons about the data. This is the thesis test — is it better than in-app generate-workout?

---

## Client 2 — Le Chat / Mistral (free tier, OAuth)

Le Chat supports custom MCP "Connectors" via their UI. Free tier works.

### Step 1 — Go to Le Chat

Open [chat.mistral.ai](https://chat.mistral.ai) and sign in (free account works).

### Step 2 — Add a Connector

1. Go to **Agents** (left sidebar) > create a new Agent or edit an existing one
2. In the Agent config, look for **Connectors** / **Tools** section
3. Click **Add Connector** > **Custom MCP Server**
4. Fill in:
   - **Name**: `gymlogic`
   - **URL**: `https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp`
   - **Auth**: If OAuth is offered, select it. Le Chat should auto-discover the OAuth endpoints from Supabase's `/.well-known/oauth-authorization-server/auth/v1` discovery doc. If it asks for a Bearer token instead, paste the token from step 0.2.

### Step 3 — OAuth consent (if OAuth flow triggers)

- Le Chat should redirect you to `https://gymlogic.me/oauth/consent`
- You should see the GymLogic consent page with client name and scopes
- Click **Approve**
- You should be redirected back to Le Chat with the connection established

If the consent page doesn't load or shows an error:
- Check that Vercel deploy is live (`https://gymlogic.me/oauth/consent?authorization_id=test` should at least render the loading state)
- Check that Supabase Dashboard has OAuth 2.1 enabled
- Check that Site URL is set to `https://gymlogic.me` (not a Vercel preview URL)

### Step 4 — Test prompts

Same prompts as Cursor:
1. "What did I train this week?" — expects `get_workout_history`
2. "Search for bench press exercises" — expects `search_exercises`
3. "What are my training stats for this month?" — expects `get_training_stats`

### Step 5 — Note what breaks

Le Chat may handle tool calls differently from Cursor. Note:
- Does it discover all 5 tools?
- Does it respect the anti-spam pattern (not spamming `get_exercise_details`)?
- Are the structured text responses readable in Le Chat's UI?

---

## Client 3 — Claude Desktop (free mode, needs adapter)

Claude Desktop's JSON config only supports stdio, not HTTP. You need an adapter.

### Step 1 — Install the adapter

```bash
npm install -g @anthropic-ai/mcp-remote
```

(If that package doesn't exist, use `npx @anthropic-ai/mcp-remote` or `npx mcp-remote` — the adapter ecosystem is evolving. Alternative: `@pyroprompts/mcp-stdio-to-streamable-http-adapter`.)

### Step 2 — Edit Claude Desktop config

Open the config file:
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

Add or update the `mcpServers` block:

```json
{
  "mcpServers": {
    "gymlogic": {
      "command": "npx",
      "args": [
        "@anthropic-ai/mcp-remote",
        "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp"
      ]
    }
  }
}
```

If using Bearer auth instead of OAuth (simpler for testing):

```json
{
  "mcpServers": {
    "gymlogic": {
      "command": "npx",
      "args": [
        "@pyroprompts/mcp-stdio-to-streamable-http-adapter"
      ],
      "env": {
        "URI": "https://favusepjqwpcroiolvaz.supabase.co/functions/v1/mcp",
        "BEARER_TOKEN": "<YOUR_TOKEN>"
      }
    }
  }
}
```

### Step 3 — Restart Claude Desktop

Fully quit (Cmd+Q) and reopen. Look for the hammer icon in the chat input area — that means tools are loaded.

### Step 4 — Verify tool discovery

Ask: **"What tools do you have available?"**

Expected: Claude lists the 5 gymlogic tools.

### Step 5 — Run the coaching conversation

This is the real thesis test. Run these prompts in sequence:

1. "What did I train this week?"
2. "How's my push/pull balance over the last month?"
3. "What's programmed for tomorrow?"
4. "Tell me about the Romanian deadlift"
5. "Based on all this, what should I focus on next?"

Expected: Claude chains multiple tool calls, reasons across the data, and gives a coaching-quality answer that's better than what in-app generate-workout produces.

---

## Checklist (per client)

Copy this and check off as you go:

- [ ] Connects without errors
- [ ] Lists all 5 tools
- [ ] `search_exercises` returns results
- [ ] `get_exercise_details` returns full metadata (from a single-match search)
- [ ] `exercise_catalog_schema` resource is readable
- [ ] `get_workout_history` returns session data
- [ ] `get_training_stats` returns volume + PRs
- [ ] `get_upcoming_workouts` returns schedule (or graceful empty state)
- [ ] Anti-spam: asking "details du bench press" does NOT trigger 20 calls
- [ ] Coaching conversation feels better than in-app AI

---

## If things go wrong

| Symptom | Likely cause | Fix |
|---|---|---|
| "Authentication required" on all tools | Expired JWT | Get a fresh token from step 0.2 |
| Only `search_exercises` shows in Cursor | Cursor cache | Close Cursor fully, reopen project |
| Consent page 404 | Vercel hasn't deployed main yet | Wait for deploy or check Vercel dashboard |
| Consent page shows error | Site URL mismatch in Supabase | Dashboard > Auth > URL Config > set to `https://gymlogic.me` |
| Le Chat can't find OAuth endpoints | Discovery URL not configured | Check `/.well-known/oauth-authorization-server/auth/v1` returns JSON |
| Claude Desktop shows no hammer icon | Adapter not installed or config wrong | Check `npx` works, check JSON syntax |
| Tool responses are empty | User has no data for that query | Try broader filters (e.g. last 30 days instead of this week) |
