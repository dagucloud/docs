---
description: Automate websites in a local Chrome with browser.run and browser.extract, driven by natural-language instructions and a model.
---

# Browser

Automate websites that have no API. A browser step drives a local Chrome with natural-language instructions, uploads local files, extracts structured data into step outputs, checks page state, and can pause for a person, for example to enter a one-time code, then continue in the same browser.

Browser steps are powered by the [Stagehand](https://github.com/browserbase/stagehand) Go SDK. Every model request goes through Dagu's own [LLM providers](/step-types/llm/providers), so the step uses the same `llm` configuration as `chat.completion`, and API keys never enter the browser.

::: tip Prefer a desktop app?
[Kitewell](https://kitewell.com/) is a separate app for automating websites on your own Mac or Windows PC without YAML.
:::

## Requirements

- Dagu v2.18.0 or later, and v2.23.0 or later for the [write gate](#write-gate).
- Google Chrome or Chromium installed on the host that runs the step. Dagu uses `browser.executable`, then `CHROME_PATH`, then a standard install location. Of the container images, only [`dev`](/server-admin/deployment/docker-images) includes Chromium, on amd64 and arm64.
- In a container, Chrome's sandbox needs a seccomp profile that allows user namespaces. Run the `dev` image with its [Compose setup](/server-admin/deployment/docker-images), which applies the bundled profile. Where the sandbox cannot start at all, `browser.sandbox: false` in the [Dagu config](/server-admin/reference) or `DAGU_BROWSER_SANDBOX=false` turns it off for every browser on the host. Without the sandbox, a page that exploits the browser runs with the permissions of the Dagu process, which in the Dagu images has `sudo`, so use it only for sites you trust. A DAG cannot change this setting. With the sandbox on, a browser step fails when `CI` is set or Dagu runs as root on Linux, because the browser would run without the sandbox there; set `DAGU_BROWSER_SANDBOX=false` to allow it.
- A model configured with a DAG-level `llm` block or `with.llm`, unless every operation replays without one (see [How Much AI Decides](#how-much-ai-decides)). Use a model that follows tool-call schemas reliably.

## Quick Start

`browser.extract` opens a page and returns structured data:

```yaml
secrets:
  - name: ANTHROPIC_API_KEY
    provider: env
    key: ANTHROPIC_API_KEY

llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: hn
    action: browser.extract
    with:
      url: https://news.ycombinator.com
      instruction: The top 5 stories with their points
      schema:
        type: object
        properties:
          stories:
            type: array
            items:
              type: object
              properties:
                title: { type: string }
                points: { type: integer }

  - id: report
    depends: hn
    run: echo '${steps.hn.outputs.stories}'
```

`browser.run` runs several operations in one browser session:

```yaml
secrets:
  - name: VENDOR_USER
    provider: env
    key: VENDOR_USER
  - name: VENDOR_PASSWORD
    provider: env
    key: VENDOR_PASSWORD

llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: invoice
    action: browser.run
    with:
      url: https://portal.vendor.com/billing
      browser:
        # Every host the site loads from, including CDNs and sign-in pages.
        allowed_domains: ["*.vendor.com"]
      variables:
        user: ${VENDOR_USER}
        password: ${VENDOR_PASSWORD}
      do:
        - act: Type %user% into the email field
        - act: Type %password% into the password field
        - act: Click the Sign in button
        - expect: {text: Invoices}
        - extract:
            instruction: The most recent invoice
            schema:
              type: object
              properties:
                invoice_number: { type: string }
                total: { type: number }
        - act: Download the most recent invoice PDF

  - id: book
    depends: invoice
    run: ./book.sh "${steps.invoice.outputs.invoice_number}"
```

## Operations

`with.do` lists operations that run in order. Each item sets exactly one operation:

| Operation | Value | Effect |
|-----------|-------|--------|
| `goto` | URL | Navigate the current tab. |
| `act` | Instruction, or `{instruction, ai, cache}` | Perform one action described in natural language: click, type, select, scroll, press a key. |
| `upload` | `{files, into, ai, cache}` | Give local files to a file input. See [Uploads](#uploads). |
| `extract` | `{instruction, schema}` | Extract data from the page. The schema must be a JSON Schema with `type: object`. |
| `expect` | [Condition](#conditions) | Fail the step unless the condition holds. |
| `wait` | `{selector}` or `{duration}` | Wait until a CSS selector is visible, or pause, such as `2s`. |
| `screenshot` | Name | Save a PNG of the page as a run artifact. |
| `ask` | `{prompt, as, timeout}` | Wait for a person's answer. See [Human Input](#human-input). |

Any operation can also set:

| Field | Description |
|-------|-------------|
| `when` | A [condition](#conditions) checked once before the operation. The operation is skipped unless it holds. |
| `timeout` | Maximum time for the operation, such as `30s`. Defaults to `2m`. |

An `act` performs a single action. "Sign in with %user% and %password%" types into one field and stops, so write one act per field and one for the button.

A browser that stops responding fails the step instead of hanging it: an operation is abandoned a few seconds after its `timeout`, and a screenshot or page check after 30 seconds.

An operation can open a window while the page behind it loads, as a search does that shows a "searching" window until its answer arrives. Operations keep working on the page that opened such a window until the window closes, or until it stays open half a second past the load. A window still open then, such as one to fill in and close, is the page later operations work on. A step that fails on a window left open in front of its page, such as a "searching" window over an error, names that page in its error and, unless `browser.screenshots` is `never`, saves it as `NN-failure-opener.png`.

`with.url` is opened before the first operation.

Each run of the step drives a browser of its own. In a `foreach` body, every item gets its own browser. A retry of the step closes the browser its earlier attempt left open.

## Conditions

`expect` and `when` take either kind of condition:

| Form | Example | Checked by |
|------|---------|------------|
| Statement | `expect: The cart shows two items` | The model. Results can vary between runs. |
| `text` | `expect: {text: Order confirmed}` | The page's visible text contains it. |
| `selector` | `when: {selector: "#cookie-banner"}` | A CSS selector matches a visible element. |
| `url` | `expect: {url: /billing}` | The current URL contains it. |

Fixed checks (`text`, `selector`, `url`) make no model call and give the same answer on every run, so prefer them for monitoring. A `selector` check holds when any matching element is visible.

`text` and `selector` checks, and `wait: {selector}`, read the page and the frames it shows from its own origin, nested ones too, so they work on sites built of frames. A selector also matches inside open shadow roots. A hidden frame, or one from another origin, is not read. `wait` passes a selector that hops into frames with `>>`, or an XPath, to the browser runtime as written.

A fixed `when` reads the page once, right after the previous operation. When the page may still be loading, add `within` so the check keeps reading until the condition holds or the window ends:

```yaml
- ask: {prompt: Enter the code, as: otp}
  when: {text: Verification code, within: 10s}
```

A fixed `expect` keeps reading until `within`, or the operation timeout when `within` is not set.

## Model

Browser steps use the DAG-level `llm` block. `with.llm` replaces it entirely for one step:

```yaml
steps:
  - id: prices
    action: browser.extract
    with:
      llm:
        provider: openrouter
        model: deepseek/deepseek-v4-flash
      url: https://shop.example.com
      instruction: All product names and prices
      schema:
        type: object
        properties:
          products: { type: array }
```

A list of models under `model` is tried in order for each request. Every request asks the model for a tool call whose parameters are the expected JSON. A reply without a tool call is accepted when its text is valid JSON. Any other reply gets one correction: the same model is asked again with its reply and the reason it was rejected, and the step log shows the rejected reply after `warning: <provider>/<model> answer rejected: ...`. When the second reply is also unusable, the next listed model is tried. Choose a model that follows tool-call schemas reliably. Small local models often pick the wrong element.

If an `act` fails with "the model (...) answered that no element on the page matches the instruction" while the element is plainly on the page, the model is answering "no element" for every request. The schema allows `null` for "no match", and some models always choose it; `google/gemini-2.5-flash` through OpenRouter does, while newer Gemini Flash models, `gpt-4.1-mini`, and `claude-haiku-4.5` pick the element. Try another model. See [Troubleshooting](#troubleshooting).

## Secrets and Variables

Declare secrets under `secrets:`, put them in `with.variables`, and reference them as `%name%` in `act` instructions. The browser types the value; the model sees only the name.

```yaml
secrets:
  - name: PORTAL_PASSWORD
    provider: env
    key: PORTAL_PASSWORD

llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: login
    action: browser.run
    with:
      url: https://portal.example.com/login
      variables:
        password: ${PORTAL_PASSWORD}
      do:
        - act: Type %password% into the password field
        - act: Click the Sign in button
```

- Do not write `${PORTAL_PASSWORD}` inside an instruction. The step fails before starting a browser when a model-bound text contains the value of a declared secret of four or more characters. Values that only come from `env:` are not treated as secrets.
- A `%name%` must be a `with.variables` key or the `as` of an earlier `ask`; anything else fails validation.
- Declared secrets and `ask` answers of four or more characters are masked in text sent to the model, in the step log, and in the timeline. Plain variables are not masked.

## What Is Sent to the Model

Each model request carries:

- the operation's instruction, the `into` text of an upload, or the statement a model-judged condition checks;
- a list of the page's elements with their roles and visible text;
- the `extract` schema, and for an `act`, the names of the available variables.

Requests never carry:

- the values of `with.variables` or `ask` answers; the model sees `%name%`;
- what the browser typed into fields;
- uploaded files;
- screenshots.

Declared secrets and `ask` answers of four or more characters are replaced with `*******` wherever they appear in a request, including in the page text. Plain variables are not masked, so a value the page displays, such as a signed-in user name, reaches the model unless it comes from a declared secret. Secrets can come from any [secret provider](/writing-workflows/secrets). The model provider's API key only authenticates the request.

## Outputs

The top-level properties each `extract` schema lists become step outputs, readable as `${steps.<id>.outputs.<name>}` and checked when the DAG loads. Fields a schema does not list are dropped. Two extracts in one step cannot list the same property.

A field for the address a link points to needs `format: uri`. The model sees each link as an element id, and only a field with that format gets the link's address in place of the id. Without it the field holds the id, such as `0-11` or `[0-11]`, and the step still succeeds. List the field under `required` too, since some models leave it out otherwise:

```yaml
schema:
  type: object
  properties:
    listings:
      type: array
      items:
        type: object
        properties:
          name: { type: string }
          link: { type: string, format: uri }
        required: [name, link]
```

When the step succeeds with outputs, stdout is one JSON object of them, so `output:` also works. Operation progress is written to the step's stderr log:

```text
[start] goto "https://portal.vendor.com/billing" (completed, 0 tokens, 800ms)
[1/6] act "Type %user% into the email field" → fill xpath=/html[1]/body[1]/form[1]/input[1] %user% (cache-hit, 0 tokens, 300ms, via element)
[4/6] expect "text \"Invoices\"" → the page text contains "Invoices" (completed, 0 tokens, 0s, via exact)
[5/6] extract "The most recent invoice" → {"invoice_number":"INV-8812","total":412.5} (completed, 1204 tokens, 2.1s, via model)
[6/6] download "invoice-8812.pdf" → browser/invoice/downloads/invoice-8812.pdf (completed, 0 tokens, 0s)
```

## Screenshots and Downloads

Browser steps store files as [run artifacts](/writing-workflows/artifacts) under `browser/<step id>/`. A DAG with a browser step enables artifact storage automatically. These files are not masked and can show signed-in pages with personal data; use `browser.screenshots: never` or `artifacts.enabled: false` to keep them out of run history. A step in a `foreach` body saves every item's files there, and each item's timeline names the files that item saved.

| `browser.screenshots` | Automatic screenshots |
|-----------------------|-----------------------|
| `on_failure` (default) | When the step fails. |
| `final` | When the step fails, and at the end of a successful step. |
| `each` | After every operation, plus the `final` ones. |
| `never` | None. `screenshot` operations still save. |

Files the page downloads are saved under `browser/<step id>/downloads/` with the name the site suggests. Only `act` and `goto` start downloads. Once one has run, the step waits for running downloads after every operation, and before it ends or pauses for an `ask` it waits a few seconds for a late download to begin. A download may run for the longest timeout of the acts and gotos run so far; give a large export's act a long `timeout`. A canceled download, or one still running at that timeout, fails the step. Downloaded files appear in the timeline.

With `artifacts.enabled: false`, no screenshots are saved, a `screenshot` operation fails, and the browser refuses downloads.

## Uploads

`upload` gives local files to a file input of the page. An `act` cannot upload a file.

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: invoices
    action: mail.search
    with:
      mailbox: billing@example.com
      subject: Invoice
      has_attachments: true
      save_attachments: true

  - id: file_box
    depends: invoices
    action: browser.run
    with:
      url: https://books.example.com/receipts
      browser:
        profile: books
      do:
        - upload:
            files: ${steps.invoices.outputs.messages}
            into: The receipt drop area
        - expect: {text: Uploaded, within: 1m}
```

| Field | Description |
|-------|-------------|
| `files` | The files to upload. Required. |
| `into` | The file input, or the button or drop area that opens the file picker, in plain words. Leave it out when the page has only one file input. |
| `ai` | How much the model decides for finding `into`: `on_miss` (default), `every_run`, or `never`. See [How Much AI Decides](#how-much-ai-decides). |
| `cache` | Set `false` to find the element with the model on every run, the same as `ai: every_run`. |

`files` is a string or a list. Each entry is:

- a path, relative to the step's working directory, or under `~`;
- a glob pattern, such as `invoices/*.pdf`, whose matches upload in sorted order;
- several paths or patterns, one per line;
- an earlier step's output holding a JSON list of paths, of objects with a `path`, or of `mail.search` emails, whose attachments saved with `save_attachments: true` upload.

Each file is uploaded once, in the order named, and can be up to 50 MB. A file that does not exist, a directory, a pattern that matches nothing, or an attachment that was not saved fails the operation before the page is touched.

How the files reach the page:

- Without `into`, the page's only file input gets them, and no model is asked. File inputs in the frames the page shows from its own origin count too. A page with no file input, or with several, fails the operation and says how many it has.
- With `into`, the model finds the element once. The step records it and later runs replay it without the model while the page shows the same element, as [acts are replayed](#replay-cache).
- When the element is a file input, or holds exactly one, such as a drop area, it gets the files directly.
- Otherwise Dagu clicks the element and gives the files to the file picker the click opens. Dagu intercepts the picker, so no window shows, even with `headless: false`.
- When the click opens no picker within five seconds, the one file input nearest the element gets the files: the first of its ancestors holding any must hold exactly one.

A file input that takes one file fails the operation when given several, before anything is uploaded. Upload such files one operation at a time, or run the step over the files with `foreach`.

The model sees the `into` text and the page, never the files, their names, or their paths. Sites usually send the files in the background after they get them, so follow an upload with an `expect` on what the site shows when it is done.

The step log shows how the files reached the page:

```text
[1/2] upload "The receipt drop area" → invoice-0312.pdf through the file picker xpath=/html[1]/body[1]/main[1]/button[2] opened (completed, 1180 tokens, 2.4s, via model)
```

## Dialogs

The step accepts every JavaScript dialog a page opens, so a dialog never blocks the page: `alert`, `confirm`, and `beforeunload` are accepted, and a `prompt` is answered with its default text. An act that raises "Are you sure?" therefore goes through. Each accepted dialog appears in the step log and the timeline after the operation that opened it:

```text
[2/3] dialog "Delete the row?" → accepted confirm (completed, 0 tokens, 0s)
```

## Replay Cache

An `act` records the actions it performed, and the recordings are kept when the step succeeds. The next run of the same step on the same host replays them without asking the model when the operation's position, its instruction, and the page URL (without query or fragment) match. When a replay fails because the page changed, the step asks the model again, records the new actions, and marks the operation `healed` in the log. A recorded element that is gone, or still on the page but hidden, such as a field in a closed dialog, fails the replay.

- Recordings are kept only when the whole step succeeds. When an operation fails on the page after a replay, the step drops the recordings it replayed, so the next run asks the model again. A failure of the model, the browser, a download, or an `ask`, or a canceled run, leaves them.
- The cache covers `act` and `upload`. `extract` and statement conditions call the model on every run. With fixed conditions, a rerun calls the model only for `extract`.
- A replay clicks the recorded element location. After a layout change it can hit a different element without failing, so follow important acts with an `expect`, preferably a fixed one; when the `expect` fails, the replay is dropped.
- A recording whose actions never use a variable the instruction names, as when the page already showed the value, replays only while that variable holds the value it had when recorded. The recording keeps a salted digest of that value, never the value. With another value the model acts and its actions replace the recording, and the step log warns `not replayed: its recording does nothing with %name%, ...`; under `ai: never` the act fails. Name in an instruction only the variables its actions use.
- To have the model act on every run, or never, set `ai`; see [How Much AI Decides](#how-much-ai-decides).
- `dagu browser session export` writes the recordings of the acts and uploads a session ran for a step before its first run; see [Building a Step in a Browser Session](#building-a-step-in-a-browser-session).
- `dagu browser cache clear <dag>` removes the recordings of every step of a DAG, or of one step with `--step <id>`. The REST API does the same with `DELETE /api/v1/dags/{fileName}/browser-cache`, optionally with `?step=<id>`. Removing all of a DAG's history with `dagu rm --history` also clears them. Each clears only the cache on the host that handles it.

## How Much AI Decides

`with.ai` chooses how much the model decides for the step's `act` operations and its `upload` operations with `into`. `ai` on an `act` or an `upload` replaces it for that operation.

| `ai` | Behavior |
|------|----------|
| `on_miss` (default) | Replay the recording; when a replay fails, the model acts and the recording is repaired. |
| `every_run` | The model acts on every run. A successful operation still records what it did. |
| `never` | Replay only. No model is called. With no recording on the host, or a replay that fails, the step fails and says why. |

A step whose operations never call the model needs no `llm` block. `extract` and statement conditions always ask the model, so `ai: never` on the step refuses them; fixed checks and an `upload` without `into` are allowed. A step without a model fails validation naming the first operation that needs one.

To run a step with no model, such as a demo that must make no model request, record it first under `on_miss`, or export it from a [browser session](#building-a-step-in-a-browser-session), then set `ai: never`:

```yaml
steps:
  - id: sign_in
    action: browser.run
    with:
      url: https://portal.example.com/login
      ai: never
      do:
        - act: Click the Sign in button
        - expect: {text: Dashboard}
```

Under `never`, the actions replayed before a miss have already run on the page. The recording is kept, so a later run under `on_miss` repairs it.

`cache: false`, on the step or an operation, means `every_run`. Set `ai` or `cache`, not both.

Each operation's event in the timeline and the step log records how it ran: `via element` for a replay, `via model` for a model request, and `via exact` for a fixed check.

## Building a Step in a Browser Session

Before writing a step for a page you have not seen, work the page in a browser session with the same operations the step will run, and look at the page after each instead of guessing its fields, buttons, or addresses. A session keeps the browser open between commands; each command runs one operation and reports what it did and what the page shows next.

```bash
dagu browser session open https://portal.example.com/login --provider openai --model gpt-5-mini
# {"id": "ab2cd3ef4g", "outline": "form\n  textbox \"Username\"\n  textbox \"Password\"\n  button \"Sign in\"", ...}

echo '{"act": "Type %user% into the Username field", "variables": {"user": "alice"}}' | dagu browser session do ab2cd3ef4g
echo '{"act": "Type %password% into the Password field", "variables": {"password": {"env": "PORTAL_PASSWORD"}}}' | dagu browser session do ab2cd3ef4g
echo '{"act": "Click the Sign in button"}' | dagu browser session do ab2cd3ef4g
dagu browser session describe ab2cd3ef4g --find Orders --format text
```

When the operations do what the step should, export them:

```bash
dagu browser session export ab2cd3ef4g --dag orders --step fetch --format yaml
```

```yaml
- id: fetch
  action: browser.run
  with:
    url: https://portal.example.com/login
    variables:
      password: ${PORTAL_PASSWORD}
      user: ${user}
    do:
    - act: Type %user% into the Username field
    - act: Type %password% into the Password field
    - act: Click the Sign in button
```

The step holds the operations that succeeded, in the order they ran. Export also writes their act and upload recordings to the step's [replay cache](#replay-cache), so the step's first run on this host replays them without asking the model, and heals as usual when the page changed. Declare `PORTAL_PASSWORD` under the DAG's secrets and give it a parameter `user`.

- `do` reads one operation from stdin, written as an item of `with.do`; `ask` is not available. Variable values go under `variables`, never on the command line: `{"env": NAME}` is read from the environment on every command and masked like a secret, and a plain string serves one command.
- `describe` outlines the page without a model request: headings, fields with their labels (a field labeled only by the cell before it in a table row takes that cell's text, else its `name` or `id` attribute), selects with their options, file inputs, buttons, links with their addresses, and tables and lists, with long runs of alike rows collapsed. Text typed into fields is never shown.
- An element the outline shows with its ID can be used without a model: `{"click": ID}`, `{"type": {"into": ID, "text": TEXT}}`, `{"select": {"in": ID, "option": OPTION}}`, or `{"upload": {"into": ID, "files": PATHS}}`. The session keeps each as the act or upload the step writes, with the element as its recording. An upload's relative paths are under the command's working directory, and the exported step uploads the files the session was given until you point `files` at what each run uploads.
- A session closes its browser when no command arrives for `--idle-timeout` (default `30m`), even with no Dagu server running. Its history can still be exported for a day; `close` removes it at once.
- A session opened with `--profile` holds the profile: a step naming it fails until the session ends. With `--headed`, the window is visible, and a person can sign in or solve a CAPTCHA in it between commands; the browser's DevTools address in the result lets an application show the page itself.
- With a profile, the sign-in operations of the exported step run on every run; guard them with `when` as shown in [Profiles](#profiles).
- `open --write-gate rehearse` blocks the page's writes and reports each under `writes`, so you see what the step would send before anything is saved; see [Write Gate](#write-gate). Export keeps the writes the session's acts and uploads sent or tried to send as [commit points](#commit-points) to approve.

See [`browser session`](/getting-started/cli#browser-session) for every option.

## Trying One Step

While you reword `act` instructions or adjust `expect` conditions, run the browser step on its own instead of the whole workflow:

```bash
dagu start --only checkout workflow.yaml
```

The other steps are recorded as skipped, and the run keeps the workflow's name, so the replay cache and `browser.profile` apply as in a full run. With a profile, a site stays signed in, so the step does not need the sign-in steps before it. When the step reads an earlier step's output, take it from a finished run with `--outputs-from <run-id>`, or take one step's outputs with `--output-from <step>=<run-id>`. See [Running One Step](/writing-workflows/outputs#running-one-step).

## Profiles

`browser.profile` keeps cookies and storage across runs, so a site stays signed in:

```yaml
with:
  browser:
    profile: vendor
  do:
    - act: Type %user% into the email field
      when: {selector: "form#login"}
    - act: Type %password% into the password field
      when: {selector: "form#login"}
    - act: Click the Sign in button
      when: {selector: "form#login"}
```

The sign-in acts run only while the login form is showing. Profiles are stored on the host that runs the step. Runs that use the same profile run one at a time. A run fails immediately when another run is waiting for input with the same profile open, or when a [browser session](#building-a-step-in-a-browser-session) holds it.

## Refused Pages

A browser without a window looks to sites like the same Chrome with one. It sends the user agent its Chrome sends with a window, never `HeadlessChrome`, and reports a screen of 1920x1080, or the viewport's size when that is larger. `headless: false` therefore does not change how a site treats the step, and a check passed in a shown window with a [profile](#profiles) holds for the headless step too, for as long as the site keeps it.

The first time a Chrome executable runs without a window, Dagu starts it once on a temporary profile to learn its user agent, and keeps it under `browser/user-agents/` in the data directory. After Chrome updates, the next launch learns it again. When the user agent cannot be learned or kept, the step runs and warns.

A page counts as refused when its site answers with a bot check in place of it, such as Cloudflare's challenge, or with `403 Forbidden` or `429 Too Many Requests`. After the start URL and after every operation, a refused page adds a line to the step log and the timeline:

```text
[start] page refused shop.example.com answered with a Cloudflare bot check (HTTP 403) in place of the page
```

A refusal usually makes a later operation fail, so a step that fails while the browser shows a refused page ends its error with the same sentence. It keeps the [recordings](#replay-cache) it replayed, since the refusal says nothing about them. [Browser sessions](/getting-started/cli#browser-session-open) report the refusal as `refused`.

When the start URL or an operation lands on a bot check, the step waits up to 10 seconds for the check to pass, as checks that need no person do. A check still showing after that is reported as above. To pass one that needs a person:

1. On the host that runs the step, open a browser session with a window and the step's profile, and pass the check in the window:

   ```bash
   dagu browser session open https://shop.example.com --headed --profile shop
   ```

2. Close the session so the step can use the profile: `dagu browser session close SESSION_ID`.
3. Give the step `browser.profile: shop`.

The site may ask again later. A `403` or `429` without a bot check is not a check to pass: confirm the account may open the page and the site allows the host's network, and for `429`, run less often. If a site keeps refusing, ask its owner to allow the host, or use its API.

## Client Certificates

Some sites require a TLS client certificate. Chrome normally takes it from the operating system, which can ask for the certificate's password every time it is used, so the step cannot run unattended. `browser.client_certificates` gives Dagu the certificate instead:

```yaml
secrets:
  - name: ANTHROPIC_API_KEY
    provider: env
    key: ANTHROPIC_API_KEY
  - name: PORTAL_CERT_PASSPHRASE
    provider: env
    key: PORTAL_CERT_PASSPHRASE

llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: portal
    action: browser.run
    with:
      url: https://portal.example.com
      browser:
        client_certificates:
          - hosts: [portal.example.com, "*.corp.example.com"]
            pfx_file: certs/portal.p12
            passphrase: ${PORTAL_CERT_PASSPHRASE}
      do:
        - expect: {text: Dashboard}
```

Each entry names:

| Field | Description |
|-------|-------------|
| `hosts` | Hosts the certificate is presented to: a host name or IP address, `*.example.com` for the subdomains of `example.com`, or `*` for every host. |
| `pfx_file` | PKCS#12 (`.pfx` or `.p12`) file with the certificate, its private key, and optionally its chain. |
| `passphrase` / `passphrase_file` | The `pfx_file` passphrase. Reference a secret rather than writing it in the DAG. |
| `cert_file`, `key_file` | A PEM certificate (followed by its chain) and its unencrypted private key, instead of `pfx_file`. |
| `ca_file` | Additional PEM server CAs. With the guard enabled, these are trusted for other hosts too. Use [trusted_cas](#trusted-certificate-authorities) to limit trust to specific hosts. |

Relative files resolve against the step's working directory. The first entry whose hosts match a request is used.

To give every browser on a host the same certificate, including [browser sessions](#building-a-step-in-a-browser-session), set it in the [server configuration](/server-admin/reference) with `passphrase_file`; a step's own entries come first:

```yaml
browser:
  client_certificates:
    - hosts: ["*.corp.example.com"]
      pfx_file: /etc/dagu/certs/device.p12
      passphrase_file: /etc/dagu/certs/device.passphrase
```

Dagu uses a local proxy to present client certificates and check server certificates. The proxy follows `browser.proxy` or the operating system's proxy settings.

By default, it also guards other HTTPS sites so that Chrome never prompts for a certificate. The proxy checks each site once with a TLS handshake of its own. A site that uses TLS 1.3, asks for no client certificate, and has a publicly trusted certificate gets Chrome's own connection, so it sees the same TLS handshake as Chrome without Dagu. Every other site goes through the proxy, which presents no certificate. See [`browser.guard_client_certificates`](/server-admin/reference#browser-certificate-trust) to change this behavior.

- The certificates are read before the browser starts. A wrong passphrase or an unreadable file fails the step at once, naming the entry but never the passphrase.
- A page that does not load because of a certificate fails the operation with the reason, such as `portal.example.com rejected the client certificate ...: unknown certificate authority`. The step's log lists each host a certificate was presented to.
- An upstream proxy that asks for credentials cannot carry requests to certificate hosts.
- A Chrome enterprise policy that sets the proxy overrides Dagu's; the error then says so.
- Add private server CAs with [trusted_cas](#trusted-certificate-authorities).

## Trusted Certificate Authorities

For a site that uses a private certificate authority (CA), add its CA certificate to `config.yaml` on the machine that runs the browser:

```yaml
browser:
  trusted_cas:
    - hosts: [portal.example.com]
      ca_file: /etc/dagu/certs/company-ca.pem
```

`ca_file` holds PEM CA certificates, or a site's self-signed certificate, without private keys. It needs no password. Text around the certificates, such as openssl's `subject=` lines, is ignored. Convert DER certificates to PEM before using them.

For `hosts`, use hostnames or IP addresses without a scheme, port, or path:

- `portal.example.com` matches that host only.
- `"*.example.com"` matches subdomains, but not `example.com` itself.
- `"*"` matches every host.

Add any sign-in redirect hosts separately. If several entries match a host, Dagu trusts the CAs from all of them. Localhost, loopback, and link-local website addresses are unsupported.

The setting applies to all Dagu browser steps and sessions on that machine. Restart Dagu services and open a new browser after changing it. Keep old CA files until existing runs finish.

CA trust verifies the site's certificate. Configure [client certificates](#client-certificates) and website login separately when required.

To check the connection:

```bash
dagu browser session open https://portal.example.com/ --idle-timeout 2m
```

Check `url`, `title`, `warnings`, and [`tls_verified`](/getting-started/cli#browser-session-open) in the result. Close the session using its returned `id`:

```bash
dagu browser session close SESSION_ID --force
```

These commands work without a model or scheduler. Configured client certificates may sign in automatically.

## Human Input

`ask` pauses the step until someone answers in the Web UI:

```yaml
do:
  - act: Type %user% into the email field
  - act: Type %password% into the password field
  - act: Click the Sign in button
  - ask:
      prompt: Enter the 6-digit code sent to your phone
      as: otp
      timeout: 15m
    when: {text: Verification code, within: 10s}
  - act: Type %otp% into the code field and submit
    when: {text: Verification code}
```

The step enters **Waiting** with the question in the step's **Agent** tab. The browser stays open. Answering resumes the step in the same browser at the next operation, with the answer available as `%otp%`. If an act needs an answer whose `ask` was skipped, the step fails instead of typing `%otp%`. While other steps of the run are still running, answering is rejected; try again after they finish. Rejecting the question fails the step. The browser stays open for `timeout` (default `1h`). After that, the step can no longer resume: an answer is refused, or fails the step on a distributed worker. **Start clean session** runs the step again from the beginning.

Answers are stored in the run's history, like other human input. Use `ask` for short-lived codes, not long-term secrets.

`ask` is not supported on Windows, where the browser cannot outlive the step process; such a step fails at the start.

## Write Gate

The write gate keeps a step from saving anything on a site until a person has approved what it sends. It decides every request the browser sends, from pages, frames, popups, and workers. A write is any request whose method is not `GET`, `HEAD`, or `OPTIONS`, such as a form post or an API call that saves. `browser.write_gate` sets the mode:

| `write_gate` | Behavior |
|--------------|----------|
| `off` (default) | No gate. |
| `rehearse` | Block every write and report what it would have sent. The step stops at the first blocked write. |
| `record` | Send only the writes of approved [commit points](#commit-points). Any other write is blocked and fails the step. |
| `ask` | As `record`, and wait for a person before each operation that is a commit point. |

`browser.write_gate` in the [Dagu config](/server-admin/reference), or `DAGU_BROWSER_WRITE_GATE`, is the least strict mode every browser on the host runs in, [browser sessions](#building-a-step-in-a-browser-session) included. A step can only ask for a stricter one, in the order `off`, `record`, `ask`, `rehearse`.

The gate refuses the WebSockets and WebTransport sessions of pages, frames, and dedicated workers, since it cannot see what they send. A WebSocket that a service worker or shared worker opens is out of its sight: the step log reports it as `write_gate unseen`.

### Rehearsal

A rehearsal runs the operations until one sends a write, and blocks it:

```yaml
params:
  - AMOUNT: "1000"

llm:
  provider: anthropic
  model: claude-sonnet-5

steps:
  - id: enter_deal
    action: browser.run
    with:
      url: https://books.example.com/deals/new
      browser:
        profile: books
        write_gate: rehearse
      variables:
        amount: ${params.AMOUNT}
      do:
        - act: Type %amount% into the Amount field
        - act: Click the Save button
        - expect: {text: Deal saved}
```

The site never receives the write. The operations after the one that sent it do not run, and the step ends **Partially Succeeded**, so the steps that depend on it still run. The step log shows each write the gate decided and where the rehearsal stopped:

```text
[2/3] write blocked POST https://books.example.com/api/deals (write; POST https://books.example.com/api/deals? {amount})
would send POST https://books.example.com/api/deals; not sent; do[2] did not run
```

The step saves `write-gate.json` under `browser/<step id>/` in the run's artifacts. It holds the mode, where the rehearsal stopped (`stopped_at`, `would_send`, `not_run`), and every write the gate decided, with its method, URL, signature, body field names, and the start of its body. Secrets, and fields named like passwords, tokens, or one-time codes, are hidden. `rehearsable` is `false` once a WebSocket the gate cannot see opened. A screenshot of the page at the stop is saved too, unless `browser.screenshots` is `never`.

Some writes do not stop a rehearsal:

- Sign-ins the [write policy](#write-policy) lists are sent.
- Beacons, CSP reports, writes to the policy's `noise_hosts`, and analytics and error-report endpoints, such as Google Analytics, Microsoft Clarity, New Relic, Sentry, and Cloudflare Web Analytics, are blocked without stopping the step.

### Commit Points

A commit point is an `act`, or an `upload` with `into`, together with the kind of write it sends. A rehearsal keeps the operation it stopped at as a commit point to approve, and so does a write the gate blocks under `record` or `ask`. A write sent by any other operation, such as a `goto`, gets no commit point, so `record` always blocks it. The operation is identified as the [replay cache](#replay-cache) identifies it: by its position, its instruction, and the page URL. The write is identified by its signature: the method, the URL with numbers and ids in its path replaced and only the names of its query parameters, and the names of the body's fields, such as `POST https://books.example.com/api/deals? {amount}`. A page that posts every button to one address is told apart by the field that names the button, such as ASP.NET's `__EVENTTARGET` or GraphQL's `operationName`. Other values never count, so one approval covers every amount.

Commit points are kept on the host that ran the step, apart from the replay cache, so `dagu browser cache clear` leaves them. Manage them with `dagu browser writes`:

```bash
dagu browser writes list books
dagu browser writes approve books --step enter_deal
dagu browser writes approve books --from-dag books-trial
dagu browser writes revoke books --step enter_deal
```

`approve` and `revoke` take `--signature` to change only some writes. `--from-dag` copies the commit points of another DAG's steps into the steps of the same name and approves them, for a copy of the DAG that rehearsed it.

To put a step behind the gate:

1. Run it with `write_gate: rehearse`, or run a copy of the DAG that sets it.
2. Check what it would send in the step log or `write-gate.json`.
3. Approve the commit point: `dagu browser writes approve books --step enter_deal`.
4. Set `write_gate: record`, or `ask`.

### Record

Under `record`, an operation sends only the writes its approved commit points name. An approved commit act replays the actions it recorded when it was kept, without asking the model, whatever the values of its variables; when they no longer fit the page, the step fails. Any other write is blocked: nothing is saved, the step fails with `write_blocked`, and the operation is kept as a commit point. Approve it and run the step again, so a step with several saves is approved one write at a time.

### Ask

Under `ask`, writes are decided as under `record`. Before each operation that is a commit point, the step also enters **Waiting** with a question in the step's **Agent** tab, such as `do[1] "Click the Save button" is about to send POST https://books.example.com/api/deals`. A screenshot and an outline of the page with its fields filled in show what is about to be sent.

| Answer | Effect |
|--------|--------|
| **Allow once** | The operation runs and sends its writes. |
| **Allow for this Dagu session** | The same, and the commit point is approved, so the step sends it under `record` without asking. |
| **Reject** | The step fails. |
| `skip` | The operation and those after it do not run, and nothing is sent. The step ends **Skipped**, as do the steps that depend on it. Only the REST API offers it: `POST /api/v1/dag-runs/{name}/{dagRunId}/steps/{stepName}/agent-interactions/{interactionId}/respond` with `{"decision": "skip"}`. |

The browser stays open for the answer for up to four hours. `write_gate: ask` is not supported on Windows.

### Write Policy

`browser.write_policy` in the Dagu config, or `DAGU_BROWSER_WRITE_POLICY`, names a YAML or JSON file that tells the gate which requests to treat apart:

```yaml
sign_in:
  - host: login.example.com
    path: /session
    secret: PORTAL_PASSWORD
writes:
  - host: books.example.com
    path: /deals/delete*
noise_hosts:
  - "*.hotjar.com"
```

| Key | Description |
|-----|-------------|
| `sign_in` | Sign-in endpoints whose writes are sent in every mode. With `secret`, a request is sent only when its body carries that secret's value: a secret the step declares, or an environment variable of the Dagu process. A rule whose secret has no value for the step is left out. |
| `writes` | Requests that save although their method only reads, such as a delete link. They count as writes whatever their method. |
| `noise_hosts` | Hosts whose writes are blocked without counting as the work's writes. |

`host` is a host name, `*.example.com` for its subdomains, or `*`. `path` is an exact path, or one ending in `*` to match every path it starts; without `path`, a rule matches every path on the host. Only `sign_in` rules take `secret`. A browser session reads its policy from `dagu browser session open --write-policy` instead.

## Safety

- Page content is untrusted and is sent to the model. A hostile page, or content other users posted on an allowed site, can try to steer an `act`, for example into typing `%password%` into the wrong field. Use variables only on pages you trust, keep instructions specific, and follow sensitive acts with an `expect`.
- The browser runtime applies `browser.allowed_domains` to the page's HTTP(S) requests, including scripts, images, and API calls, so list the CDN and sign-in hosts a site loads from. WebSocket connections are not covered, and the runtime's check has a known bypass. `example.com` matches only that host; `*.example.com` matches its subdomains but not `example.com`. An entry is a host name with at least two labels, without a scheme, port, or path, and `*` may appear only as a leading `*.`.
- Blocked requests are logged after the operation that made them, such as `allowed_domains blocked 3 requests: cdn.example.net (3)`, and a failed step's error lists them. A page that breaks for no clear reason often needs a host added.
- Dagu itself checks only the page URL: it rejects a `goto` or `url` outside the list, and after every operation fails the step if a redirect or a click left the allowed domains.
- Dialogs are accepted automatically, so an act that clicks the wrong button also confirms it. Keep instructions for destructive actions specific and check the result with an `expect`.
- To keep a step from saving anything a person has not approved, put it behind the [write gate](#write-gate).
- The browser runs with the permissions of the Dagu process.

## Limiting Open Browsers

Each browser runs its own Chrome processes. `browser.max_open` in the [Dagu config](/server-admin/reference), or `DAGU_BROWSER_MAX_OPEN`, bounds how many are open at once on the host. It counts the browsers of running steps, of steps waiting for an answer, and of browser sessions, from every DAG run. A browser past the limit waits for one to close, within the step's timeout, and the timeline shows `Waiting for another browser to close`. A browser counts until its process exits. `0`, the default, sets no limit. A DAG cannot change it.

## Distributed Mode

Browser steps run on the worker that picks them up, which needs Chrome. Profiles, the replay cache, and [commit points](#commit-points) are stored on that worker, so pin DAGs that rely on them with a DAG-level `worker_selector` and [worker labels](/server-admin/distributed/worker-labels). An answered `ask` resumes on the worker that holds the browser.

## Web UI

The step's **Agent** tab shows each operation with its status, token use, screenshot thumbnails, downloads, accepted dialogs, and the writes the [write gate](#write-gate) decided, and holds pending questions.

## Options

`browser.run` takes:

| Field | Description |
|-------|-------------|
| `do` | Operations to run in order. Required. |
| `url` | Page opened before the first operation. |
| `variables` | Values referenced as `%name%` in `act` instructions. |
| `ai` | `on_miss` (default), `every_run`, or `never`. See [How Much AI Decides](#how-much-ai-decides). |
| `cache` | Set `false` to have the model act on every run, the same as `ai: every_run`. See [Replay Cache](#replay-cache). |
| `browser` | [Browser options](#browser-options). |
| `llm` | Model configuration that replaces the DAG-level `llm` block. |

`browser.extract` takes `url`, `instruction`, and `schema`, with optional `timeout`, `browser`, `variables`, and `llm`, and behaves as `browser.run` with one `extract` operation.

### Browser Options

| Field | Description |
|-------|-------------|
| `browser.headless` | Run without a window. Defaults to `true`. Sites see the same user agent and screen as with a window; see [Refused Pages](#refused-pages). |
| `browser.executable` | Chrome or Chromium binary. |
| `browser.viewport` | `{width, height}` in pixels. |
| `browser.proxy` | Proxy server URL. Authenticated proxies are not supported. |
| `browser.allowed_domains` | Hosts the page's HTTP(S) requests may reach. |
| `browser.screenshots` | `on_failure`, `final`, `each`, or `never`. |
| `browser.profile` | Persistent profile name. |
| `browser.client_certificates` | TLS client certificates and the hosts they are presented to. See [Client Certificates](#client-certificates). |
| `browser.write_gate` | `off` (default), `record`, `ask`, or `rehearse`. See [Write Gate](#write-gate). |

Set `trusted_cas` and `guard_client_certificates` in the host's [config.yaml](/server-admin/reference#browser-certificate-trust). `max_open`, `write_policy`, and the host's `write_gate` are set there too; see [Limiting Open Browsers](#limiting-open-browsers) and [Write Gate](#write-gate).

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `the model (...) answered that no element on the page matches the instruction` | The element is not on the page, or the model answers "no match" for every request. | Look at the failure screenshot. If the element is there, [try another model](#model); otherwise reword the instruction or open the right page first. |
| `act did not complete: ...` | The browser runtime could not perform the action. The message gives its reason. | Look at the failure screenshot; make the instruction more specific, or add a `wait` for the page to settle. |
| `act did not complete: the select ... offers no option "..."; it offers ...` | The act picked an option the select does not offer. The error shows the option as compared, with the act's variables filled in, and up to 15 options the select offers. | Fix the instruction, or the variable's value, to name an offered option. |
| `... the page read is a window that the page "..." opened and that is still open in front of it` | The site left a window open in front of the page, such as a "searching" window over an error. | Look at `NN-failure-opener.png` for what the page says. See [Operations](#operations). |
| `expectation not met: ...` | An `expect` condition did not hold. | Look at the failure screenshot; fix the act before it, or add `within` when the page needs time to change. |
| A field holds `0-11` or `[0-11]` instead of an address | The field has no `format: uri`, so it gets the link's element id. | Add `format: uri` to the field and list it under `required`. See [Outputs](#outputs). |
| `selector "..." did not appear within ...` | A `wait` selector did not become visible. | Check the selector, or raise the operation's `timeout`. |
| `browser actions need a model for do[N] ...` | No `llm` block applies to the step, and the operation it names needs the model. | Add a DAG-level `llm` block or `with.llm`, or set `ai: never` when every operation can replay. |
| `the act cannot run without AI: ...` | Under `ai: never`, the act has no recording on this host, its replay failed, or its recording does not fit a variable's value. | Run the step under `on_miss` to record or repair it, then switch back to `never`. |
| `Chrome installation not found; set CHROME_PATH` | No Chrome or Chromium on the host that runs the step. | Install Chrome, set `CHROME_PATH` or `browser.executable`, or use the `dev` image. |
| `the browser sandbox is on, but the browser runtime turns it off because CI is set` (or `when running as root`) | The browser would run without its sandbox. | Run Dagu as a non-root user without `CI`, or set `DAGU_BROWSER_SANDBOX=false`. |
| `Chrome exited before its debugging port was ready` | On Linux, usually a sandbox that cannot start, as under Docker's default seccomp profile. | Run the `dev` image with its [Compose setup](/server-admin/deployment/docker-images), or set `DAGU_BROWSER_SANDBOX=false`. |
| `... is outside browser.allowed_domains` or `the page navigated away` | A `goto`, redirect, or click left the allowed hosts. | Add the host, including sign-in and CDN hosts, or fix the instruction. |
| `contains the value of secret ...` | A declared secret is written in an instruction. | Pass it in `with.variables` and reference it as `%name%`. |
| `act references %name%, which is not in with.variables or an earlier ask` | A misspelled or missing variable. | Add it to `with.variables` or fix the name. |
| `the instruction uses %name%, but the ask that sets it did not run` | The `ask` was skipped because its `when` did not hold. | Give the act the same `when` as the `ask`. |
| `download of ... did not finish within ...` | The download ran longer than the longest `act` or `goto` timeout. | Raise the `timeout` of the act that starts it. |
| `the browser did not respond within ...` | The page stopped responding. | Check the page; raise `timeout` for slow pages. |
| `... answered with a Cloudflare bot check (HTTP 403) in place of the page` | The site showed a bot check that did not pass on its own within 10 seconds. | Pass it once in a browser session with a window and the step's profile. See [Refused Pages](#refused-pages). |
| `... refused the page (HTTP 403 Forbidden)` or `(HTTP 429 Too Many Requests)` | The account may not open the page, the site blocks the host's network, or the site wants fewer requests. | Check the account's access, ask the site's owner to allow the host, or run less often. See [Refused Pages](#refused-pages). |
| `browser profile "..." is held by DAG run ..., which is waiting for input` | Another run holds the profile while it waits for an answer. | Answer or cancel that run. |
| `... asks for a TLS client certificate, and none is configured for it (ERR_...)` | The site requires a client certificate and no entry names its host. | Add it to `browser.client_certificates`. See [Client Certificates](#client-certificates). |
| `... rejected the client certificate ...` | The site refused the certificate presented. | Check that the certificate is the one the site expects and has not expired or been revoked. |
| `... presented a server certificate that is not trusted ...` | The proxy could not verify the site's server certificate. | Add the site's CA with [trusted_cas](#trusted-certificate-authorities). |
| `with.browser.client_certificates[0]: ... passphrase` | The certificate file could not be read with its passphrase. | Check the passphrase secret and the file. |
| `ask operations are not supported on Windows` or `write_gate ask is not supported on Windows` | The browser cannot outlive the step process on Windows. | Run the step on Linux or macOS. |
| `write_blocked: the write gate blocked ..., which no approved commit point of this operation sends` | Under `record` or `ask`, the operation sent a write no approved commit point names. Nothing was saved. | Check the write in the step log or `write-gate.json`. If the step should send it, approve it with `dagu browser writes approve`. See [Commit Points](#commit-points). |
| `the page has N file inputs; with into, say which one to use` | An `upload` without `into` found several file inputs. | Name the one to use with `into`. |
| `clicking the element opened no file picker, and no single file input is near it` | The `into` element is not a file input, opens no picker, and has no file input of its own nearby. | Name the file input itself, or the button that opens the picker. Open a menu or dialog with an `act` first when the picker sits behind one. |
| `the file input takes one file, and the upload gives N` | The input or picker accepts one file. | Upload the files in separate operations, or run the step over them with `foreach`. |
| `files lists "..." without a path` | A listed attachment was not saved. | Set `save_attachments: true` on the `mail.search` step. |

## Not Supported Yet

- Attaching to an already running browser.
- Hosted browsers, CAPTCHA solving, and stealth fingerprints.
- Screenshot-based extraction.
- `ask` and `write_gate: ask` on Windows.

## Related

- [LLM Providers](/step-types/llm/providers)
- [Artifacts](/writing-workflows/artifacts)
- [Human Tasks](/writing-workflows/human-tasks)
