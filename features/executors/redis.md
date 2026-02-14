# Redis

Execute Redis commands and operations against Redis servers.

## Basic Usage

```yaml
steps:
  - name: ping
    type: redis
    config:
      host: localhost
      port: 6379
      command: PING
```

## DAG-Level Configuration

Define connection defaults at the DAG level to avoid repetition across steps:

```yaml
redis:
  host: localhost
  port: 6379
  password: ${REDIS_PASSWORD}

steps:
  - name: set-value
    type: redis
    config:
      command: SET
      key: mykey
      value: "hello world"

  - name: get-value
    type: redis
    config:
      command: GET
      key: mykey
    output: RESULT
```

Steps inherit connection settings from the DAG level. Step-level config overrides DAG-level defaults.

## Configuration

### Connection

| Field | Description | Default |
|-------|-------------|---------|
| `url` | Redis URL (`redis://user:pass@host:port/db`) | - |
| `host` | Redis host (alternative to URL) | `localhost` |
| `port` | Redis port | `6379` |
| `password` | Authentication password | - |
| `username` | ACL username (Redis 6+) | - |
| `db` | Database number (0-15) | `0` |

### TLS

| Field | Description | Default |
|-------|-------------|---------|
| `tls` | Enable TLS connection | `false` |
| `tls_cert` | Client certificate path | - |
| `tls_key` | Client key path | - |
| `tls_ca` | CA certificate path | - |
| `tls_skip_verify` | Skip certificate verification | `false` |

### High Availability

| Field | Description | Default |
|-------|-------------|---------|
| `mode` | Connection mode: `standalone`, `sentinel`, `cluster` | `standalone` |
| `sentinel_master` | Sentinel master name | - |
| `sentinel_addrs` | Sentinel addresses | - |
| `cluster_addrs` | Cluster node addresses | - |

### Command Execution

| Field | Description | Default |
|-------|-------------|---------|
| `command` | Redis command (e.g., `GET`, `SET`, `HGET`) | - |
| `key` | Primary key | - |
| `keys` | Multiple keys (for commands like MGET, DEL) | - |
| `value` | Value for SET operations | - |
| `values` | Multiple values (for LPUSH, SADD, etc.) | - |
| `field` | Hash field name | - |
| `fields` | Multiple hash fields (map) | - |
| `ttl` | Expiration in seconds (for SET, EXPIRE) | - |
| `timeout` | Command timeout in seconds | `30` |
| `max_retries` | Maximum retry attempts | `3` |

### Additional Options

| Field | Description |
|-------|-------------|
| `nx` | SET if key does not exist |
| `xx` | SET if key exists |
| `start` | Range start (for LRANGE, ZRANGE) |
| `stop` | Range stop (for LRANGE, ZRANGE) |
| `score` | Score for sorted set operations |
| `with_scores` | Include scores in sorted set output |
| `match` | Pattern for SCAN/KEYS |
| `count` | Count for SCAN, LPOP, etc. |

### Output

| Field | Description | Default |
|-------|-------------|---------|
| `output_format` | Output format: `json`, `jsonl`, `raw`, `csv` | `json` |
| `null_value` | String representation for nil values | `null` |
| `max_result_size` | Maximum result size in bytes | `10MB` |

## Examples

### String Operations

```yaml
steps:
  - name: set-key
    type: redis
    config:
      command: SET
      key: user:1:name
      value: "John Doe"

  - name: get-key
    type: redis
    config:
      command: GET
      key: user:1:name
    output: USER_NAME

  - name: increment
    type: redis
    config:
      command: INCR
      key: counter
```

### Key Operations

```yaml
steps:
  - name: check-exists
    type: redis
    config:
      command: EXISTS
      key: mykey

  - name: set-expiry
    type: redis
    config:
      command: EXPIRE
      key: session:123
      ttl: 3600  # 1 hour in seconds

  - name: get-ttl
    type: redis
    config:
      command: TTL
      key: session:123

  - name: delete-key
    type: redis
    config:
      command: DEL
      key: temp:data
```

### Hash Operations

```yaml
steps:
  - name: set-hash
    type: redis
    config:
      command: HSET
      key: user:1
      field: email
      value: "john@example.com"

  - name: get-hash-field
    type: redis
    config:
      command: HGET
      key: user:1
      field: email
    output: EMAIL

  - name: get-all-hash
    type: redis
    config:
      command: HGETALL
      key: user:1
    output: USER_DATA
```

### List Operations

```yaml
steps:
  - name: push-to-list
    type: redis
    config:
      command: RPUSH
      key: queue:tasks
      values:
        - '{"task": "process-order", "id": 123}'

  - name: get-list-range
    type: redis
    config:
      command: LRANGE
      key: queue:tasks
      start: 0
      stop: -1  # all elements
    output: TASKS

  - name: pop-from-list
    type: redis
    config:
      command: LPOP
      key: queue:tasks
    output: NEXT_TASK
```

### Set Operations

```yaml
steps:
  - name: add-to-set
    type: redis
    config:
      command: SADD
      key: tags:article:1
      values:
        - "redis"
        - "database"
        - "cache"

  - name: get-members
    type: redis
    config:
      command: SMEMBERS
      key: tags:article:1
    output: TAGS

  - name: check-membership
    type: redis
    config:
      command: SISMEMBER
      key: tags:article:1
      value: "redis"
```

### Sorted Set Operations

