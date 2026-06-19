# Shell (Windows)

Run commands and scripts on Windows using PowerShell, pwsh, or cmd.exe.

## Configure the Shell

- **DAG defaults** (literal values):
  ```yaml
  shell: powershell -NoProfile
  steps:
    - run: Write-Host "Runs with PowerShell"
  ```
- **Step override** (evaluated at runtime so params/secrets/outputs are allowed):
  ```yaml
  steps:
    - run: Write-Host "Runs in the step shell"
      with:
        shell: ${SHELL_OVERRIDE:-pwsh -NoProfile}
  ```
- **Fallback**: If no shell is set, Dagu prefers PowerShell, then `pwsh`, then `cmd.exe`.
- **String or array**: `shell` accepts either `"powershell -NoProfile"` or `["powershell", "-NoProfile"]`; arrays avoid quoting issues.

## Running Commands

- **Inline command string**:
  ```yaml
  steps:
    - run: Write-Host "Hello from PowerShell"
    - run: echo Hello from cmd
      with:
        shell: cmd
    - run: |
        @echo off
        echo Multi-line command block
        echo Runs as a script (not split into args)
      with:
        shell: cmd
  ```
- **Structured direct exec**:
  ```yaml
  steps:
    - action: exec
      with:
        command: C:\Windows\System32\cmd.exe
        args:
          - /c
          - echo
          - Hello from cmd argv
  ```
- **Script block**:
  ```yaml
  steps:
    - run: |
        Write-Host "Multi-line script"
        Get-Date
      with:
        shell: powershell
  ```
  Scripts are saved as `.ps1` files and executed with the selected shell.
- **Interpreter + inline script**:
  ```yaml
  steps:
    - run: |
        Write-Host "Inline ps1 body"
      with:
        shell: powershell
  ```
- **Working directory and env**: Use `working_dir` and `env` on the step (or DAG defaults) to control context.

## Script Behavior (Windows)

- A `run:` block is prepared as temporary script input and removed after the step finishes. Do not depend on the prepared script path or directory.
- Dagu resolves `${...}` references in the script before it starts. Backticks remain in the script text; the selected shell or interpreter defines what they mean.
- With PowerShell/pwsh, the script runs through PowerShell file execution. Dagu prefixes each script with `$ErrorActionPreference = 'Stop'` plus UTF-8 console/output encoding setup so cmdlet errors stop execution and text handling is stable. With `cmd`, scripts follow cmd semantics; use PowerShell for richer scripting.
- When both `shell` and a multi-line `run` block are set, the shell value is used as the interpreter.

## Shell Options

- **PowerShell / pwsh**  
  Use DAG-level `shell: powershell`/`shell: pwsh`, or step-level `with.shell: powershell`/`with.shell: pwsh`. Script blocks run through PowerShell file execution and are prefixed with `$ErrorActionPreference = 'Stop'` plus UTF-8 console/output encoding setup. Use PowerShell syntax for variables/pipelines.

- **cmd.exe**  
  Set DAG-level `shell: cmd`, or step-level `with.shell: cmd`, for command prompt semantics. Include `/c` in the shell string/array when you want to run a single command string. For multi-line cmd scripts, embed the batch pattern directly in YAML:
  ```yaml
  steps:
    - run: |
        @echo off
        rem Command || (What to do if it fails)
        copy file.txt destination_folder\ || exit /b 1

        echo This line runs only if the copy succeeded.
      with:
        shell: cmd
  ```

- **Direct execution (no shell parsing)**  
  Use `action: exec` for explicit argv:
  ```yaml
  steps:
    - action: exec
      with:
        command: "C:\\Program Files\\Git\\bin\\bash.exe"
        args:
          - -c
          - echo from bash in direct mode
  ```
  `action: exec` bypasses shell parsing and uses explicit `with.command` / `with.args`.

## Tips

- Prefer `action: exec` when you need explicit argv with flags.
- Choose PowerShell for richer scripting; use `cmd` only when you need cmd.exe semantics.
- Keep DAG-level shells stable; override per-step only when a different interpreter is required.
- For `.ps1/.cmd/.bat` scripts in the working directory, use explicit relative or absolute paths to avoid PATH lookup issues.
