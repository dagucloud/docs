# Workflow Operator on Telegram

Workflow Operator on Telegram connects Telegram chats to the built-in Dagu agent. Each chat keeps its own running context, so follow-up questions and DAG-run notifications stay in the same conversation.

## Prerequisites

Before setting up Workflow Operator on Telegram, configure the AI agent in the Web UI. Go to **Agent Settings** (`/agent-settings`) and set up the agent model, tool policy, and other defaults first. The Telegram bot forwards messages to the built-in agent, so it must be configured before Telegram can use it. Start with [Agent Settings](/features/agent/settings/), then use [Models & Providers](/features/agent/settings/models) and [Tool Permissions & Bash Policy](/features/agent/settings/controls) for the concrete setup pieces.

## Creating a Telegram Bot

Before configuring Dagu, you need to create a bot on Telegram and get its token.

1. Open Telegram and search for `@BotFather`, or go to [https://t.me/BotFather](https://t.me/BotFather).
2. Send `/newbot`.
3. BotFather will ask for a **display name** (e.g., `My Dagu Bot`). Send it.
4. BotFather will ask for a **username**. This must end in `bot` (e.g., `my_dagu_bot`). Send it.
5. BotFather replies with a message containing your bot token. It looks like this:

   ```
   Done! Congratulations on your new bot. You will find it at t.me/my_dagu_bot.
   You can now add a description, about section and profile picture for your bot, see /help for a list of commands.

   Use this token to access the HTTP API:
   123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
   ```

6. Copy the token (`123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11` in this example). This is the value for `bots.telegram.token` in Dagu config or the `DAGU_BOTS_TELEGRAM_TOKEN` environment variable.
7. Open a chat with your new bot in Telegram (search for `@my_dagu_bot`) and send any message. This is needed so the bot has a chat to respond to, and so you can retrieve your chat ID (see [Finding your chat ID](#finding-your-chat-id) below).

## Running

The Telegram connector for Workflow Operator starts automatically when `bots.provider` is set to `telegram` and you run either:

```bash
dagu server
```

or

```bash
dagu start-all
```

In both modes, the connector shares the server's agent API instance.

## Configuration

Set `provider: telegram` under `bots` and configure the Telegram-specific fields. Only one connector can be active at a time. Set these in the Dagu config file (`~/.config/dagu/config.yaml` or the path set by `DAGU_HOME`):

```yaml
bots:
  provider: telegram
  safe_mode: true
  telegram:
    token: "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
    allowed_chat_ids:
      - 123456789
      - 987654321
```

### `bots` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | string | `""` (disabled) | Which connector to run. Set to `"telegram"` for Telegram. If empty, no bot starts. Only one provider can be active at a time. |
| `safe_mode` | bool | `true` | Passed to the agent's `ChatRequest.SafeMode` field. Applies to all bot connectors. |

### `bots.telegram` fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `token` | string | (required) | Bot token from Telegram's [@BotFather](https://t.me/BotFather) |
| `allowed_chat_ids` | []int64 | (required) | Telegram chat IDs authorized to use the bot. Messages from other chats are rejected. |

### Environment variables

| Variable | Config equivalent |
|----------|-------------------|
| `DAGU_BOTS_PROVIDER` | `bots.provider` |
| `DAGU_BOTS_SAFE_MODE` | `bots.safe_mode` |
| `DAGU_BOTS_TELEGRAM_TOKEN` | `bots.telegram.token` |
| `DAGU_BOTS_TELEGRAM_ALLOWED_CHAT_IDS` | `bots.telegram.allowed_chat_ids` |

The environment variable takes precedence over the config file value for the token.

### Finding your chat ID

Send a message to your bot, then call the Telegram API to see the `chat.id`:

```bash
curl -s "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates" | jq '.result[0].message.chat.id'
```

## Telegram Commands

| Command | Behavior |
|---------|----------|
| `/start` | Prints a welcome message listing available commands |
| `/new` | Starts a fresh conversation in the current chat |
| `/cancel` | Cancels the currently active agent session |

Any non-command text message is forwarded to the agent. If no session exists, one is created. If a session already exists, the message is sent to it.

## Agent Prompts

When the agent asks the user a question (a `UserPrompt`), the bot renders it in Telegram:

- If the prompt has predefined options, they appear as **inline keyboard buttons**. Tapping a button submits that option.
- If the prompt allows free text (`AllowFreeText: true`), the user can also reply with a regular text message.
- If the prompt includes a `Command` field, it is shown in the message as `` `command text` ``.

Only prompts that are currently pending in the session are shown. Prompts that were already answered are not re-displayed.

## Session Rotation

When a conversation gets close to the model's context limit, Dagu automatically rolls it over to a fresh behind-the-scenes session and carries forward a compact summary. Users can keep chatting in the same Telegram chat without doing anything manually.

## DAG Run Notifications

When event tracking is available (the default in both `server` and `start-all` modes), the bot can send DAG-run notifications into Telegram. If event tracking is unavailable, Telegram chat still works; only automatic run notifications are skipped.

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
2. On first startup, existing chats only receive future events.
3. For each destination, it batches pending DAG-run notifications. Urgent single-run batches try to generate the message with the agent; all other batches use deterministic formatting. Batch delivery uses a **30-second** flush timeout.
4. The notification message is appended to the chat-scoped session. If the chat does not have an active session yet, Dagu creates an empty session first. Follow-up messages continue in that same chat session.
5. Delivered entries are retained for **2 hours** to suppress duplicate event replays, while failed deliveries remain pending and are retried.

### Fallback

If the agent API is unavailable or times out, the bot sends a plain text fallback:

```
<emoji> DAG '<name>' <status>
Error: <error message if any>
```

Where the emoji is: `✅` succeeded/partial, `❌` failed/rejected, `⚠️` aborted, `⏳` waiting.

## Polling Behavior

The bot subscribes to agent session updates by polling `GetSessionDetail`. Polling starts at **1 second** intervals. When there are no new messages and the agent is not working, the interval doubles up to **5 seconds**. When new messages arrive, it resets to 1 second. Polling stops when the agent is not working and no new messages have appeared for 3+ consecutive polls.
