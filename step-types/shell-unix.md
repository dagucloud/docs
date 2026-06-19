# Shell (macOS / Linux)

Run commands and scripts on Unix-like systems (macOS, Linux, BSD).

## Configure the Shell

- **DAG defaults** (literal values):
  ```yaml
  shell: ["/bin/bash", "-e", "-u"]
  steps:
    - run: echo "Runs with bash -e -u"
  ```
- **Step override** (evaluated at runtime so params/secrets/outputs are allowed):
  ```yaml
  steps:
    - run: echo "Runs in the step shell"
      with:
        shell: ${CUSTOM_SHELL:-/bin/zsh}
  ```
- **Fallback**: If no shell is set, Dagu uses `DAGU_DEFAULT_SHELL`, then `$SHELL`, then `sh`.
- **String or array**: `shell` accepts either `"bash -e"` or `["bash", "-e"]`; arrays avoid quoting issues.

## Running Commands

- **Inline command string**:
  ```yaml
  type: chain

  steps:
    - run: echo "Hello"
    - run: echo "Hello with key"
    - run: |
        echo "Multi-line command block"
        echo "Runs as a script (not split into args)"
  ```
- **Structured direct exec**:
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
- **Script block**:
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
- **Working directory and env**: Use `working_dir` and `env` on the step (or DAG defaults) to control context.

## Script Behavior (Unix)

- A `run:` block is prepared as temporary script input and removed after the step finishes. Do not depend on the prepared script path or directory.
- Dagu resolves `${...}` references in the script before it starts. Backticks remain in the script text; the selected shell or interpreter defines what they mean.
- If there is no step-level `shell` and the script has a shebang, that interpreter runs the script. Without a shebang, the resolved shell runs it (Dagu appends `-e` for sh/bash/zsh/ksh/ash/dash when using the default/DAG-level shell; step-level shells are left unchanged).
- When both `shell` and a multi-line `run` block are set, the shell value is used as the interpreter.

## Shell Options

- **POSIX shells (sh/bash/zsh/ksh/ash/dash)**  
  With the default or DAG-level shell, Dagu appends `-e` so the shell stops on the first failing command. If you set a step-level shell, add `-e` yourself when you want errexit.

- **nix-shell**  
  Pin tools per step with `with.shell: nix-shell` and `with.shell_packages`:
  ```yaml
  steps:
    - run: |
        python3 --version
        jq --version
      with:
        shell: nix-shell
        shell_packages: [python3, jq]
  ```
  nix-shell must be installed separately. Dagu runs inside `nix-shell --run ...`; it defaults to `--pure` if you do not supply purity flags. Include any flags you need (such as `--impure`) in the `shell` array. When Dagu supplies the shell, it prepends `set -e;` to the command string unless you already provided it.

- **Direct execution (no shell parsing)**  
  Use `action: exec` for explicit argv:
  ```yaml
  steps:
    - action: exec
      with:
        command: /usr/bin/python3
        args:
          - -u
          - script.py
  ```
  `action: exec` bypasses shell parsing and uses explicit `with.command` / `with.args`.

## Tips

- Prefer `action: exec` when you need explicit argv with flags.
- Keep DAG-level shells stable; override per-step only when you need a different interpreter.
- Use shebangs in multi-line scripts when you want a specific interpreter without repeating `shell`.
- When using nix-shell, list every tool your step needs in `with.shell_packages` for reproducibility.
