# Workflow Operator on Slack

Workflow Operator on Slack uses a Slack bot to map each Slack channel to a persistent Dagu AI agent session using [Socket Mode](https://api.slack.com/apis/socket-mode) (WebSocket-based, no public HTTP endpoint required). Messages sent in Slack are forwarded to the built-in AI agent, and agent responses are posted back. When a DAG run completes, Workflow Operator can also send AI-generated notifications so follow-up stays in the same conversation.

## Prerequisites

Before setting up Workflow Operator on Slack, configure the AI agent in the Web UI. Go to **Agent Settings** (`/agent-settings`) and set up the agent model, tool policy, and other defaults first. The Slack bot forwards messages to the built-in agent, so it must be configured before Slack can use it. Start with [Agent Settings](/features/agent/settings/), then use [Models & Providers](/features/agent/settings/models) and [Tool Permissions & Bash Policy](/features/agent/settings/controls) for the concrete setup pieces.

## Creating a Slack App

Before configuring Dagu, you need to create a Slack app with Socket Mode enabled.

### 1. Create the app

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App** → **From scratch**.
2. Name it (e.g., `Dagu`) and select your workspace. Click **Create App**.

### 2. Enable Socket Mode and get the App-Level Token

1. Go to **Settings → Socket Mode** in the left sidebar.
2. Toggle **Enable Socket Mode** to ON.
3. When prompted, create an App-Level Token:
   - Name: anything (e.g., `dagu-socket`)
   - Scope: `connections:write`
   - Click **Generate**
4. Copy the token. It starts with `xapp-`. This is the value for `bots.slack.app_token`.

### 3. Add Bot Token Scopes

1. Go to **Features → OAuth & Permissions**.
2. Under **Bot Token Scopes**, add:
   - `app_mentions:read`
   - `chat:write`
   - `channels:history` (for messages in public channels)
   - `groups:history` (for messages in private channels)
   - `im:history` (for direct messages)


### 4. Subscribe to Events

1. Go to **Features → Event Subscriptions**.
2. Toggle **Enable Events** to ON.
3. Under **Subscribe to bot events**, add the events for the channel types you use:

   | Event | Required for |
   |-------|-------------|
   | `app_mention` | @mention support (all channel types) |
   | `message.channels` | Messages in **public** channels |
   | `message.groups` | Messages in **private** channels |
   | `message.im` | Direct messages |
   | `message.mpim` | Group direct messages |

   At minimum, add `app_mention` and the event(s) matching your channel type. If the bot doesn't respond to messages without @mention, the most common cause is a missing event subscription here (e.g., using a private channel without `message.groups`).

4. Click **Save Changes**.

### 5. (Optional) Add Slash Commands

If you want `/dagu-new` and `/dagu-cancel` slash commands:

1. Go to **Features → Slash Commands**.
2. Create two commands:
   - Command: `/dagu-new`, Description: `Start a new session`, Request URL: leave empty (Socket Mode handles it)
   - Command: `/dagu-cancel`, Description: `Cancel current session`, Request URL: leave empty

### 6. Enable Interactivity

For interactive buttons (agent prompts) to work:

1. Go to **Features → Interactivity & Shortcuts**.
2. Toggle **Interactivity** to ON.
3. No Request URL is needed when Socket Mode is enabled.

### 7. Enable Direct Messages

To allow users to DM the bot directly (without @mentioning in a channel):

1. Go to **Features → App Home**.
2. Under **Show Tabs**, check **Messages Tab**.
3. Optionally check **Allow users to send Slash commands and messages from the messages tab**.

Without this, users will see "Sending messages to this app has been turned off" when trying to DM the bot.

### 8. Install the app

1. Go to **Settings → Install App**.
2. Click **Install to Workspace** → **Allow**.
3. Copy the **Bot User OAuth Token**. It starts with `xoxb-`. This is the value for `bots.slack.bot_token`.

If you already installed the app before adding scopes or enabling features, you need to **reinstall** it. Go to **Settings → Install App** and click **Reinstall to Workspace**.

### 9. Invite the bot to a channel

In the Slack channel where you want to use the bot, type:

```
/invite @Dagu
```

(Replace `@Dagu` with whatever you named your app.)

## Finding your Channel ID

Right-click the channel name in Slack → **View channel details**. The Channel ID is at the bottom of the details panel (e.g., `C07ABC123DE`).

Alternatively, open the channel in Slack's web interface. The URL contains the channel ID:

```
https://app.slack.com/client/T.../C07ABC123DE
```

The `C07ABC123DE` part is the channel ID.

## Running

The Slack connector for Workflow Operator starts automatically when `bots.provider` is set to `slack` and you run either:

```bash
dagu server
```

or

```bash
dagu start-all
```

In both modes, the connector shares the server's agent API instance.

## Configuration

Set `provider: slack` under `bots` and configure the Slack-specific fields. Only one connector can be active at a time.

```yaml
bots:
  provider: slack
  safe_mode: true
  slack:
    bot_token: "xoxb-your-bot-token"
    app_token: "xapp-your-app-token"
    allowed_channel_ids:
      - "C07ABC123DE"
      - "C08XYZ456FG"
    respond_to_all: true
```

### `bots` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `""` (disabled) | Which connector to run. Set to `"slack"` for Slack. If empty, no bot starts. |
| `safe_mode` | bool | `true` | Passed to the agent's `ChatRequest.SafeMode` field. Applies to all bot connectors. |

### `bots.slack` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `bot_token` | string | (required) | Bot User OAuth Token from the Slack app. Starts with `xoxb-`. |
| `app_token` | string | (required) | App-Level Token with `connections:write` scope. Starts with `xapp-`. |
| `allowed_channel_ids` | []string | (required) | Slack channel IDs authorized to use the bot. Messages from other channels are silently ignored. |
| `respond_to_all` | bool | `true` | When `true`, the bot responds to every message in allowed channels without requiring an @mention. When `false`, the bot only responds to @mentions and thread replies where it is already participating. DMs are always handled regardless of this setting. |

### Environment variables

| Variable | Config equivalent |
|----------|-------------------|
| `DAGU_BOTS_PROVIDER` | `bots.provider` |
| `DAGU_BOTS_SAFE_MODE` | `bots.safe_mode` |
| `DAGU_BOTS_SLACK_BOT_TOKEN` | `bots.slack.bot_token` |
| `DAGU_BOTS_SLACK_APP_TOKEN` | `bots.slack.app_token` |
| `DAGU_BOTS_SLACK_ALLOWED_CHANNEL_IDS` | `bots.slack.allowed_channel_ids` |
| `DAGU_BOTS_SLACK_RESPOND_TO_ALL` | `bots.slack.respond_to_all` |

Environment variables take precedence over the config file for `bot_token` and `app_token`. For `allowed_channel_ids`, use a comma-separated string:

```bash
export DAGU_BOTS_SLACK_ALLOWED_CHANNEL_IDS=C07ABC123DE,C08XYZ456FG
```

## Event Handling

The bot handles three types of Socket Mode events:

### Events API (`app_mention`, `message`)

- **`app_mention`**: When someone @mentions the bot in a channel. The `<@BOTID>` prefix is stripped from the text. The bot replies in a thread starting from that message. Once the bot is in a thread, subsequent replies in that thread do not require @mentioning.
- **`message`**: Regular channel messages. Bot messages, message edits, and other subtypes are ignored (only messages where `SubType` is empty and `BotID` is empty are processed). The routing depends on the message context:
  1. **DMs** (`ChannelType == "im"`): always handled, regardless of `respond_to_all`.
  2. **Thread replies** in a thread the bot is already participating in: handled without requiring @mention.
  3. **Channel messages** (not a thread reply, not a DM): only handled when `respond_to_all` is `true`. When handled this way, they are treated like DM messages (no thread is created).

Messages from channels not in `allowed_channel_ids` are silently dropped.

### Slash Commands

If you registered `/dagu-new` and `/dagu-cancel` as slash commands in the Slack app:

| Command | Behavior |
|---------|----------|
| `/dagu-new` | Resets the channel's session state and clears the current agent session |
| `/dagu-cancel` | Cancels the currently active agent session |

### Text Commands

If you don't register slash commands, you can also type these as plain messages (or after @mentioning the bot):

| Text | Behavior |
|------|----------|
| `new` | Same as `/dagu-new` |
| `cancel` | Same as `/dagu-cancel` |

Any text starting with `new` or `cancel` is treated as a command. All other text is forwarded to the agent.

### Interactive Components (Button Presses)

When the agent emits a `UserPrompt` with options, the bot renders it as a Block Kit message with a `SectionBlock` (question text) and an `ActionBlock` containing `ButtonBlockElement` elements. Each button's `action_id` is formatted as `prompt:<promptID>:<optionID>`.

When a user clicks a button, the bot submits the selected option to the agent and updates the original message to show the selection.

Button labels are truncated to 75 characters (Slack's limit for button text).

If the prompt allows free text (`AllowFreeText: true`), the user can also reply with a regular text message instead of clicking a button.

## Session Rotation

The bot tracks token usage across all messages in a session. When total tokens exceed 50% of the assumed context limit (200,000 tokens), the bot automatically:

1. Collects the last 3 user/assistant exchanges from the old session (each truncated to 200/300 characters respectively)
2. Resets the chat state
3. Creates a new session with the summary prepended to the user's message
4. Sends a notice: `(Session context limit reached — continuing with recent context carried forward)`

## DAG Run Notifications

When the centralized event store is available (the default in both `server` and `start-all` modes), the bot starts a DAG run monitor that reads persisted DAG-run events and sends notifications. If the event store is disabled or unavailable, Slack chat works normally but DAG-run notifications stay disabled.

### Monitored statuses

Notifications are sent for these DAG run statuses:

- `succeeded`
- `failed`
- `aborted`
- `partially_succeeded`
- `rejected`
- `waiting` (for human approval requests)

### How notifications work

1. The monitor polls the event store every **10 seconds** and reads only new DAG-run events, using durable on-disk state so restarts do not lose pending notifications.
2. On first startup, it seeds its cursor at the current event-store head, so existing channels only receive future events.
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

Messages longer than 4,000 characters are split at paragraph boundaries (`\n\n`), falling back to line boundaries (`\n`) if no paragraph break exists in the second half of the text.

## User Identity

All Slack users are mapped to agent sessions with `auth.RoleAdmin`. The user ID format is `slack:<slack_user_id>` (e.g., `slack:U01ABC23DEF`). For DAG run notifications, the user ID is `slack:<channel_id>`.
