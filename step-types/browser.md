# Browser

Automate websites that have no API. A browser step drives a local Chrome with natural-language instructions, extracts structured data into step outputs, checks page state, and can pause for a person, for example to enter a one-time code, then continue in the same browser.

Browser steps are powered by the [Stagehand](https://github.com/browserbase/stagehand) Go SDK. Every model request goes through Dagu's own [LLM providers](/step-types/llm/providers), so the step uses the same `llm` configuration as `chat.completion`, and API keys never enter the browser.

## Requirements

- A Dagu version newer than v2.17.0.
- Google Chrome or Chromium installed on the host that runs the step. Dagu uses `browser.executable`, then `CHROME_PATH`, then a standard install location. Of the container images, only [`dev`](/server-admin/deployment/docker-images) includes Chromium, on amd64 and arm64.
- In a container, Chrome's sandbox needs a seccomp profile that allows user namespaces. Run the `dev` image with its [Compose setup](/server-admin/deployment/docker-images), which applies the bundled profile. Where the sandbox cannot start at all, `browser.sandbox: false` in the [Dagu config](/server-admin/reference) or `DAGU_BROWSER_SANDBOX=false` turns it off for every browser on the host. Without the sandbox, a page that exploits the browser runs with the permissions of the Dagu process, which in the Dagu images has `sudo`, so use it only for sites you trust. A DAG cannot change this setting. With the sandbox on, a browser step fails when `CI` is set or Dagu runs as root on Linux, because the browser would run without the sandbox there; set `DAGU_BROWSER_SANDBOX=false` to allow it.
- A model configured with a DAG-level `llm` block or `with.llm`. Use a model that follows tool-call schemas reliably.

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
| `act` | Instruction, or `{instruction, cache}` | Perform one action described in natural language: click, type, select, scroll, press a key. |
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

`with.url` is opened before the first operation.

## Conditions

`expect` and `when` take either kind of condition:

| Form | Example | Checked by |
|------|---------|------------|
| Statement | `expect: The cart shows two items` | The model. Results can vary between runs. |
| `text` | `expect: {text: Order confirmed}` | The page's visible text contains it. |
| `selector` | `when: {selector: "#cookie-banner"}` | A CSS selector matches a visible element. |
| `url` | `expect: {url: /billing}` | The current URL contains it. |

Fixed checks (`text`, `selector`, `url`) make no model call and give the same answer on every run, so prefer them for monitoring. A `selector` check holds when any matching element is visible.

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

A list of models under `model` is tried in order for each request. Every request asks the model for a tool call whose parameters are the expected JSON. A provider or model without tool calling works only if it replies with plain JSON text, so choose a model that follows tool-call schemas reliably. Small local models often pick the wrong element.

If an `act` fails with "the model (...) answered that no element on the page matches the instruction" while the element is plainly on the page, the model is answering "no element" for every request. The schema allows `null` for "no match", and some models always choose it; `google/gemini-2.5-flash` through OpenRouter does, while newer Gemini Flash models, `gpt-4.1-mini`, and `claude-haiku-4.5` pick the element. Try another model. See [Troubleshooting](#troubleshooting).

## Secrets and Variables

Declare secrets under `secrets:`, put them in `with.variables`, and reference them as `%name%` in `act` instructions. The browser types the value; the model sees only the name.

```yaml
secrets:
  - name: PORTAL_PASSWORD
    provider: env
    key: PORTAL_PASSWORD

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

- the operation's instruction, or the statement a model-judged condition checks;
- a list of the page's elements with their roles and visible text;
- the `extract` schema, and for an `act`, the names of the available variables.

Requests never carry:

- the values of `with.variables` or `ask` answers; the model sees `%name%`;
- what the browser typed into fields;
- screenshots.

Declared secrets and `ask` answers of four or more characters are replaced with `*******` wherever they appear in a request, including in the page text. Plain variables are not masked, so a value the page displays, such as a signed-in user name, reaches the model unless it comes from a declared secret. Secrets can come from any [secret provider](/writing-workflows/secrets). The model provider's API key only authenticates the request.

## Outputs

The top-level properties each `extract` schema lists become step outputs, readable as `${steps.<id>.outputs.<name>}` and checked when the DAG loads. Fields a schema does not list are dropped. Two extracts in one step cannot list the same property.

When the step succeeds with outputs, stdout is one JSON object of them, so `output:` also works. Operation progress is written to the step's stderr log:

```text
[start] goto "https://portal.vendor.com/billing" (completed, 0 tokens, 800ms)
[1/6] act "Type %user% into the email field" → fill xpath=/html[1]/body[1]/form[1]/input[1] %user% (cache-hit, 0 tokens, 300ms)
[4/6] expect "text \"Invoices\"" → the page text contains "Invoices" (completed, 0 tokens, 0s)
[5/6] extract "The most recent invoice" → {"invoice_number":"INV-8812","total":412.5} (completed, 1204 tokens, 2.1s)
[6/6] download "invoice-8812.pdf" → browser/invoice/downloads/invoice-8812.pdf (completed, 0 tokens, 0s)
```

## Screenshots and Downloads

Browser steps store files as [run artifacts](/writing-workflows/artifacts) under `browser/<step id>/`. A DAG with a browser step enables artifact storage automatically. These files are not masked and can show signed-in pages with personal data; use `screenshots: never` or `artifacts.enabled: false` to keep them out of run history.

| `browser.screenshots` | Automatic screenshots |
|-----------------------|-----------------------|
| `on_failure` (default) | When the step fails. |
| `final` | When the step fails, and at the end of a successful step. |
| `each` | After every operation, plus the `final` ones. |
| `never` | None. `screenshot` operations still save. |

Files the page downloads are saved under `browser/<step id>/downloads/` with the name the site suggests. Only `act` and `goto` start downloads. Once one has run, the step waits for running downloads after every operation, and before it ends or pauses for an `ask` it waits a few seconds for a late download to begin. A download may run for the longest timeout of the acts and gotos run so far; give a large export's act a long `timeout`. A canceled download, or one still running at that timeout, fails the step. Downloaded files appear in the timeline.

With `artifacts.enabled: false`, no screenshots are saved, a `screenshot` operation fails, and the browser refuses downloads.

## Dialogs

The step accepts every JavaScript dialog a page opens, so a dialog never blocks the page: `alert`, `confirm`, and `beforeunload` are accepted, and a `prompt` is answered with its default text. An act that raises "Are you sure?" therefore goes through. Each accepted dialog appears in the step log and the timeline after the operation that opened it:

```text
[2/3] dialog "Delete the row?" → accepted confirm (completed, 0 tokens, 0s)
```

## Replay Cache

A successful `act` records the actions it performed. The next run of the same step on the same host replays them without asking the model when the operation's position, its instruction, and the page URL (without query or fragment) match. When a replay fails because the page changed, the step asks the model again, records the new actions, and marks the operation `healed` in the log.

- The cache covers `act` only. `extract` and statement conditions call the model on every run. With fixed conditions, a rerun calls the model only for `extract`.
- A replay clicks the recorded element location. After a layout change it can hit a different element without failing, so follow important acts with an `expect`, preferably a fixed one.
- Disable the cache with `with.cache: false`, or for one operation with `act: {instruction: ..., cache: false}`.

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

The sign-in acts run only while the login form is showing. Profiles are stored on the host that runs the step. Runs that use the same profile run one at a time. A run fails immediately when another run is waiting for input with the same profile open.

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

The step enters **Waiting** with the question in the step's **Agent** tab. The browser stays open. Answering resumes the step in the same browser at the next operation, with the answer available as `%otp%`. If an act needs an answer whose `ask` was skipped, the step fails instead of typing `%otp%`. Rejecting the question fails the step. The browser stays open for `timeout` (default `1h`); after that, the answer fails the step and **Start clean session** runs the step again from the beginning.

Answers are stored in the run's history, like other human input. Use `ask` for short-lived codes, not long-term secrets.

`ask` is not supported on Windows, where the browser cannot outlive the step process; such a step fails at the start.

## Safety

- Page content is untrusted and is sent to the model. A hostile page, or content other users posted on an allowed site, can try to steer an `act`, for example into typing `%password%` into the wrong field. Use variables only on pages you trust, keep instructions specific, and follow sensitive acts with an `expect`.
- The browser runtime applies `browser.allowed_domains` to the page's HTTP(S) requests, including scripts, images, and API calls, so list the CDN and sign-in hosts a site loads from. WebSocket connections are not covered, and the runtime's check has a known bypass. `example.com` matches only that host; `*.example.com` matches its subdomains but not `example.com`.
- Dagu itself checks only the page URL: it rejects a `goto` or `url` outside the list, and after every operation fails the step if a redirect or a click left the allowed domains.
- Dialogs are accepted automatically, so an act that clicks the wrong button also confirms it. Keep instructions for destructive actions specific and check the result with an `expect`.
- The browser runs with the permissions of the Dagu process.

## Distributed Mode

Browser steps run on the worker that picks them up, which needs Chrome. Profiles and the replay cache are stored on that worker, so pin steps that rely on them with `worker_selector`. An answered `ask` resumes on the worker that holds the browser.

## Web UI

The step's **Agent** tab shows each operation with its status, token use, screenshot thumbnails, downloads, and accepted dialogs, and holds pending questions.

## Browser Options

| Field | Description |
|-------|-------------|
| `browser.headless` | Run without a window. Defaults to `true`. |
| `browser.executable` | Chrome or Chromium binary. |
| `browser.viewport` | `{width, height}` in pixels. |
| `browser.proxy` | Proxy server URL. Authenticated proxies are not supported. |
| `browser.allowed_domains` | Hosts the page's HTTP(S) requests may reach. |
| `browser.screenshots` | `on_failure`, `final`, `each`, or `never`. |
| `browser.profile` | Persistent profile name. |

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `the model (...) answered that no element on the page matches the instruction` | The element is not on the page, or the model answers "no match" for every request. | Look at the failure screenshot. If the element is there, [try another model](#model); otherwise reword the instruction or open the right page first. |
| `Chrome installation not found; set CHROME_PATH` | No Chrome or Chromium on the host that runs the step. | Install Chrome, set `CHROME_PATH` or `browser.executable`, or use the `dev` image. |
| `the browser sandbox is on, but the browser runtime turns it off because CI is set` (or `when running as root`) | The browser would run without its sandbox. | Run Dagu as a non-root user without `CI`, or set `DAGU_BROWSER_SANDBOX=false`. |
| `Chrome exited before its debugging port was ready` | On Linux, usually a sandbox that cannot start, as under Docker's default seccomp profile. | Run the `dev` image with its [Compose setup](/server-admin/deployment/docker-images), or set `DAGU_BROWSER_SANDBOX=false`. |
| `... is outside browser.allowed_domains` or `the page navigated away` | A `goto`, redirect, or click left the allowed hosts. | Add the host, including sign-in and CDN hosts, or fix the instruction. |
| `contains the value of secret ...` | A declared secret is written in an instruction. | Pass it in `with.variables` and reference it as `%name%`. |
| `act references %name%, which is not in with.variables or an earlier ask` | A misspelled or missing variable. | Add it to `with.variables` or fix the name. |
| `download of ... did not finish within ...` | The download ran longer than the longest `act` or `goto` timeout. | Raise the `timeout` of the act that starts it. |
| `the browser did not respond within ...` | The page stopped responding. | Check the page; raise `timeout` for slow pages. |
| `browser profile "..." is held by DAG run ..., which is waiting for input` | Another run holds the profile while it waits for an answer. | Answer or cancel that run. |
| `ask operations are not supported on Windows` | The browser cannot outlive the step process on Windows. | Run the step on Linux or macOS. |

## Not Supported Yet

- Attaching to an already running browser.
- Hosted browsers, CAPTCHA solving, and stealth fingerprints.
- Screenshot-based extraction.
- `ask` on Windows.

## Related

- [LLM Providers](/step-types/llm/providers)
- [Artifacts](/writing-workflows/artifacts)
- [Human Tasks](/writing-workflows/human-tasks)
