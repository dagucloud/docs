# Business Calendars

A business calendar lists the days a schedule may fire on. Name one on a start schedule to run on business days only, or add `business_days` to run on chosen business days of each month, such as the third business day or the last one.

One calendar file holds the holidays for every DAG that names it, so a holiday is added once rather than in each cron expression.

## Quick start

Create `jp-banking.yaml` in the calendars directory:

```yaml
description: Japanese bank business days
holidays:
  - 2027-01-01
  - date: 2027-01-11
    name: Coming of Age Day
through: 2027-12-31
```

Name it on the schedule of a DAG, here `payroll.yaml`:

<!-- dagu-example: no-validate; this workflow requires the jp-banking calendar file shown above -->
```yaml
calendar: jp-banking
schedule:
  - "CRON_TZ=Asia/Tokyo 0 18 * * *"          # every business day at 18:00
  - expression: "CRON_TZ=Asia/Tokyo 0 23 * * *"
    business_days: [3, -1]                    # 3rd and last business day
steps:
  - run: ./close-books.sh
```

Check the result before the scheduler runs it:

```bash
dagu calendar fires payroll.yaml --from 2026-12-31T00:00:00+09:00 --count 9
```

```text
TIME                         SCHEDULE                       NOTE
Thu 2026-12-31 18:00 +09:00  CRON_TZ=Asia/Tokyo 0 18 * * *
Thu 2026-12-31 23:00 +09:00  CRON_TZ=Asia/Tokyo 0 23 * * *  last business day
Mon 2027-01-04 18:00 +09:00  CRON_TZ=Asia/Tokyo 0 18 * * *  skips Fri 2027-01-01
Tue 2027-01-05 18:00 +09:00  CRON_TZ=Asia/Tokyo 0 18 * * *
Wed 2027-01-06 18:00 +09:00  CRON_TZ=Asia/Tokyo 0 18 * * *
Wed 2027-01-06 23:00 +09:00  CRON_TZ=Asia/Tokyo 0 23 * * *  3rd business day
Thu 2027-01-07 18:00 +09:00  CRON_TZ=Asia/Tokyo 0 18 * * *
Fri 2027-01-08 18:00 +09:00  CRON_TZ=Asia/Tokyo 0 18 * * *
Tue 2027-01-12 18:00 +09:00  CRON_TZ=Asia/Tokyo 0 18 * * *  skips Mon 2027-01-11 (Coming of Age Day)
```

## Calendar files

A calendar is a YAML file named `<name>.yaml` in `paths.calendars_dir`. The directory defaults to `$DAGU_HOME/calendars` when `DAGU_HOME` is set, and to `~/.config/dagu/calendars` otherwise. Set `DAGU_CALENDARS_DIR` or `paths.calendars_dir` to move it. A name uses letters, digits, `-`, and `_`.

```yaml
description: Japanese bank business days
weekdays: [MON, TUE, WED, THU, FRI]
holidays:
  - 2027-01-01
  - date: 2027-01-11
    name: Coming of Age Day
  - from: 2027-12-31
    to: 2028-01-03
    name: Year-end closure
extra_business_days:
  - 2027-10-09
include: [jp-national]
through: 2027-12-31
```

| Key | Meaning |
| --- | --- |
| `description` | Text shown in listings. |
| `weekdays` | Days of the week that are business days unless they are holidays: one or more of `MON`, `TUE`, `WED`, `THU`, `FRI`, `SAT`, `SUN`, in any case. Defaults to `MON` to `FRI`. |
| `holidays` | Dates that are not business days: a `YYYY-MM-DD` date, `{date, name}`, or an inclusive range `{from, to, name}` of at most 366 days. `name` is optional. |
| `extra_business_days` | Dates that are business days whatever their weekday, even when they are also holidays. |
| `include` | Calendars whose holidays this calendar adds. Only holidays are added, not weekdays or extra business days. |
| `through` | The last date the holidays are maintained for. Optional. |

