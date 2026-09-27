---
description: Find, organize, and reply to email in an IMAP mailbox with mail.search, mail.organize, and mail.send, using accounts defined in mail_accounts.
---

# Mailbox

Dagu can work in an existing mailbox: find email, mark or move it, and send or reply from it. Accounts are defined once under `mail_accounts` and named by address in each step.

| Action | Use it to |
|--------|-----------|
| `mail.search` | Find email in a folder, with its sender, subject, text, and attachments. |
| `mail.organize` | Mark email read, unread, flagged, or unflagged, and move it to a folder, the archive, or the trash. |
| `mail.send` with `mailbox` | Send from the account, or reply to an email it received. |

The mailbox is reached over IMAP, and mail is sent over SMTP. Gmail and Google Workspace, Microsoft 365 and Outlook.com, and any server that offers IMAP work.

::: tip Notifications
To be told when a run fails or succeeds, use the DAG-level `smtp` block with `mail_on`, `error_mail`, and `info_mail`; see [Email Notifications](/writing-workflows/email-notifications). Those never use `mail_accounts`.
:::

## Quick Start

Every five minutes, create a ticket for each unread support email, then mark that email read:

```yaml
secrets:
  - name: SUPPORT_MAIL_PASSWORD
    ref: mail/support

mail_accounts:
  support@example.com:
    provider: google
    password: ${SUPPORT_MAIL_PASSWORD}

schedule: "*/5 * * * *"

steps:
  - id: find
    action: mail.search
    with:
      mailbox: support@example.com
      unread: true

  - id: each
    depends: find
    foreach:
      items: ${steps.find.outputs.messages}
      as: email
      key: ${foreach.email.id}
      max_concurrent: 1
      steps:
        - id: ticket
          run: ./create-ticket.sh "$SUBJECT" "$SENDER"
          env:
            - SUBJECT: ${foreach.email.subject}
            - SENDER: ${foreach.email.from_address}

        - id: done
          depends: ticket
          action: mail.organize
          with:
            mailbox: support@example.com
            emails: ${foreach.email.id}
            mark: read
```

