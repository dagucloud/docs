# JavaScript

Run a JavaScript function body in an embedded sandbox. No Node.js or other interpreter is needed on the host or on workers.

## Basic Usage

```yaml
steps:
  - id: fetch
    action: http.request
    with:
      method: GET
      url: https://example.com
    output: HTML

  - id: links
    depends: [fetch]
    action: js.run
    with:
      input: ${HTML}
      script: |
        const urls = new Set();
        for (const m of input.matchAll(/href="([^"]+)"/g)) {
          urls.add(new URL(m[1], "https://example.com").href);
        }
        return [...urls];
    output: LINKS
```

Output of `links`:

```json
[
  "https://example.com/a",
  "https://example.com/b"
]
```

## Configuration

| Field | Description |
|-------|-------------|
| `script` | JavaScript function body. Required. `return` a value to publish it. |
| `input` | Any YAML value bound to `input`. Mutually exclusive with `input_file`. |
| `input_file` | Path of a file whose contents are bound to `input`. Mutually exclusive with `input`. |
| `format` | How string input is interpreted: `text` (default) binds it as-is, `json` parses it first. Applies to `input_file` contents and to a string `input`. |
| `timeout` | Maximum script run time, such as `30s` or `2m`. Default: `60s`. |

## How It Works

The script is the body of a function that receives one parameter, `input`. The text is used as written: Dagu does not resolve `${...}` references inside it, so JavaScript template literals keep their meaning. Workflow values reach the script through `input`.

```yaml
steps:
  - id: greet
    action: js.run
    with:
      input:
        name: ${params.NAME}
        count: 3
      script: |
        return `Hello ${input.name}, ${input.count} times`;
```

Objects and lists in `input` arrive as native JavaScript objects and arrays. When neither `input` nor `input_file` is set, `input` is `undefined`.

## Input From Earlier Steps

A captured `output:` is a string. Set `format: json` to parse it before it reaches the script:

```yaml
steps:
  - id: produce
    action: js.run
    with:
      script: |
        return {items: ["a", "b"], count: 2};
    output: DATA

  - id: consume
    depends: [produce]
    action: js.run
    with:
      input: ${DATA}
      format: json
      script: |
        return input.items.map((item) => item + input.count);
```

Use `input_file` for larger payloads, such as the stdout log of an earlier step:

```yaml
steps:
  - id: dump
    run: cat report.json

  - id: summarize
    depends: [dump]
    action: js.run
    with:
      input_file: ${dump.stdout}
      format: json
      script: |
        return Object.keys(input).length;
```

## Output

The returned value is written to stdout, so `output:` captures it.

| Returned value | Written |
|----------------|---------|
| `undefined` or no `return` | Nothing |
| String | The string as-is, followed by a newline |
| Any other value | JSON with two-space indentation, followed by a newline |

JSON output follows JavaScript rules: `toJSON` is honored, `Date` becomes an ISO string, and function or `undefined` properties are dropped.

`console.log`, `console.info`, `console.warn`, `console.error`, and `console.debug` write to the step's stderr, which keeps stdout clean for the returned value.

## Sandbox

Available:

- ECMAScript builtins: `JSON`, `RegExp`, `Math`, `Date`, `Map`, `Set`, `Promise`, string and array methods, `encodeURIComponent`, and the rest of the standard library
- `URL` and `URLSearchParams`
- `console`

Not available:

- `require`, `import`, or npm packages
- `fetch`, the filesystem, `process`, or environment variables
- `setTimeout` and other timers, and `async` / `await`

Scripts are compiled per run, so there is no shared state between steps.

## Limits and Errors

- A script that runs longer than `timeout` fails the step with `js: timeout after 60s`. The step-level `timeout` and `dagu stop` also interrupt the script.
- A thrown error fails the step. The error names the exception and the script line, such as `js: TypeError: Cannot read property 'x' of null (script line 3)`, and the full stack trace is written to stderr.
- A script that returns `undefined`, usually because `return` is missing, succeeds with empty stdout and a notice on stderr.
- Memory is not capped. A script that allocates without bound can exhaust the process.
- The interrupt takes effect between JavaScript instructions, so a single long-running builtin call such as a catastrophic regular expression cannot be stopped early.
- `dagu validate` rejects a missing `script`, the combination of `input` and `input_file`, and a script that does not compile, naming the line of the syntax error. The editor reports the same errors on save.

## Examples

### Reshape an API Response

```yaml
steps:
  - id: fetch
    action: http.request
    with:
      method: GET
      url: https://api.example.com/users
    output: USERS

  - id: active_emails
    depends: [fetch]
    action: js.run
    with:
      input: ${USERS}
      format: json
      script: |
        return input
          .filter((user) => user.active)
          .map((user) => user.email.toLowerCase())
          .sort();
    output: EMAILS
```

### Compute a Date Range

```yaml
steps:
  - id: range
    action: js.run
    with:
      input:
        days: 7
      script: |
        const end = new Date();
        const start = new Date(end.getTime() - input.days * 86400000);
        return {
          start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10),
        };
    output: RANGE

  - id: report
    depends: [range]
    run: ./report --from ${range.output.start} --to ${range.output.end}
```

### Normalize Links Before a Loop

```yaml
steps:
  - id: links
    action: js.run
    with:
      input_file: page.html
      script: |
        const base = "https://example.com";
        const urls = new Set();
        for (const m of input.matchAll(/href="([^"#]+)"/g)) {
          const url = new URL(m[1], base);
          if (url.hostname === "example.com") urls.add(url.href);
        }
        return [...urls];
    output: LINKS

  - id: crawl
    depends: [links]
    foreach:
      items: ${LINKS}
      as: url
      steps:
        - id: fetch
          run: curl -s ${foreach.url} -o /dev/null
```

## Need Real Node.js?

Use the `node-script@v1` action when a script needs npm packages, network access, or the Node.js standard library. It runs on the host's Node.js installation.