A date is a business day when it is an extra business day, or when it is not a holiday and its weekday is in `weekdays`.

### Built-in calendar

The calendar `weekdays` is built in: Monday to Friday with no holidays. It needs no file. The names `weekdays` and `none` are reserved, so a file with either name is reported as invalid.

### Shared holidays

`include` lets several calendars share one list of holidays. For example, `jp-banking` can include `jp-national` and add the bank holidays on top:

```yaml
# jp-national.yaml
holidays:
  - date: 2027-02-11
    name: National Foundation Day
```

```yaml
# jp-banking.yaml
include: [jp-national]
holidays:
  - date: 2027-12-31
    name: Bank holiday
```

An include that is missing, or a cycle of includes, makes the calendar invalid.

### Keep holidays current

`through` records how far ahead the holidays are listed. It does not change evaluation: dates after it count the weekdays alone, except for holidays the calendar or an included calendar still lists for them.

From 30 days before `through`, and after it, loading a DAG that uses the calendar reports a warning naming the calendar and the date. The Calendars page marks such a calendar with **Holidays run out**.

### Schema

The JSON schema of calendar files is served at `/assets/calendar.schema.json`, and editors that support YAML schemas can use it for completion. Print it with:

```bash
dagu schema calendar
dagu schema calendar holidays
```

The schema accepts every valid file. Only loading rejects dates that do not exist, ranges that end before they start or exceed 366 days, and includes that are missing or form a cycle.

## Schedule keys

A start schedule entry in object form accepts two more keys.

| Key | Meaning |
| --- | --- |
| `calendar` | The calendar whose business days the entry fires on, or `none`. |
| `business_days` | A list of integers from 1 to 23, or -23 to -1. The entry keeps only fires on these business days of the month: `1` is the first business day, `-1` the last. |

A DAG-level `calendar` key sets the calendar of every start schedule entry that names none, plain strings included. A [base config](/server-admin/base-config) may set it for every DAG. An entry with `calendar: none` has no calendar.

```yaml
calendar: weekdays
schedule:
  - "0 9 * * *"                  # weekdays at 09:00
  - expression: "0 18 * * *"
    business_days: [-1]          # last weekday of the month at 18:00
  - expression: "0 3 * * *"
    calendar: none               # every day at 03:00
steps:
  - run: echo scheduled
```

`business_days` needs a calendar, and the expression's day-of-month and day-of-week fields must be `*`, so `@every` and descriptors such as `@monthly` cannot use it. One-off (`at`) entries and stop or restart schedules take neither key.

## How fire times are chosen

The cron expression produces candidate times. A schedule with a calendar fires on the candidates whose date is a business day and, when `business_days` is set, one of the listed business days of its month. Other candidates are dropped. No fire is moved to another day.

A candidate's date is read in the zone the expression names with a `TZ=` or `CRON_TZ=` prefix, otherwise in the zone schedules are evaluated in (`core.tz`).

The scheduler, catch-up, `dagu ls -n`, `dagu calendar fires`, and the upcoming runs in the Web UI all follow this rule. When a calendar file changes, the scheduler reloads the DAGs that use it, so the next fire follows the new holidays.

A schedule whose calendar cannot be loaded never fires. When a schedule cannot fire within five years, such as a Saturday expression on the `weekdays` calendar, loading the DAG reports a warning naming the expression and the calendar.

## Preview and check

### Upcoming runs

The **Cron** launcher on the workflow canvas lists the next runs of the start schedules as you edit them. A run placed by a calendar says why: the business day it matched (`business day 3 of the month`, `last business day of the month`), `extra business day`, or the holidays it skipped. The launcher links each calendar the schedules use to its page, and says when a suspended DAG or a paused scheduler holds the runs.

DAG details in the REST API carry the same list as `upcomingRuns`.

### `dagu calendar fires`

```bash
dagu calendar fires <DAG> [--from <RFC 3339 time>] [--count <n>]
```

