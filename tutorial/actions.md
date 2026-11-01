# Built-in Actions

<p class="tutorial-meta">Lesson 4 of 10 · 4 minutes</p>

`run` runs a shell command. For common jobs such as calling an API, rendering a file, querying a database, or starting a container, a step can use a built-in **action** instead, with no scripts or extra tools to install.

## The workflow

```bash
curl -fsSLO https://docs.dagu.sh/tutorial/dags/tutorial-04-actions.yaml
```

<<< @/public/tutorial/dags/tutorial-04-actions.yaml

- `action` picks the built-in action. `with` holds its settings.
- `http.request` calls a URL and prints the response body. With `decode: json`, `select` picks one field out of it, and `output` publishes each field as a named output.
- `template.render` fills a template with `data`. `stdout: {artifact: report.md}` saves what the step prints as a file attached to the run.

This lesson calls `jsonplaceholder.typicode.com`, a free test API, so it needs internet access.

## Watch it run

<RunReplay run="tutorial-04-actions" />

Select `fetch_todo` to see the JSON response and the two fields picked out of it.

## Run it yourself

```bash
dagu start tutorial-04-actions.yaml
```

In the Web UI, open the run, then **Activity** → **Artifacts** to read `report.md`.

## Find more actions

| Action | Use it to |
| --- | --- |
| `http.request` | Call an HTTP API |
| `template.render` | Generate a text file from a template |
| `file.read`, `file.write` | Read and write local files |
| `jq.filter` | Reshape JSON |
| `docker.run` | Run a step in a container |
| `ssh.run` | Run a command on another machine |
| `postgres.query` | Query a database |
| `mail.send` | Send an email |
| `dag.run` | Run another workflow. See [lesson 7](/tutorial/sub-dags) |

Every action has a reference page under **Actions** in the sidebar. For ready-made patterns in the terminal, run `dagu example`.

## Try it

1. Change the URL to `https://jsonplaceholder.typicode.com/todos/2` and run again. What does `report.md` say now?
2. Change the URL to `https://jsonplaceholder.typicode.com/todos/9999`, which does not exist. What happens?

::: details Answers

1. It shows the title of todo 2, `quis ut nam facilis et officia qui`.
2. The API answers `404`, so `fetch_todo` fails and `write_report` never runs. `http.request` fails on any status outside 200–299.

:::

<a href="/dagu-actions/" class="learn-more">Go deeper: Actions →</a>
