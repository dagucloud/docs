# Built-in Actions

<p class="tutorial-meta">Lesson 4 of 10 · 4 minutes</p>

`run` runs a shell command. For common jobs like calling an API or transforming data, a step can use a built-in action instead, with no extra tools to install.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-04-actions.yaml
```

<<< @/public/tutorial/dags/tutorial-04-actions.yaml

Instead of `run`, each step specifies an `action` and passes configuration to `with`. `fetch_todos` uses `http.request` to call the API and stores the response body in `todos`. `summarize` passes that text into `js.run`, which parses the JSON automatically so the script can filter the array. Returning a string writes it directly to standard output.

This workflow calls `jsonplaceholder.typicode.com`, so your machine needs internet access.

## Watch it run

<RunReplay run="tutorial-04-actions" />

Select `summarize` to see the text returned by the JavaScript sandbox.

## Run it yourself

```bash
dagu start tutorial-04-actions.yaml
```

In the Web UI, open the run and select `summarize` to read what it printed.

## When to use `js.run`

Use `js.run` to filter, reshape, or compute values between steps instead of calling `jq` or `awk` in a shell command. Dagu checks JavaScript syntax when validating the workflow, before any step runs.

The sandbox has no access to the network, files, environment variables, or npm packages. Handle network and disk operations in other steps, and pass data into JavaScript through `input`.

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

1. Change `userId=1` to `userId=2` in the URL and run the workflow again. What does `summarize` print?
2. Delete the last `)` on the `filter` line in `summarize`, then run `dagu validate tutorial-04-actions.yaml`. What happens?

::: details Answers

1. `Still open: 12. Next up: suscipit repellat esse quibusdam voluptatem incidunt`.
2. Validation fails with a JavaScript `SyntaxError` that names the line, and nothing runs.

:::

<a href="/step-types/js" class="learn-more">Go deeper: JavaScript →</a>
<a href="/dagu-actions/" class="learn-more">Go deeper: Actions →</a>