Lists the next fires of a DAG's start schedules, ten by default, with the business day each one matched and the holidays it skipped. `--from` sets only where the listing starts; schedules without a time zone prefix are still evaluated in `core.tz`.

### `dagu calendar check`

```bash
dagu calendar check                 # every calendar in paths.calendars_dir
dagu calendar check ./jp-banking.yaml
```

Validates calendar files, by default each `<name>.yaml` file with a valid name in `paths.calendars_dir`. A file given as a path must be named `<name>.yaml`, and its includes are read from the files beside it. Each problem is printed on its own line, starting with its `[line:column]` when it has one; a problem with an included calendar is placed on the `include` entry. The command exits non-zero when any calendar is invalid.

To check that the DAGs naming a calendar find it, run `dagu validate` on them.

## Manage calendars in the Web UI

Open **Configure > Calendars**. The list shows each calendar's description, the date its holidays are listed through, and how many DAGs use it, directly or through includes. A calendar that does not load is marked **Invalid** with its error, and one whose holidays run out within 30 days is marked **Holidays run out**.

**New calendar** creates a file from a template: Monday to Friday, no holidays yet, listed through the end of the year.

A calendar's page has:

- the YAML editor, with completion from the calendar schema and of other calendar names under `include`
- each problem marked on its line; content with problems is not saved
- a year view beside the editor that follows each edit, with business days, holidays, and extra business days in their own colors, unsaved changes ringed, and dates after `through` dimmed
- a summary of unsaved changes, such as `1 date changes · weekdays +Sat · used by 3 DAGs`
- the DAGs that use the calendar, the calendars that include it, and the calendars it includes

A calendar cannot be deleted while a DAG's start schedule uses it, directly or through a calendar that includes it, or while another calendar includes it.

The built-in `weekdays` calendar is read-only. Creating, saving, and deleting need `permissions.write_dags` and, where roles apply, the developer role or above. Calendars serve DAGs in every workspace, so the user's global role decides.

## REST API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/calendars` | List the built-in calendars and calendar files. `includeUsage=true` adds expiry warnings, includes, and DAG counts. |
| `POST /api/v1/calendars` | Create a calendar, from the template or from given content. |
| `GET /api/v1/calendars/{name}` | Get a calendar's content, its problems, and the calendars and DAGs that depend on it. |
| `PUT /api/v1/calendars/{name}` | Replace a calendar's content. Content with problems is not saved; the problems are returned. |
| `DELETE /api/v1/calendars/{name}` | Delete a calendar that nothing uses. Returns 409 otherwise. |
| `POST /api/v1/calendars/{name}/preview` | Apply unsaved content to the dates of a year and mark the dates that differ from the saved calendar. |

Writes need the same permissions as in the Web UI. The usage counts and dependents list only DAGs in workspaces the caller can see.

## Git Sync

[Git Sync](/server-admin/git-sync) syncs each `calendars/<name>.yaml` file of the repository with `paths.calendars_dir`, so calendars can be reviewed and promoted with the DAGs that use them. With `push_enabled: false`, calendar changes in the Web UI and API are refused, as DAG changes are.

## Errors

Loading a DAG fails when:

- a start schedule names a calendar that is neither built in nor a file; the message lists the available calendars
- `business_days` is set and the entry has no calendar after the DAG default applies
- `business_days` is set and the expression's day-of-month or day-of-week field is not `*`
- a `business_days` value is 0, outside -23 to 23, or listed twice
- a one-off (`at`) entry, or a stop or restart schedule, sets `calendar` or `business_days`

A calendar file fails to load on an unknown key, a malformed date, a range that ends before it starts or exceeds 366 days, an empty `weekdays` list, an unknown weekday, an include cycle, or an included calendar that does not exist.

## Related pages

- [Scheduling](/writing-workflows/scheduling)
- [YAML Specification](/writing-workflows/yaml-specification#scheduling)
- [CLI Reference](/getting-started/cli#calendar)
- [Git Sync](/server-admin/git-sync)