- `mail.search` publishes the unread emails as `messages`, oldest first.
- `foreach` runs its `steps` once for each email. `${foreach.email}` is the current email, and `${foreach.email.subject}` one of its fields.
- The email's text reaches the script through `env`, never inside the command itself; see [Safety](#safety).
- Marking the email read is the last step for that email, so an email whose ticket fails stays unread and the next run tries it again; see [Process Each Email Once](#process-each-email-once).

## Mail Accounts

`mail_accounts` is a DAG-level map keyed by email address. Each step names an account by that address in `with.mailbox`, compared case-insensitively.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `provider` | string | No | `imap` | `google`, `microsoft`, or `imap`. Sets the default servers. |
| `imap` | object | For an `imap` account | Provider default | IMAP server: `host`, `port`, `security`, and `skip_tls_verify`. |
| `smtp` | object | To send through an `imap` account | Provider default | SMTP server, with the same fields as `imap`. |
| `username` | string | No | The address | Login name for a password, and the user an OAuth token signs in as. |
| `password` | string | One of `password` or `oauth` | - | Password or app password. |
| `oauth` | object | One of `password` or `oauth` | - | OAuth refresh-token credentials; see [OAuth](#oauth). |

Account fields resolve at run start like other DAG fields, so a password or token usually comes from a [secret](/writing-workflows/secrets). Resolved secret values are masked in logs.

### Providers and Servers

| Provider | IMAP | SMTP |
|----------|------|------|
| `google` | `imap.gmail.com:993`, `tls` | `smtp.gmail.com:465`, `tls` |
| `microsoft` | `outlook.office365.com:993`, `tls` | `smtp.office365.com:587`, `starttls` |
| `imap` | Set `imap.host` | Set `smtp.host` to send |

A server block overrides the provider default field by field:

| Field | Default | Description |
|-------|---------|-------------|
| `host` | Provider default | Server host name. |
| `port` | Standard port | 993 for IMAP or 465 for SMTP with `tls`; 143 for IMAP or 587 for SMTP with `starttls`. Changing only `security` switches to that mode's standard port. |
| `security` | `tls` | `tls` connects with TLS. `starttls` upgrades the connection and fails when the server does not offer STARTTLS. |
| `skip_tls_verify` | `false` | Accept any server certificate, such as a self-signed one. Use it only for a server you run yourself. |

Every connection uses TLS. An account with no SMTP server can find and organize email but not send it.

```yaml
secrets:
  - name: BILLING_MAIL_PASSWORD
    ref: mail/billing

mail_accounts:
  billing@example.com:
    username: billing
    imap:
      host: mail.example.com
    smtp:
      host: mail.example.com
      security: starttls
    password: ${BILLING_MAIL_PASSWORD}

steps:
  - id: find
    action: mail.search
    with:
      mailbox: billing@example.com
      within: 24h
```

Gmail, iCloud, Yahoo, and Fastmail accept an app password made on the provider's site in place of the account password. Microsoft 365 and Outlook.com no longer accept passwords over IMAP; use [OAuth](#oauth).

### OAuth

`oauth` holds a refresh token. Before each IMAP or SMTP connection, the action exchanges it for an access token and signs in with `XOAUTH2`. Access tokens never appear in logs, outputs, or run status.

| `oauth.provider` | Required fields | Optional fields |
|------------------|-----------------|-----------------|
| `google_refresh` | `client_id`, `client_secret`, `refresh_token` | - |
| `microsoft_refresh` | `client_id`, `refresh_token` | `tenant_id` (default `common`), `client_secret`, `scopes` |

`microsoft_refresh` asks for `https://outlook.office.com/.default`, the mail permissions that were granted, unless `scopes` lists the scopes to ask for instead. `offline_access` is always added. `google_refresh` does not accept `scopes`.

```yaml
secrets:
  - name: SUPPORT_MAIL_TOKEN
    ref: mail/support-token

mail_accounts:
  support@contoso.com:
    provider: microsoft
    oauth:
      provider: microsoft_refresh
      client_id: 00000000-0000-0000-0000-000000000000
      refresh_token: ${SUPPORT_MAIL_TOKEN}
      scopes:
        - https://outlook.office.com/IMAP.AccessAsUser.All
        - https://outlook.office.com/SMTP.Send

steps:
  - id: find
    action: mail.search
    with:
      mailbox: support@contoso.com
      unread: true
```

A Microsoft 365 shared mailbox signs in as its own address with the token of a member who can open it, so leave `username` unset.

::: warning Keeping a refresh token current
Dagu uses the configured refresh token and does not store a new one that the provider returns. Getting the token in the first place, with the provider's consent screen, happens outside Dagu. Some providers end a refresh token after a while even when it is used; Microsoft does after 90 days. Replace the secret with a fresh token before then.
:::

### Base Configuration

A [base config](/server-admin/base-config#mail-accounts) can define `mail_accounts` for every DAG. A DAG's entry replaces the base entry for the same address as a whole, and the other base entries remain.

## Find Email

`action: mail.search` lists email in one folder.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mailbox` | string | Yes | - | Address of an account in `mail_accounts`. |
| `folder` | string | No | `INBOX` | Folder to search. |
| `unread` | boolean | No | `false` | Only unread email. |
| `from` | string | No | - | Part of the sender's name or address. |
| `subject` | string | No | - | Part of the subject. |
| `within` | string | No | - | Only email received within a duration such as `30m`, `24h`, or `7d`. |
| `has_attachments` | boolean | No | `false` | Only email with at least one attachment. |
| `save_attachments` | boolean | No | `false` | Save attachments to the run's artifacts; see [Attachments](#attachments). |
| `limit` | integer | No | `20` | Most emails to return, from 1 to 50. |

An email matches when it meets every filter given. `from` and `subject` match case-insensitively. The oldest matching emails come first, so a backlog is worked through in order. Searching never changes an email; in particular it does not mark email read.

### Search Outputs

Read the results as `${steps.<step-id>.outputs.<field>}`. Mail actions have fixed outputs, so a `mail.search` or `mail.organize` step does not declare `output`, `outputs`, or `stdout.outputs`.

| Field | Type | Description |
|-------|------|-------------|
| `messages` | array | The emails found, oldest first. |
| `count` | integer | How many emails `messages` holds. |
| `truncated` | boolean | Whether any text was shortened, or any email left out, to fit the output limit. |

Each email in `messages` has these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | The email, for `mail.organize` and `in_reply_to`. See [Email IDs](#email-ids). |
| `message_id` | string | The Message-ID header without angle brackets, or empty when the email has none. |
| `folder` | string | The folder the email is in. |
| `from_name` | string | Sender's display name. |
| `from_address` | string | Sender's address. |
| `to` | array | Recipient addresses. |
| `cc` | array | Copied addresses. |
| `subject` | string | Subject. |
| `date` | string | When the email was received, in RFC 3339. |
| `unread` | boolean | Whether the email is unread. |
| `flagged` | boolean | Whether the email is flagged. |
| `text` | string | The plain-text body, or the HTML body converted to text, at most 10,000 characters. |
| `attachments` | array | `{name, content_type, size, path}` for each attachment. `path` is set only when attachments are saved. |

When the outputs would exceed the output limit (900 KiB, or the DAG's `max_output_size` less 64 KiB when that is smaller), the `text` values are shortened further. If they still do not fit, the newest emails are left out, so the oldest stay first in line for the next run.

### Attachments

With `save_attachments: true`, the step writes each attachment under `mail/<step name>/` in the run's [artifacts](/writing-workflows/artifacts), and each attachment's `path` is the saved file's absolute path. File names are made safe for the file system and numbered to stay unique. Writing `save_attachments: true` in the DAG turns on artifact storage for the run, unless the DAG sets `artifacts.enabled: false`.

```yaml
secrets:
  - name: BILLING_MAIL_PASSWORD
    ref: mail/billing

mail_accounts:
  billing@example.com:
    provider: google
    password: ${BILLING_MAIL_PASSWORD}

steps:
  - id: invoices
    action: mail.search
    with:
      mailbox: billing@example.com
      subject: invoice
      has_attachments: true
      save_attachments: true

  - id: record
    depends: invoices
    run: ./record-invoices.sh
    env:
      - INVOICES: ${steps.invoices.outputs.messages}
```

## Organize Email

`action: mail.organize` marks email, moves it, or both.

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `mailbox` | string | Yes | - | Address of an account in `mail_accounts`. |
| `emails` | string, object, or array | Yes | - | One email or a list; see below. |
| `mark` | string | One of `mark` or `move` | - | `read`, `unread`, `flagged`, or `unflagged`. |
| `move` | string | One of `mark` or `move` | - | `folder`, `archive`, or `trash`. |
| `folder` | string | For `move: folder` | - | Destination folder, created when it does not exist. |
| `dry_run` | boolean | No | `false` | Report what would change and change nothing. |

An item in `emails` is an email ID, or an object with an `id`, such as an email from `mail.search`. A string that holds a JSON object or array is decoded, so a whole `${steps.<id>.outputs.messages}` or `${foreach.<as>}` can be passed. An item may also carry `move_to`, which replaces `folder` for that email when `move` is `folder`. An email from `mail.search` carries `folder`, which says where it is, not where to move it.

For each email the action applies `mark`, then `move`:

- `folder` moves the email to the destination folder.
- `archive` moves it to the account's archive folder: the folder marked `\Archive`, or `\All` when there is none, as on Gmail.
- `trash` moves it to the folder marked `\Trash`.

Nothing is deleted permanently. An email someone already moved or deleted is skipped and listed in `missing`; it does not fail the step.

| Output | Type | Description |
|--------|------|-------------|
| `changed` | integer | How many emails changed, or with `dry_run`, how many would. |
| `missing` | array | IDs of the emails that were no longer in their folder. |

A step that decides where each email goes can hand its answer straight to `mail.organize`. Here a script writes `moves=` and a JSON list of `{"id": ..., "move_to": ...}` to its [output file](/writing-workflows/outputs):

```yaml
secrets:
  - name: TEAM_MAIL_PASSWORD
    ref: mail/team

mail_accounts:
  team@example.com:
    provider: google
    password: ${TEAM_MAIL_PASSWORD}

steps:
  - id: find
    action: mail.search
    with:
      mailbox: team@example.com
      unread: true

  - id: route
    depends: find
    run: ./choose-folders.sh >> "$DAGU_OUTPUT_FILE"
    env:
      - MESSAGES: ${steps.find.outputs.messages}
    outputs:
      - name: moves

  - id: file
    depends: route
    action: mail.organize
    with:
      mailbox: team@example.com
      emails: ${steps.route.outputs.moves}
      mark: read
      move: folder
```

## Send and Reply

`action: mail.send` with `with.mailbox` sends through that account's SMTP server and sign-in instead of the DAG-level `smtp` block. `from` defaults to the mailbox address. The other fields, such as `to`, `subject`, `message`, and `attachments`, work as they do in [Mail](/step-types/mail).

`with.in_reply_to` makes the message a reply to one email of the mailbox. It takes an email ID, or an email object with an `id`, and requires `mailbox`. Before sending, the action reads that email without changing it:

- `to` defaults to the email's Reply-To address, or its sender when it has none.
- `subject` defaults to `Re: ` and the email's subject, unless that subject already starts with `Re:`.
- The reply carries `In-Reply-To` and `References`, so mail clients show it in the same conversation.

An explicit `to` or `subject` replaces the default.

```yaml
secrets:
  - name: SUPPORT_MAIL_PASSWORD
    ref: mail/support

mail_accounts:
  support@example.com:
    provider: google
    password: ${SUPPORT_MAIL_PASSWORD}

steps:
  - id: find
    action: mail.search
    with:
      mailbox: support@example.com
      unread: true

  - id: each
    depends: find
    foreach:
      items: ${steps.find.outputs.messages}
      as: email
      key: ${foreach.email.id}
      max_concurrent: 1
      steps:
        - id: acknowledge
          action: mail.send
          with:
            mailbox: support@example.com
            in_reply_to: ${foreach.email.id}
            message: Thanks for writing. We will get back to you within a day.

        - id: done
          depends: acknowledge
          action: mail.organize
          with:
            mailbox: support@example.com
            emails: ${foreach.email.id}
            mark: read
```

## Process Each Email Once

To handle every incoming email exactly once, search with `unread: true` and mark each email read, or move it, once its work is done:

- **Work per email**, such as a ticket or a reply: put `mail.organize` last inside the `foreach`, as in the [Quick Start](#quick-start). An email whose work fails stays unread, so the next run retries it alone, and the emails that succeeded are not handled again. Marking after the loop instead would leave every email unread when one fails, and the next run would repeat the work already done for the rest.
- **Work on the whole batch**, such as a daily summary: one `mail.organize` step at the end with `emails: ${steps.<search-id>.outputs.messages}`.

A step that succeeds just before its mark fails runs again next time. That window is one step wide.

### Email IDs

An email ID is an opaque string. It stays valid for the same account while the email stays in its folder. After the email moves, or the server renumbers the folder, the ID no longer finds it.

`message_id` does not change when the email moves. Compare it against a record of what a workflow has handled to recognize an email seen before, for example after someone marks it unread again.

## Safety

The sender of an email controls its subject, text, names, and attachment file names.

- Do not put email fields inside `run` or `command`. A value substituted into a command becomes part of it, so a subject containing shell syntax would run on the host. Pass fields through `env` and read `"$NAME"`, as the examples on this page do.
- Treat email text as untrusted input to an AI agent that can run commands or change files, since the text can instruct it. A [model call](/step-types/llm/) that only answers is safer.
- `save_attachments` writes files the sender chose. Inspect them before opening them with other tools.

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `mail account "<address>" is not configured` | `mailbox` names an address missing from `mail_accounts`. | Add the account to the DAG or its base config. |
| `set exactly one of password or oauth` | The account has both, or neither. | Keep one. |
| `imap.host is required` | An `imap` account without an IMAP server. | Set `imap.host`, or set `provider`. |
| `sign-in is no longer valid (invalid_grant)` | The provider revoked or expired the refresh token. | Get a new token and update the secret. |
| `save_attachments requires artifact storage` | The DAG sets `artifacts.enabled: false`, or `save_attachments` comes from a value, which does not turn storage on. | Remove `artifacts.enabled: false`, or set `artifacts.enabled: true`. |
| `in_reply_to requires mailbox` | A reply without `with.mailbox`. | Name the mailbox the email was found in. |
| `in_reply_to: the email is no longer in its folder` | The email was moved or deleted before the reply. | Reply before moving the email. |
| `mail.organize requires with.mark or with.move` | The step neither marks nor moves. | Set `mark`, `move`, or both. |

A connection that transfers nothing for two minutes fails the step. Changes `mail.organize` already made stay made.

## Related

- [Mail](/step-types/mail) - Send email through the DAG-level `smtp` block
- [Email Notifications](/writing-workflows/email-notifications) - Email about runs
- [Base Configuration](/server-admin/base-config) - Share `mail_accounts` across DAGs
- [Secrets](/writing-workflows/secrets) - Keep passwords and tokens out of DAG files
- [Outputs](/writing-workflows/outputs) - How later steps read action outputs
- [Artifacts](/writing-workflows/artifacts) - Where saved attachments go
