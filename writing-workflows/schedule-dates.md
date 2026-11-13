# Schedule Dates

The `dates` block names the dates a scheduled run loads, once, derived from its [schedule slot](/writing-workflows/runtime-variables#schedule-window). Every run of a slot gets the same dates: the scheduler's run, a run started for the slot with `--scheduled-at`, a retry, and a [backfill](/writing-workflows/backfill) run.

```yaml
schedule: "CRON_TZ=Asia/Tokyo 0 2 * * *"
calendar: jp-banking

dates:
  target_day:     -1d
  target_compact: { from: target_day, format: date_compact }
  month_start:    [-1d, month_start]
  last_open_day:  -1bd
  window_start:   { from: interval_start, format: rfc3339 }
  window_days:    { each: 1d }
  loaded_at:      { format: "%Y/%m/%d %H:%M", timezone: UTC }

steps:
  - id: load
    run: ./load.sh --date ${dates.target_day} --since ${dates.window_start}
```

For the run fired at 2026-11-10 02:00 in Tokyo, `target_day` is `2026-11-09`, `target_compact` is `20261109`, `month_start` is `2026-11-01`, and `window_days` is `["2026-11-09"]`.

## Entries

An entry is a shift written as a string or a list, or an object:

| Field | Meaning | Default |
| --- | --- | --- |
| `from` | `scheduled_at`, `interval_start`, `interval_end`, `next_scheduled_at`, or another entry | `scheduled_at` |
| `each` | A step through the window, such as `1d`. The entry becomes a list. | none |
| `shift` | One operation, or a list applied left to right | none |
| `format` | A named format or a strftime pattern | `date` |
| `timezone` | The zone used for shifting and formatting | see below |

`target_day: -1d` means `{ shift: -1d }`. An entry that starts `from` another entry starts from its instant after its shift, takes its zone unless it sets one, and does not take its format.

## Shifts

| Operation | Meaning |
| --- | --- |
| `+N` or `-N` with `min` or `h` | Elapsed minutes or hours |
| `+N` or `-N` with `d`, `w`, `mo`, `y` | Calendar days, weeks, months, or years in the zone |
| `+N` or `-N` with `bd` | Business days of the slot's [calendar](/writing-workflows/business-calendars) |
| `hour_start`, `day_start`, `week_start`, `month_start`, `year_start` | The start of that unit; weeks start on Monday |
| `bd_or_next`, `bd_or_prev` | The same day when it is a business day, else the next or previous one |

- A day shift keeps the wall-clock time across a daylight saving change, and a month shift clamps to the last day of a shorter month: March 31 minus one month is the last day of February.
- `m` is rejected, so a month never silently becomes a minute: write `min` or `mo`.
- `[month_start, +1mo, -1d, bd_or_prev]` is the last business day of the month.

## Formats

`date` (`2026-11-09`), `date_compact` (`20261109`), `datetime` (`2026-11-09 02:00:00`), `rfc3339` (`2026-11-09T02:00:00+09:00`), `unix` (`1794157200`), or a strftime pattern such as `%Y/%m/%d`. An unknown directive fails `dagu validate`.

## Lists

`{ each: 1d }` lists the window from `interval_start` up to, but not including, the slot, as a JSON array. Monday's run of a weekday schedule owns the window from Friday, so its `window_days` is Friday, Saturday, and Sunday. Load one day per child with `parallel`:

```yaml
steps:
  - id: per_day
    action: dag.run
    with:
      dag: load_day
      params:
        DAY: ${ITEM}
    parallel: ${dates.window_days}
```

- `1bd` lists the business days. A step under one day, such as `1h`, needs a `format`.
- A list holds at most 1,000 values, the `parallel` limit.

## Time Zones

An entry is shifted and formatted in its `timezone`, else the zone of the entry it builds on, else the zone of the slot's schedule (`context.run.timezone`), else the server's `tz`.

## Business Days

`bd`, `bd_or_next`, and `bd_or_prev` use the calendar of the schedule entry that fires the slot, its own or the DAG's. A sub-DAG uses the DAG's `calendar`. `dagu validate` fails when a recurring start schedule has no calendar.

## Where Dates Resolve

- A run resolves its dates once, when it is created, and records them. A retry reads the recorded dates, even after the DAG or its calendar changed.
- `${dates.NAME}` resolves wherever `${params.NAME}` does, including `env`, except in the fields that resolve while the DAG loads: `consts`, `params[].eval`, and the map form of `worker_selector`. Pass a date to a script through `env`.
- A sub-DAG resolves its own `dates` from its parent's slot.
- A run started without a slot, by hand, from a webhook, from a [watched folder](/writing-workflows/watched-folders), or as a sub-DAG of a parent with none, gets the **default slot**: the latest fire at or before it was created. A monthly load started on the 15th loads what its run of the 1st loaded. The run counts as that slot's run and records that the slot was the default.
- On a DAG without a recurring schedule, `scheduled_at` is the minute the run was created, and a date that needs a window, from `interval_start` or `next_scheduled_at`, or a list, is refused before the run is created. `dagu validate` warns about such a date.
- `dagu validate` reports a `${dates.NAME}` the DAG does not declare.

## Previewing Dates

- `dagu dry --scheduled-at 2026-11-09 etl.yaml` prints the slot, its window, and the dates the real run of that slot records; with no `--scheduled-at` it takes the default slot.
- `dagu calendar fires etl.yaml` lists the dates beside each upcoming fire.
- `dagu start` and `dagu enqueue` print the slot and dates of the run they create.
- The run dialog of a DAG with `dates` shows the slot the run would get, its window, and its dates, and updates them as **Scheduled at** or **Profile** changes. When a date cannot resolve, it shows the reason and holds **Start** and **Enqueue**.
- The upcoming runs in `GET /api/v1/dags/{fileName}` list the dates each run will get. The MCP `dag` read returns them as `upcomingRunDates`.
- `GET /api/v1/dags/{fileName}/slot-preview?scheduledAt=2026-11-09` returns the slot a start would get, its window, and its dates, without starting a run. With no `scheduledAt`, it previews the default slot.
- A run's details, and the MCP `run` read, show the dates it recorded and whether its slot was the default.

