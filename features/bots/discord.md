# Workflow Operator on Discord

Workflow Operator on Discord connects Discord channels and DMs to the built-in Dagu agent over Discord's gateway. Each conversation keeps its own running context, so follow-up questions and DAG-run notifications stay in the same place.

## Prerequisites

Before setting up Workflow Operator on Discord, configure the AI agent in the Web UI. Go to **Agent Settings** (`/agent-settings`) and set up the agent model, tool policy, and other defaults first. The Discord bot forwards messages to the built-in agent, so it must be configured before Discord can use it. Start with [Agent Settings](/features/agent/settings/), then use [Models & Providers](/features/agent/settings/models) and [Tool Permissions & Bash Policy](/features/agent/settings/controls) for the concrete setup pieces.

## Creating a Discord App

Before configuring Dagu, you need to create a Discord application and bot user.

### 1. Create the application

1. Go to [https://discord.com/developers/applications](https://discord.com/developers/applications) and click **New Application**.
2. Name it (e.g., `Dagu`) and click **Create**.

### 2. Create the bot user

1. In the left sidebar, go to **Bot**.
2. Click **Reset Token** (or **Add Bot** on older-style applications) and copy the token. This is the value for `bots.discord.token` in Dagu config, or the `DAGU_BOTS_DISCORD_TOKEN` environment variable. Treat it like a password — it cannot be retrieved again once you leave the page.

### 3. Enable privileged intents

The bot needs to read message content. In the **Bot** tab:

1. Scroll to **Privileged Gateway Intents**.
2. Toggle **MESSAGE CONTENT INTENT** to ON.
3. Click **Save Changes**.

Without this intent, the bot will receive message events but `Content` will be empty for messages that do not @mention it, and `respond_to_all` will not work.

### 4. Invite the bot to your server

1. In the left sidebar, go to **OAuth2 → URL Generator**.
2. Under **Scopes**, check **bot** and (optionally) **applications.commands**.
3. Under **Bot Permissions**, check at least:
   - `View Channels`
   - `Send Messages`
   - `Send Messages in Threads`
   - `Read Message History`
   - `Use Slash Commands` (if you plan to add slash commands)
4. Copy the generated URL, open it in a browser, pick the server, and authorize.

### 5. Finding your Channel ID

1. In Discord, enable **Developer Mode** under **User Settings → Advanced**.
2. Right-click the channel name and choose **Copy Channel ID**. The ID is a numeric string (e.g., `1234567890123456789`). This is what you put in `allowed_channel_ids`.

## Running

The Discord connector for Workflow Operator starts automatically when `bots.provider` is set to `discord` and you run either:

```bash
dagu server
```

or

```bash
dagu start-all
```

In both modes, the connector shares the server's agent API instance.

## Configuration

Set `provider: discord` under `bots` and configure the Discord-specific fields. Only one connector can be active at a time.

```yaml
bots:
  provider: discord
  safe_mode: true
  discord:
    token: "your-discord-bot-token"
    allowed_channel_ids:
      - "1234567890123456789"
      - "9876543210987654321"
    respond_to_all: true
```

### `bots` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `""` (disabled) | Which connector to run. Set to `"discord"` for Discord. If empty, no bot starts. |
| `safe_mode` | bool | `true` | Passed to the agent's `ChatRequest.SafeMode` field. Applies to all bot connectors. |

### `bots.discord` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | string | (required) | Bot token from the Discord Developer Portal. |
| `allowed_channel_ids` | []string | (required) | Discord channel IDs authorized to use the bot. Messages from other guild channels are silently ignored. Direct messages to the bot are always handled regardless of this list. |
| `respond_to_all` | bool | `true` | When `true`, the bot responds to every message in allowed guild channels. When `false`, the bot only responds to messages that @mention it. DMs are always handled regardless of this setting. |

### Environment variables

| Variable | Config equivalent |
|----------|-------------------|
| `DAGU_BOTS_PROVIDER` | `bots.provider` |
| `DAGU_BOTS_SAFE_MODE` | `bots.safe_mode` |
| `DAGU_BOTS_DISCORD_TOKEN` | `bots.discord.token` |
| `DAGU_BOTS_DISCORD_ALLOWED_CHANNEL_IDS` | `bots.discord.allowed_channel_ids` |
| `DAGU_BOTS_DISCORD_RESPOND_TO_ALL` | `bots.discord.respond_to_all` |

Environment variables take precedence over the config file for `token`. For `allowed_channel_ids`, use a comma-separated string:

```bash
export DAGU_BOTS_DISCORD_ALLOWED_CHANNEL_IDS=1234567890123456789,9876543210987654321
```

## Event Handling

The bot subscribes to Discord's gateway and handles two types of events:

### Messages (`MessageCreate`)

- **DMs** (`GuildID == ""`): always handled.
- **Guild channel messages**: only handled when the channel ID is in `allowed_channel_ids`. With `respond_to_all: true`, every message is forwarded to the agent. With `respond_to_all: false`, only messages that @mention the bot are handled — the `<@BOT_ID>` prefix is stripped from the text before it reaches the agent.

Messages authored by bots (including this bot itself) are ignored to avoid loops.

### Interactive Components (Button Presses)

When the agent emits a `UserPrompt` with options, the bot renders it as a message with one or more `ActionsRow` components containing `Button` elements. Each button's `custom_id` is formatted as `prompt:<promptID>:<optionID>`.

When a user clicks a button, the bot submits the selected option to the agent and updates the original message in-place (via `InteractionResponseUpdateMessage`) to show the selection and remove the now-consumed buttons.

Button labels are truncated to 80 characters (Discord's limit for button labels). Up to 5 buttons are shown per row, and up to 5 rows per message — prompts with more than 25 options have the extras silently dropped.

If the prompt allows free text (`AllowFreeText: true`), the user can also reply with a regular text message instead of clicking a button.

### Text Commands

Type these as plain messages (or after @mentioning the bot when `respond_to_all` is false):

| Text | Behavior |
|------|----------|
| `new` | Starts a fresh conversation in the current channel |
| `cancel` | Cancels the currently active agent session |

Any text starting with `new` or `cancel` is treated as a command. All other text is forwarded to the agent.

## Session Rotation

When a conversation gets close to the model's context limit, Dagu automatically rolls it over to a fresh behind-the-scenes session and carries forward a short summary. Users can keep chatting in the same Discord channel or DM without doing anything manually.

## DAG Run Notifications

When event tracking is available (the default in both `server` and `start-all` modes), the bot can send DAG-run notifications into Discord. If event tracking is unavailable, Discord chat still works; only automatic run notifications are skipped.

### Monitored statuses

Notifications are sent for these DAG run statuses:

- `succeeded`
- `failed`
- `aborted`
- `partially_succeeded`
- `rejected`
- `waiting` (for human approval requests)

### How notifications work

1. Dagu checks for new run events every **10 seconds** and remembers what it has already delivered, so restarts do not resend old notifications or drop pending ones.
2. On first startup, existing channels only receive future events.
3. For each new completion, it creates a **dedicated agent session** per allowed channel, sends a structured prompt with the run details (DAG name, status, error, start/finish times, step results), and waits for the agent to generate a notification message (up to **10 minutes**).
4. The notification session is **adopted** as the channel's active session, so users can send follow-up messages like "show me the logs" or "retry it".
5. Delivered entries are retained for **2 hours** to suppress duplicate event replays, while failed deliveries remain pending and are retried.

### Fallback

If the agent API is unavailable or times out, the bot sends a plain text fallback:

```
<emoji> DAG '<name>' <status>
Error: <error message if any>
```

Where the emoji is: `✅` succeeded/partial, `❌` failed/rejected, `⚠️` aborted, `⏳` waiting.

## Message Length

Messages longer than 2,000 characters are split at paragraph boundaries (`\n\n`), falling back to line boundaries (`\n`) if no paragraph break exists in the second half of the text. Discord's message limit for bot content is 2,000 characters per message.

## User Identity

All Discord users are mapped to agent sessions with `auth.RoleAdmin`. The user ID format is `discord:<channel_id>` — the session is scoped to the channel, not to an individual user, so everyone posting in an allowed channel shares the same agent session.
