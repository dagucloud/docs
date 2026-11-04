---
title: Skills
description: Install the bundled Dagu skill, point a coding tool at llms.txt, and validate what it writes so an AI assistant produces workflow YAML that runs.
---

# Skills

The Dagu skill is a packaged authoring reference for AI coding tools. It ships in the repository and covers which DAG type to pick, the step fields, the built-in actions, the harnesses, and the CLI. Reference files load per task rather than all at once.

`llms.txt` is the same material flattened into one file, for tools that read a URL instead of installing a skill.

Both target tools working on files. When a server is running, [MCP](/mcp/) is the better path: it supplies the reference itself and checks every edit before it is saved.

```mermaid
flowchart LR
    S["Skill · authoring rules"] --> T["AI coding tool"]
    L["llms.txt · compact reference"] --> T
    T --> Y["workflow YAML"]
    Y --> V["dagu validate"]
    V -->|errors| T
    V -->|clean| R["dagu start"]

    style S stroke:lightblue,stroke-width:1.6px,color:#333
    style L stroke:lightblue,stroke-width:1.6px,color:#333
    style T stroke:orange,stroke-width:1.6px,color:#333
    style Y stroke:lime,stroke-width:1.6px,color:#333
    style V stroke:lime,stroke-width:1.6px,color:#333
    style R stroke:green,stroke-width:1.6px,color:#333
```

## Install the skill

The [script installers](/getting-started/installation/#what-the-script-installers-do) offer to install the skill for the AI coding tools they detect. To install it yourself with the GitHub CLI, name the tool and install at user scope:

```bash
gh skill install dagucloud/dagu dagu --agent claude-code --scope user
```

Without `--scope user`, gh installs into the project in the current directory. Without `--agent`, it asks for a tool, or installs for GitHub Copilot when it cannot ask. Use another `--agent` value such as `codex`, `cursor`, `gemini-cli`, or `opencode` for other tools, and add `--force` to update an existing install.

It carries the authoring rules that are easy to get wrong from general knowledge: when to reach for `type: graph` over `type: agent`, why `id` belongs on every step, when `action: template.render` beats a shell heredoc, and which `file.*` action replaces shelling out to `cp` or `mkdir`. It loads task-specific references on demand rather than all at once, covering step types, the CLI, Dagu Actions, harnesses, and build DAGs.

Run `gh skill install --help` for the full list of `--agent` values.

## Point a tool at llms.txt

The flattened file lives at:

```text
https://raw.githubusercontent.com/dagucloud/dagu/main/llms.txt
```

It is generated from the skill sources, so the two never drift. Paste the URL into a tool that fetches context, or keep a copy next to the workflows in a repository so the reference is available offline.

## Let the tool check its own work

Neither a skill nor a reference file guarantees correct YAML. Two commands close the loop, and both are worth putting in front of an agent explicitly:

```bash
dagu validate workflow.yaml
dagu schema dag handler_on
```

`validate` builds the DAG and reports the same errors the server would, without running anything. `schema` prints the JSON Schema at a dot-separated path (`dagu schema dag defaults.continue_on`), so an agent can look up a shape instead of guessing it. Telling a coding tool to run `dagu validate` after every edit turns a plausible-looking file into a verified one, and the same command is what checks every YAML example in this documentation.

## When to use MCP instead

A skill stops at the file. [MCP](/mcp/) covers the same authoring job and more, which is why it is the recommended path whenever a server is running.

| | Skill or `llms.txt` | MCP |
|---|---|---|
| Configure | `gh skill install dagucloud/dagu dagu --scope user` | `http://localhost:8080/mcp` |
| Needs a running server | No | Yes |
| Authoring reference | Installed on the client | Supplied by the server |
| Validation | You tell the tool to run `dagu validate` | The server checks every edit before it is saved |
| After the edit | Nothing further | Starts the run, reads logs, debugs the failure |

Use the skill when the tool edits files with no server to reach, or alongside MCP when you want the authoring rules present in the editor too. See [MCP Clients](/mcp/clients/) for per-client setup.

## Regenerating the reference

Contributors editing the skill sources under `skills/dagu` regenerate the flattened file with:

```bash
make llms
```

Both surfaces are checked in, so a change to the skill needs the regenerated `llms.txt` in the same commit. See [Contributing](/overview/contributing).
