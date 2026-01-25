# Tags

Categorize and filter DAGs and DAG runs using tags.

## Overview

Tags support key-value pairs (`env=prod`) and simple labels (`critical`). Values are normalized to lowercase.

## Tag Format

Tags are validated at DAG load time. Invalid tags cause load errors.

| Component | Rules |
|-----------|-------|
| **Key** | 1-63 characters. Alphanumeric, `-`, `_`, `.`. Must start with letter or number. |
| **Value** | 0-255 characters. Alphanumeric, `-`, `_`, `.`, `/`. |

Valid: `env`, `my-tag`, `app.version`, `path=foo/bar`

Invalid: `-starts-with-dash`, `has space`, `has@special`

## YAML Formats

All formats below are equivalent:

```yaml
# String: space-separated key=value
tags: "env=prod team=platform"

# String: comma-separated (simple tags)
tags: "production, critical, batch"

# Map notation
tags:
  env: prod
  team: platform

# Array of strings
tags:
  - env=prod
  - team=platform
  - critical

# Array of maps
tags:
  - env: prod
  - team: platform

# Mixed array
tags:
  - env=prod
  - critical
  - team: platform
```

## API Filtering

Filter DAGs and DAG runs using the `tags` query parameter.

### Filter Syntax

| Syntax | Description |
|--------|-------------|
| `key` | Match any item with this key (any value) |
| `key=value` | Match exact key-value pair |
| `!key` | Match items WITHOUT this key |
| `key*` | Wildcard: match keys starting with `key` |
| `key=value*` | Wildcard: match values starting with `value` |
| `te?m` | Wildcard: `?` matches single character |

Multiple filters use AND logic.

### Wildcard Patterns

Use `*` (any characters) and `?` (single character) for pattern matching:

```bash
# Match env=prod, env=production, env=prod-us
GET /api/v2/dags?tags=env=prod*

# Match any value for team key
GET /api/v2/dags?tags=team=*

# Match keys starting with "env"
GET /api/v2/dags?tags=env*

# Match team or teem (single char wildcard)
GET /api/v2/dags?tags=te?m
```

### DAG Filtering

```bash
# DAGs with "env" key (any value)
GET /api/v2/dags?tags=env

# DAGs with env=prod
GET /api/v2/dags?tags=env=prod

# DAGs with env=prod AND team key
GET /api/v2/dags?tags=env=prod,team

# DAGs without "deprecated" key
GET /api/v2/dags?tags=!deprecated

# Combined: env=prod AND has team AND not deprecated
GET /api/v2/dags?tags=env=prod,team,!deprecated
```

### DAG Runs Filtering

Filter runs from DAGs that have the specified tags:

```bash
# Runs from DAGs with "env" key
GET /api/v2/dag-runs?tags=env

# Runs from DAGs with env=prod
GET /api/v2/dag-runs?tags=env=prod

# Runs from DAGs with env=prod AND team key
GET /api/v2/dag-runs?tags=env=prod,team
```

## UI

The tag filter dropdown is available on both the DAG list and DAG runs pages. Select tags to filter; multiple tags use AND logic.
