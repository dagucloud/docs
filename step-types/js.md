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
| `format` | How string input is interpreted. `auto` (default) parses a JSON object or array and binds any other string as-is. `text` always binds the string as-is. `json` always parses and fails on invalid JSON. Applies to `input_file` contents and to a string `input`. |
| `timeout` | Maximum script run time, as seconds (`30`) or a duration (`2m`). Defaults to the step `timeout`, or `60s` when the step has none. |

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

A captured `output:` is a string. When it holds a JSON object or array, the default `format: auto` parses it, so one step's returned object is the next step's `input`:

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
      script: |
        return input.items.map((item) => item + input.count);
```

Set `format: text` when the script should see the raw string, and `format: json` when invalid JSON should fail the step instead of arriving as a string. Only the top-level string is parsed: nested string fields inside an `input` object stay strings.

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
- `await`, for promises that resolve without an event loop. The script body is an async function, so `await Promise.all([...])` and async helper functions work. A promise that is still pending when the body returns fails the step, because nothing can resolve it.

Not available:

- `require`, `import`, or npm packages
- `fetch`, the filesystem, `process`, or environment variables
- `setTimeout` and other timers

Scripts are compiled per run, so there is no shared state between steps.

## Limits and Errors

- A script that runs longer than `timeout` fails the step with `js: timeout after 60s; raise with.timeout to allow longer scripts`. When the step has its own `timeout` and `with.timeout` is unset, the step timeout governs. `dagu stop` also interrupts the script.
- A thrown error or rejected promise fails the step. The error names the exception and the script line, such as `js: TypeError: Cannot read property 'x' of null (script line 3)`, and the full stack trace is written to stderr. Lines and columns match the script text.
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
