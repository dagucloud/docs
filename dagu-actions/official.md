# Official Dagu Actions

Official Dagu Actions are reusable action packages maintained in the public [`dagucloud`](https://github.com/dagucloud) GitHub organization. They use the short form:

```yaml
action: name@version
```

Dagu resolves that form to `dagucloud/name`. For example, `python-script@v1` resolves to [`dagucloud/python-script`](https://github.com/dagucloud/python-script) at tag `v1`.

Versions are required. Pin production workflows to a version tag or commit SHA; a commit SHA is the strongest reproducibility boundary.

Contributions are welcome. Each action repository is public, so improvements, bug reports, and pull requests can go directly to the action repository.

## Available Actions

| Action | Repository | Use when |
|--------|------------|----------|
| [`node-script@v1`](/dagu-actions/official/node-script) | [`dagucloud/node-script`](https://github.com/dagucloud/node-script) | Run a small JavaScript transform or glue step with action-owned Node.js. |
| [`python-script@v1`](/dagu-actions/official/python-script) | [`dagucloud/python-script`](https://github.com/dagucloud/python-script) | Run a small Python transform or glue step with action-owned Python and optional requirements. |
| [`dbt@v1`](/dagu-actions/official/dbt) | [`dagucloud/dbt`](https://github.com/dagucloud/dbt) | Run dbt Core commands with project-local adapter requirements. |
| [`duckdb@v1`](/dagu-actions/official/duckdb) | [`dagucloud/duckdb`](https://github.com/dagucloud/duckdb) | Run analytical SQL or file-backed DuckDB workflows without adding DuckDB bindings to the Dagu core binary. |
| [`ffmpeg@v1`](/dagu-actions/official/ffmpeg) | [`dagucloud/ffmpeg`](https://github.com/dagucloud/ffmpeg) | Run media conversion, transcoding, probing, or stream processing without baking FFmpeg into worker images. |
| [`github-cli@v1`](/dagu-actions/official/github-cli) | [`dagucloud/github-cli`](https://github.com/dagucloud/github-cli) | Run GitHub repository, issue, pull request, release, or API automation from a workflow. |
| [`rclone@v1`](/dagu-actions/official/rclone) | [`dagucloud/rclone`](https://github.com/dagucloud/rclone) | Run portable copy, sync, check, list, or storage-management workflows across rclone-supported backends. |

## Runtime Notes

Official actions declare their own `tools` in the action workflow. Caller DAG `tools` are not inherited across the action boundary.

Action `tools` are prepared by Dagu's managed tools runtime, powered internally by [aqua](https://github.com/aquaproj/aqua) from [aquaproj](https://github.com/aquaproj).

Official actions are not sandboxes. The action runs with the same worker permissions, filesystem access, network access, and secrets available to the Dagu run. Only run trusted code.

In standalone runs, the local Dagu process resolves the action, prepares the action tools, and runs the action workflow as a sub-DAG. In distributed runs, the worker executing the action step resolves and packages the action workspace; the worker running the action workflow prepares that action workflow's tools in its own local tools cache.

For the full package model, reference formats, manifest rules, output publication rules, and distributed execution details, see [Action Package Execution](/dagu-actions/execution-model).