```yaml
steps:
  - name: add-score
    type: redis
    config:
      command: ZADD
      key: leaderboard
      score: 100
      value: "player1"

  - name: get-top-players
    type: redis
    config:
      command: ZRANGE
      key: leaderboard
      start: 0
      stop: 9
      with_scores: true
    output: TOP_PLAYERS
```

### Pipeline Operations

Execute multiple commands in a single round-trip:

```yaml
steps:
  - name: batch-operations
    type: redis
    config:
      pipeline:
        - command: SET
          key: key1
          value: "value1"
        - command: SET
          key: key2
          value: "value2"
        - command: GET
          key: key1
        - command: GET
          key: key2
```

### Transactions

Execute commands atomically with MULTI/EXEC:

```yaml
steps:
  - name: atomic-transfer
    type: redis
    config:
      multi: true
      pipeline:
        - command: DECR
          key: account:1:balance
        - command: INCR
          key: account:2:balance
```

### Lua Scripts

Execute Lua scripts for complex operations:

```yaml
steps:
  - name: rate-limit
    type: redis
    config:
      script: |
        local key = KEYS[1]
        local limit = tonumber(ARGV[1])
        local window = tonumber(ARGV[2])
        local current = redis.call('INCR', key)
        if current == 1 then
          redis.call('EXPIRE', key, window)
        end
        if current > limit then
          return 0
        end
        return 1
      script_keys:
        - "ratelimit:${USER_ID}"
      script_args:
        - "100"   # limit
        - "60"    # window in seconds
    output: ALLOWED
```

Or load from a file:

```yaml
steps:
  - name: complex-operation
    type: redis
    config:
      script_file: ./scripts/process.lua
      script_keys:
        - "input:data"
      script_args:
        - "${PARAM}"
```

### Distributed Locking

Acquire a lock before executing critical operations:

```yaml
steps:
  - name: critical-section
    type: redis
    config:
      lock: "locks:resource:${RESOURCE_ID}"
      lock_timeout: 30      # Lock expires after 30 seconds
      lock_retry: 10        # Retry 10 times to acquire lock
      lock_wait: 100        # Wait 100ms between retries
      command: SET
      key: resource:${RESOURCE_ID}
      value: '{"status": "processing"}'
```

### Output Capture

```yaml
steps:
  - name: get-config
    type: redis
    config:
      command: HGETALL
      key: app:config
    output: CONFIG

  - name: use-config
    command: echo "Database host is ${CONFIG}"
    depends:
      - get-config
```

## Connection Modes

### Standalone

Default mode for single Redis server:

```yaml
redis:
  host: localhost
  port: 6379
```

### Sentinel

For high availability with automatic failover:

```yaml
redis:
  mode: sentinel
  sentinel_master: mymaster
  sentinel_addrs:
    - sentinel1:26379
    - sentinel2:26379
    - sentinel3:26379
  password: ${REDIS_PASSWORD}
```

### Cluster

For distributed Redis cluster:

```yaml
redis:
  mode: cluster
  cluster_addrs:
    - node1:6379
    - node2:6379
    - node3:6379
  password: ${REDIS_PASSWORD}
```

## Connection Pooling

### Non-Worker Mode

When executing DAGs directly, each step creates its own connection with defaults:
- Max retries: 3 (configurable via `max_retries`)
- Command timeout: 30 seconds (configurable via `timeout`)

### Worker Mode (Shared-Nothing)

When running distributed workers, Redis connections use a **global connection pool** managed at the worker level. This prevents connection exhaustion when multiple DAGs run concurrently.

The pool manager:
- Reuses connections across DAG executions with the same connection parameters
- Automatically manages connection lifecycle
- Verifies connections with PING before reuse

::: warning Connection Limits
In worker mode, configure your Redis server's `maxclients` setting appropriately for the expected number of concurrent connections.
:::

## Output Formats

### JSON (default)

```json
{"key": "value", "count": 42}
```

### JSONL

One JSON object per line:

```
{"id": 1, "name": "item1"}
{"id": 2, "name": "item2"}
```

### Raw

Plain text output, useful for simple values:

```
value
```

### CSV

Comma-separated format for tabular data:

```
field1,field2,field3
value1,value2,value3
```

## Error Handling

```yaml
steps:
  - name: redis-operation
    type: redis
    config:
      command: GET
      key: critical-data
      max_retries: 5
      timeout: 10
    retry_policy:
      limit: 3
      interval_sec: 2
    continue_on:
      failure: true
```

## TLS Configuration

```yaml
redis:
  host: secure-redis.example.com
  port: 6380
  tls: true
  tls_cert: /path/to/client.crt
  tls_key: /path/to/client.key
  tls_ca: /path/to/ca.crt
```

For self-signed certificates in development:

```yaml
redis:
  host: localhost
  port: 6379
  tls: true
  tls_skip_verify: true
```

## Cloud Redis Services

### Redis Cloud

```yaml
redis:
  host: redis-12345.c1.us-east-1-2.ec2.cloud.redislabs.com
  port: 12345
  username: default
  password: ${REDIS_CLOUD_PASSWORD}
```

### AWS ElastiCache

```yaml
redis:
  host: my-cluster.abc123.ng.0001.use1.cache.amazonaws.com
  port: 6379
  tls: true
```

### Azure Cache for Redis

```yaml
redis:
  host: my-cache.redis.cache.windows.net
  port: 6380
  password: ${AZURE_REDIS_KEY}
  tls: true
```
