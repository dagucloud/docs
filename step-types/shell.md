# Shell

Run system commands and scripts with the default action.

## Configure the Shell

- **DAG defaults** (literal): set `shell` for all steps.
  ```yaml
  shell: ["/bin/bash", "-e", "-u"]
  steps:
    - run: echo "Runs with bash -e -u"
  ```
- **Step override** (evaluated at runtime, can reference params/secrets/outputs):
  ```yaml
  steps:
    - run: echo "Runs in the step shell"
      with:
        shell: ${CUSTOM_SHELL:-/bin/zsh}
  ```
- **Fallback**: if you set nothing, Dagu uses `DAGU_DEFAULT_SHELL`, then `$SHELL`, then `sh` on Unix; on Windows it prefers PowerShell, then `pwsh`, then `cmd.exe`.
- **String or array**: `shell` accepts either `"bash -e"` or `["bash", "-e"]`; arrays avoid quoting issues.

## Running Commands

- **Inline command string** for quick one-liners or pipelines:
  ```yaml
  steps:
    - run: echo "Hello"
    - run: echo "Hello with key"
    - run: |
        echo "Multi-line command block"
        echo "Runs as a script (not split into args)"
  ```
- **Multiple commands** can share one shell step:
  ```yaml
  steps:
    - run: |
        echo "step 1"
        echo "step 2"
        echo "step 3"
      env:
        - MY_VAR: value
      working_dir: /app
      stdout:
        artifact: reports/output.log
  ```
  Instead of duplicating `env`, `working_dir`, `stdout`, `retry_policy`, `preconditions`, etc. across multiple steps, combine commands into one step. Use `stdout.artifact` / `stderr.artifact` when command output should appear in the run's Artifacts tab.
- **Structured direct exec** when you want unambiguous arguments and no shell parsing:
  ```yaml
  steps:
    - action: exec
      with:
        command: /usr/bin/python3
        args:
          - -u
          - app.py
          - --limit
          - 10
  ```
- **Script block** for multi-line scripts:
  ```yaml
  steps:
    - run: |
        #!/usr/bin/env bash
        set -e
        echo "Multi-line script"
  ```
  If you omit a step-level `shell` and the script has a shebang, that interpreter is used. Otherwise the resolved shell runs the script file.
- **Interpreter + inline script**:
  ```yaml
  steps:
    - run: |
        import sys
        print("Args:", sys.argv)
      with:
        shell: python3
  ```
- **Working directory and env**: set `working_dir` and `env` on the step (or DAG defaults) to control context.

## Script Behavior

- A multi-line `run:` block is prepared as temporary script input, executed as one script, and removed after the step finishes. Do not depend on the prepared script path or directory.
- Dagu resolves scoped references such as `${params.name}` and `${env.NAME}` before the script starts. Unqualified `$NAME` and `${NAME}`, backticks, and `$()` remain for the selected shell or interpreter.
- If you omit a step-level `shell` and the script starts with a shebang at the first character (`#!/usr/bin/env python3`, `#!/bin/bash`, etc.), that interpreter runs the script.
- Without a shebang, the resolved shell runs the script file. When Dagu provides the default Unix shell, it appends `-e` so the script stops on the first failing command (step-level shells are left unchanged).
- Multi-line `run` strings (using a YAML `|` block) are executed as a script rather than split into args.
- `action: exec` bypasses shell parsing entirely and accepts explicit `with.command` and `with.args`.

## Built-in Safety Defaults

- **Auto `-e` on POSIX shells:** When Dagu supplies the default/DAG-level shell for sh/bash/zsh/ksh/ash/dash, it appends `-e` for both command strings and script runs. If you set a step-level shell, include `-e` yourself when desired.
- **PowerShell scripts:** Run through PowerShell file execution and are prefixed with `$ErrorActionPreference = 'Stop'` plus UTF-8 console/output encoding setup so cmdlet errors stop execution and text handling is stable.
- **nix-shell:** Dagu defaults to `--pure` if you do not specify purity flags. When Dagu supplies the shell, it also prepends `set -e;` to the command string unless you already provided it.

## Platform-Specific Guides

- [macOS / Linux details](./shell-unix.md) — POSIX shells, nix-shell, direct mode
- [Windows details](./shell-windows.md) — PowerShell/pwsh, cmd.exe, direct mode
