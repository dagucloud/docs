# Value References, Quoting, and Escaping

A reference in workflow YAML can be interpreted by three different layers:

1. The YAML parser reads the scalar and removes YAML quote delimiters.
2. Dagu resolves references in fields that support value resolution.
3. A shell, script interpreter, or executor may interpret the resulting text.

The same quote character can have a different effect at each layer. In
particular, YAML single quotes and single quote characters passed to a shell are
not the same thing.

## Reference Ownership

Dagu-owned references have an explicit namespace:

```text
${consts.name}
${params.name}
${env.NAME}
${steps.step_id.outputs.name}
${context.run.id}
```

In a value-resolved field, Dagu resolves these references before handing the
field to a later runtime. Shell-style single quotes do not prevent that
resolution.

Unqualified `$NAME` and `${NAME}` use field-specific behavior:

- In `steps[].run`, Dagu preserves them for the selected shell or script
  interpreter.
- In fields where Dagu owns unqualified environment expansion, Dagu expands
  them from the current environment scope.
- In literal fields, Dagu leaves them unchanged.

See [Variables Reference](/writing-workflows/template-variables) for the
available Dagu namespaces and the fields that support value references.

## YAML Quotes Are Removed

YAML parses a workflow before Dagu evaluates references. Quotes that delimit a
YAML scalar are not part of the value Dagu receives.

```yaml
env:
  - FOO: bar
  - COPY: '${FOO}'
```

Dagu receives `${FOO}` as the value of `COPY`; it does not receive the single
quote characters. Because root `env` values support unqualified environment
expansion, `COPY` becomes `bar`.

The same distinction applies to `run`:

```yaml
steps:
  - id: yaml_quotes
    run: 'printf "%s\n" "${FOO}"'
```

The outer single quotes are YAML syntax. The shell receives
`printf "%s\n" "${FOO}"` and expands `FOO`.

## Quotes That Reach Dagu

A reference is single-quoted for environment-expansion purposes only when it
starts inside a single-quoted span in the field text after YAML parsing.

For example, `log.write` is a non-shell action whose `message` field supports
Dagu environment expansion:

```yaml
env:
  - FOO: bar

steps:
  - id: retained_quotes
    action: log.write
    with:
      message: "literal '${FOO}'"
```

YAML removes the outer double quotes but retains the inner single quotes. Dagu
therefore preserves `${FOO}`, and the action writes `literal '${FOO}'`.

In a `run` field, the retained quotes are also passed to the shell:

```yaml
steps:
  - id: shell_quotes
    run: printf '%s\n' '${FOO}'
```

Here the whole `run` value is a plain YAML scalar. The single quote characters
inside it remain in the field text. Dagu already preserves unqualified
references in `run` for the selected interpreter, and the shell prints the
literal text `${FOO}` because it is inside shell single quotes.

The rule applies only to unqualified environment syntax. `${env.FOO}` is a
Dagu-owned reference and is resolved even when shell single quotes surround it:

```yaml
env:
  - FOO: bar

steps:
  - id: dagu_reference
    run: printf '%s\n' '${env.FOO}'
```

Dagu hands `printf '%s\n' 'bar'` to the shell, which prints `bar`.

The same behavior applies to other Dagu-owned references such as
`${params.name}`, `${steps.build.outputs.image}`, and `${context.run.id}`.

## Escaping a Dagu-Owned Reference

Prefix the dollar sign with a backslash to prevent Dagu from resolving a
Dagu-owned reference. Dagu removes the escape marker before passing the value
on.

```yaml
steps:
  - id: literal_reference
    run: printf '%s\n' '\${env.FOO}'
```

Dagu removes the backslash and hands `printf '%s\n' '${env.FOO}'` to the shell.
The shell single quotes then preserve the dollar expression, so the command
prints `${env.FOO}`.

Escaping for Dagu and escaping for a later runtime are separate concerns:

- In a non-shell field where Dagu is the final evaluator, `\${params.name}` is
  enough to produce the literal text `${params.name}`.
- In a shell-backed field, protect the reference from Dagu and quote or escape
  it for the shell.
- In a YAML double-quoted scalar, write `\\${params.name}` so that Dagu receives
  `\${params.name}`. Plain, YAML single-quoted, and block scalars preserve the
  backslash as written.

## Quoted References in Shell Commands

On Dagu v2.25.3 or later, a local `run` command for a POSIX or Nix shell treats a bare `"${NAME}"` by where it sits:

- Unquoted or inside double quotes, the shell expands it, reading `NAME` from the step environment. Dagu leaves it as written.
- Inside a single-quoted span or a here-document body, where the shell never expands it, Dagu fills in the value, escaped so a JSON body stays valid.
- A secret is never written into the command text. To put one in a single-quoted body, close the quotes around it so the shell expands it.

```yaml
env:
  - NAME: widget
secrets:
  - name: TOKEN
    provider: env
    key: API_TOKEN
steps:
  - id: post
    run: |
      curl -d '{"name":"${NAME}","token":"'"${TOKEN}"'"}' https://api.example.com/items
```

Dagu fills in `NAME` inside the JSON body. The shell expands `TOKEN` from the environment, between the closed and reopened single quotes.

## Model Output in Shell Commands

Dagu does not escape a value it writes into a `run` command. That is usually your own data, but a model's reply can carry whatever text the model read, such as a bug report or a web page, so treat it as untrusted. No way of quoting it is safe:

| Written in `run` as | An apostrophe | A quote that closes the span | `$(...)` or backticks |
|---|---|---|---|
| `'${triage.output.summary}'` | Breaks the step | Runs as code | Stays text |
| `"${triage.output.summary}"` | Stays text | Stays text | Runs as code |
| `${triage.output.summary}` | Breaks the step | Runs as code | Runs as code |

Pass it through `env` instead. The value then reaches the command as data, whatever it contains:

```yaml
steps:
  - id: triage
    action: harness.run
    with:
      provider: codex
      prompt: Summarize the bug report in REPORT.md. Return JSON with a summary field.
    output_schema:
      type: object
      required: [summary]
      properties:
        summary: { type: string }

  - id: page
    depends: [triage]
    env:
      - SUMMARY: ${triage.output.summary}
    run: ./page.sh "$SUMMARY"
```

`dagu validate` warns when the output of a `harness.run`, `chat.completion`, or agent step is written into a shell command. It does not warn for a field that `output_schema` declares with `enum`, or as `boolean`, `integer`, or `number`, because validation limits its values.

## Scripts That Need No Escaping

[`js.run`](/step-types/js) passes `with.script` to its sandbox as written.
Dagu does not resolve references there and no shell parses it, so JavaScript
template literals and `$` need no escaping. Workflow values enter through
`with.input`, which Dagu resolves as usual.

```yaml
params:
  - name: name
    default: world

steps:
  - id: greet
    action: js.run
    with:
      input:
        name: ${params.name}
      script: |
        const price = "$5";
        return `Hello, ${input.name}. Tickets cost ${price}.`;
```

The step prints `Hello, world. Tickets cost $5.`

## Backslashes in Path Fields

In a field that holds a filesystem path, a backslash is part of the path and
never a Dagu escape marker, so a Windows path keeps its separator before a
reference:

```yaml
params:
  - name: name
    default: prod

steps:
  - id: write_log
    action: file.write
    with:
      path: C:\out\${params.name}.log
      content: done
```

Dagu writes to `C:\out\prod.log`. Every reference form after a backslash
resolves, Dagu removes no backslash, and a path field has no escape for
literal dollar text.

Assuming `${params.name}` is `prod` and `NAME` is `order-1.txt`:

| Text Dagu receives in a path field | The field receives |
| --- | --- |
| `C:\out\${params.name}.log` | `C:\out\prod.log` |
| `C:\done\${NAME}` | `C:\done\order-1.txt` |
| `C:\out\\${params.name}` | `C:\out\\prod` |

The workflow path fields are `dotenv` entries, root and step `working_dir`,
step `stdin`, `stdout`, and `stderr` with their `artifact` paths,
`output.<name>.path`, and `human.task` `with.artifacts`. Action inputs that are
paths are path fields too:

| Actions | Path inputs |
| --- | --- |
| `file.*` | `with.path`, `with.source`, `with.destination` |
| `archive.*`, `s3.*` | `with.source`, `with.destination` |
| `wait.file` | `with.path` |
| `template.render` | `with.output` |
| `http.request` | `with.output`, every value under `with.files` |
| `jq.filter`, `data.*` | `with.input` |
| `js.run` | `with.input_file` |
| `xlsx.*` | `with.path`, `with.input`, `with.output` |
| `postgres.*` | `with.output_file`, `with.import.input_file` |
| `sqlite.*` | `with.dsn`, `with.output_file`, `with.import.input_file` |
| `clickhouse.query` | `with.file`, `with.tls_ca` |
| `redis.*` | `with.script_file`, `with.tls_cert`, `with.tls_key`, `with.tls_ca` |
| `git.*` | `with.path`, `with.ssh_key_path` |
| `mail.*` | every entry of `with.attachments` |
| `kubernetes.run`, `k8s.run` | `with.kubeconfig` |

Every other field, including `run`, `env` values, and action inputs not listed
here, keeps the backslash escape. A Windows path in such a field uses `/` or a
doubled `\\` before a reference.

## Quoting Does Not Sanitize Inserted Values

Dagu inserts resolved strings as written. It does not shell-escape, JSON-escape,
URL-escape, or otherwise quote them. Surrounding a Dagu reference with shell
quotes does not make arbitrary inserted text safe if the value itself contains
matching quotes or other shell syntax.

When a shell should treat a value strictly as data, expose it as an environment
variable and let the shell expand it inside double quotes:

```yaml
env:
  - MESSAGE: ${MESSAGE}

steps:
  - id: print_message
    run: printf '%s\n' "$MESSAGE"
```

For direct process executors, prefer separate argument fields when the executor
supports them.

## Quick Reference

Assuming `FOO=bar`:

| Authored YAML | Who resolves the reference? | Command output |
| --- | --- | --- |
| `run: 'printf "%s\n" "${FOO}"'` | The shell; YAML removes the outer quotes | `bar` |
| `run: printf '%s\n' '${FOO}'` | Nobody; shell single quotes preserve it | `${FOO}` |
| `run: printf '%s\n' '${env.FOO}'` | Dagu, before the shell runs | `bar` |
| `run: printf '%s\n' '\${env.FOO}'` | Nobody; the backslash escapes Dagu and the quotes protect it from the shell | `${env.FOO}` |
| `js.run` with `script: 'return "${env.FOO}";'` | Nobody; Dagu does not resolve `js.run` scripts | `${env.FOO}` |

## Related Pages

- [Variables Reference](/writing-workflows/template-variables)
- [Environment Variables](/writing-workflows/environment-variables)
- [Data and Variables](/writing-workflows/data-variables)
- [YAML Specification](/writing-workflows/yaml-specification)
