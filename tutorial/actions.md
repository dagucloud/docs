# Built-in Actions

<p class="tutorial-meta">Lesson 4 of 10 · 5 minutes</p>

`run` runs a shell command. For common jobs such as calling an API, transforming data, rendering a file, querying a database, or starting a container, a step can use a built-in **action** instead, with no scripts or extra tools to install.

This lesson chains three actions: fetch a list of todos, summarize it in JavaScript, and render a report.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-04-actions.yaml
```

<<< @/public/tutorial/dags/tutorial-04-actions.yaml

- `action` picks the built-in action. `with` holds its settings.
- `http.request` calls a URL and prints the response body. `output` publishes it as `todos`.
- `js.run` runs JavaScript in a sandbox built into Dagu, so Node.js does not need to be installed. `input` becomes the script's `input` variable, with JSON already parsed, and the value the script returns is the step's output. With `decode: json`, each `select` picks one field of it.
- `template.render` fills a template with `data`. `stdout: {artifact: report.md}` saves what the step prints as a file attached to the run.

This lesson calls `jsonplaceholder.typicode.com`, a free test API, so it needs internet access.

## Watch it run

<RunReplay run="tutorial-04-actions" />

Select `summarize` to see the object the script returned and the two fields picked out of it.

## Run it yourself

```bash
dagu start tutorial-04-actions.yaml
```

In the Web UI, open the run, then **Activity** → **Artifacts** to read `report.md`.

## When to use `js.run`

Use `js.run` to filter, reshape, or compute values between steps, instead of `python -c`, `jq`, or `awk` in a `run` step. Dagu checks the script for syntax errors when it validates the workflow, before anything runs.

The sandbox has no network, files, environment variables, or npm packages. Keep that work in `run` steps or other actions, and pass the results in through `input`.

## Find more actions

| Action | Use it to |
| --- | --- |
| `http.request` | Call an HTTP API |
| `js.run` | Transform data with JavaScript |
| `template.render` | Generate a text file from a template |
| `file.read`, `file.write` | Read and write local files |
| `jq.filter` | Pick values out of JSON with a jq filter |
| `docker.run` | Run a step in a container |
| `ssh.run` | Run a command on another machine |
| `postgres.query` | Query a database |
| `mail.send` | Send an email |
| `dag.run` | Run another workflow. See [lesson 7](/tutorial/sub-dags) |

Every action has a reference page under **Actions** in the sidebar. For ready-made patterns in the terminal, run `dagu example`.

## Try it

1. Change `userId=1` to `userId=2` in the URL and run again. What does `report.md` say now?
2. Delete the closing `}` from the `return` line in `summarize`, then run `dagu validate tutorial-04-actions.yaml`. What happens?
3. Change the URL to `https://jsonplaceholder.typicode.com/todos/9999`, which does not exist. What happens?

::: details Answers

1. `Still open: 12` and `Next up: suscipit repellat esse quibusdam voluptatem incidunt`.
2. Validation fails with a JavaScript `SyntaxError` that names the line, and nothing runs.
3. The API answers `404`, so `fetch_todos` fails and the steps after it never run. `http.request` fails on any status outside 200–299.

:::

<a href="/step-types/js" class="learn-more">Go deeper: JavaScript →</a>
<a href="/dagu-actions/" class="learn-more">Go deeper: Actions →</a>
