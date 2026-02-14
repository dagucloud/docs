# Shell

Run system commands and scripts with the default step type.

## Configure the Shell

- **DAG defaults** (literal): set `shell` for all steps.
  ```yaml
  shell: ["/bin/bash", "-e", "-u"]
  steps:
    - command: echo "Runs with bash -e -u"
  ```
- **Step override** (evaluated at runtime, can reference params/secrets/outputs):
  ```yaml
  steps:
    - shell: ${CUSTOM_SHELL:-/bin/zsh}
      command: echo "Runs in the step shell"
  ```
- **Fallback**: if you set nothing, Dagu uses `DAGU_DEFAULT_SHELL`, then `$SHELL`, then `sh` on Unix; on Windows it prefers PowerShell, then `pwsh`, then `cmd.exe`.
- **String or array**: `shell` accepts either `"bash -e"` or `["bash", "-e"]`; arrays avoid quoting issues.

## Running Commands

- **Inline command string** for quick one-liners or pipelines:
  ```yaml
  steps:
    - echo "Hello"
    - command: echo "Hello with key"
    - |
        echo "Multi-line command block"
        echo "Runs as a script (not split into args)"
  ```
- **Multiple commands** share the same step configuration:
  ```yaml
  steps:
    - command:
        - echo "step 1"
        - echo "step 2"
        - echo "step 3"
      env:
        - MY_VAR: value
      working_dir: /app
      stdout: /tmp/output.log
  ```
  Instead of duplicating `env`, `working_dir`, `stdout`, `retry_policy`, `preconditions`, etc. across multiple steps, combine commands into one step.
- **Command + args array** when you want unambiguous arguments and no shell parsing:
  ```yaml
  steps:
    - command: [python3, -u, app.py, --limit, "10"]
  ```
- **Script block** for multi-line scripts:
  ```yaml
  steps:
    - script: |
        #!/usr/bin/env bash
        set -e
        echo "Multi-line script"
  ```
  If you omit a step-level `shell` and the script has a shebang, that interpreter is used. Otherwise the resolved shell runs the script file.
- **Interpreter + inline script**:
  ```yaml
  steps:
    - command: python3
      script: |
        import sys
        print("Args:", sys.argv)
  ```
- **Direct execution (no shell parsing)**:
  ```yaml
  steps:
    - shell: direct
      command: [/usr/bin/python3, -u, script.py]
  ```
- **Working directory and env**: set `working_dir`/`dir` and `env` on the step (or DAG defaults) to control context.

## Script Behavior

- A `script:` block is written to a temp file in the working directory when possible, then removed after the step finishes.
- If you omit a step-level `shell` and the script starts with a shebang (`#!/usr/bin/env python3`, `#!/bin/bash`, etc.), that interpreter runs the script.
- Without a shebang, the resolved shell runs the script file. When Dagu provides the default Unix shell, it appends `-e` so the script stops on the first failing command (step-level shells are left unchanged).
- When you set both `command` and `script`, the `command` acts as the interpreter and receives the script path (no shell wrapper) — ideal for `command: python3` with inline code.
- Multi-line `command` strings (using YAML `|` block) are treated the same as `script:`: they are saved to a temp file and executed as a script rather than split into args.

## Built-in Safety Defaults

- **Auto `-e` on POSIX shells:** When Dagu supplies the default/DAG-level shell for sh/bash/zsh/ksh/ash/dash, it appends `-e` for both command strings and script runs. If you set a step-level shell, include `-e` yourself when desired.
- **PowerShell scripts:** Saved as `.ps1` and prefixed with `$ErrorActionPreference = 'Stop'` and `$PSNativeCommandUseErrorActionPreference = $true` so cmdlet errors and native command failures stop execution.
- **nix-shell:** Dagu defaults to `--pure` if you do not specify purity flags. When Dagu supplies the shell, it also prepends `set -e;` to the command string unless you already provided it.

## Platform-Specific Guides

- [macOS / Linux details](./shell-unix.md) — POSIX shells, nix-shell, direct mode
- [Windows details](./shell-windows.md) — PowerShell/pwsh, cmd.exe, direct mode
