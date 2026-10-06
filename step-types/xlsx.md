| `quote.xlsx Sheet1: the listing of Sheet1!A1:H600 is 412 KB, more than 200 KB; set range to the part of the sheet that holds the fields` | The listing of the sheet is too long to fit a model context. | Set `range` to the area of the form. |
---
description: Read, write, validate, and convert .xlsx workbooks with the xlsx actions, fill templates, manage sheets, and write results back to the rows they came from, without a spreadsheet application.
---

# XLSX

Read and write Excel workbooks from workflow steps without Excel, a script, or a spreadsheet library, on any platform. The pattern a per-row job needs is built in: read the rows still to do, act on each, and write each row's result back to the row it came from.

| Action | Use it to |
|--------|-----------|
| `xlsx.read` | Read the rows of a sheet, range, named range, or table as typed objects. |
| `xlsx.info` | Describe a workbook: sheets, headers, column types, a profile of each column, row counts, tables, named ranges. |
| `xlsx.list_sheets` | List the sheet names in order. |
| `xlsx.write` | Create a workbook, or replace or extend a sheet, from rows or a file. |
| `xlsx.append` | Add rows below the last used row. |
| `xlsx.update_rows` | Write columns back to rows selected by a key column or row number. |
| `xlsx.validate` | Check a sheet against rules and publish every problem. |
| `xlsx.write_cells` | Fill named cells of a template, in place or into a copy. |
| `xlsx.sheet` | Add, copy, rename, or delete a sheet. |
| `xlsx.convert` | Export a sheet to CSV, JSON, or JSON Lines. |
| `xlsx.extract` | Read fields out of a form-like sheet: a model names the cells, the engine reads their values. |

Only `.xlsx` and `.xlsm` workbooks are accepted; another extension fails with `only .xlsx and .xlsm workbooks are supported; save as .xlsx`. Paths resolve as in [file actions](/step-types/file): relative paths from the step working directory, absolute and `~` paths as written. A `password` opens a protected workbook. Charts, images, formatting, and formulas the actions do not touch are preserved on save.

The outputs of every xlsx action are fixed. Read them as `${steps.<id>.outputs.<name>}`; declaring `output:` or `outputs:` on an xlsx step fails validation.

## Quick Start

Read the orders that have no status yet, submit each one, and mark the rows that succeeded:

```yaml
steps:
  - id: read
    action: xlsx.read
    with:
      path: ~/Inbox/orders.xlsx
      sheet: Orders
      where: {Status: ""}

  - id: each
    depends: read
    foreach:
      items: ${steps.read.outputs.rows}
      key: ${foreach.item.order_id}
      steps:
        - id: submit
          action: http.request
          with:
            method: POST
            url: https://erp.example.com/orders
            body: ${foreach.item}
            format: json
      collect:
        order_id: ${foreach.item.order_id}
        status: ${steps.submit.outputs.status_code}
    output: RESULTS

  - id: mark
    depends: each
    action: xlsx.update_rows
    with:
      path: ~/Inbox/orders.xlsx
      sheet: Orders
      key: order_id
      rows: ${RESULTS}
      set:
        Status: status
      wait_for_unlock: 5m
```

`where` keeps only the rows still to do. The loop's `collect` builds one object per row with the key and the result; a string-form `output: RESULTS` is the variable `${RESULTS}`, and `update_rows` takes that aggregate directly, writing back the objects of the items that succeeded. When a submission fails, the loop is partially succeeded rather than failed: the write-back still runs, the rows that did succeed are marked, the failed rows keep an empty status so the next run submits only them, and the run ends partially succeeded. `wait_for_unlock` retries while someone has the workbook open in Excel.

## Looking at a Workbook First

Before writing a workflow for a workbook, learn its sheets, headers, column types, and what each column holds:

```bash
dagu xlsx inspect orders.xlsx
dagu xlsx read orders.xlsx --sheet Orders --columns "Invoice No,Amount" --format json
```

`inspect` prints what `xlsx.info` publishes plus a few typed sample rows per sheet; `read` prints what `xlsx.read` publishes. Both read the file directly and create no run. See the [CLI reference](/getting-started/cli#xlsx-inspect). An MCP client can do the same through the `dagu_read` tool's [`workbook` target](/mcp/tools#dagu-read).

`xlsx.info` publishes `path`, `date_system`, `sheets` (each with `name`, `used_range`, `range`, `header_row`, `headers`, `types`, `row_count`, `columns`, `profile_truncated`, and `tables`), `named_ranges`, and `warnings`. `xlsx.list_sheets` publishes `sheets` and `count`.

`types` and `columns` come from every data row of the detected table, up to 5000; when the table holds more, `profile_truncated` is `true`. A column's type is the kind most of its cells hold: a column mixing integers and decimals is `number`, one mixing dates and datetimes `datetime`, and an empty column `string`. `columns` profiles each column in header order:

| Field | Meaning |
|-------|---------|
| `name`, `type` | The header and its entry in `types`. |
| `filled`, `blank` | Cells that hold a value, and cells that are empty or hold only white space. |
| `distinct` | Distinct values, compared as trimmed text, counted up to 1000. |
| `values` | The distinct values in order of first appearance, when there are 12 or fewer and one repeats, so a column of unique identifiers lists none. A value longer than 40 characters is cut to 40 ending in `…`. |
| `min`, `max` | The lowest and highest number of an `integer` or `number` column, or date of a `date` or `datetime` column, over the cells that read as that type the way `types` reads them, so `１２` counts as 12. |
| `odd` | Cells holding a value the column's type cannot read even when pinned with `types`, such as `未定` in a number column. `１２`, `三千`, and `令和8年10月3日` read under their type and are not odd; a `string` column has none. |
| `odd_cells` | The first three odd cells as `{cell, text}`, such as `{"cell": "D300", "text": "未定"}`, the text cut like a value. |

`values`, `min`, `max`, `odd`, and `odd_cells` are absent when there is nothing to report. `inspect` prints the profile after each column name:

```text
Columns: 状態 (string: 済, 未; 40 blank), 数量 (number; 1..250; 1 odd: D300 "未定")
```

The profile answers what a few sample rows cannot: `values` gives the exact text to filter on in `where`, such as `{状態: ""}` for the rows still to do, and `odd` names the cells that would fail a read pinning that column's type, to fix in the workbook first or to read with `on_type_error: warn`. A sheet reports its first 20 read warnings, such as `Sheet1: Sheet1!B3: error cell #N/A`, then `Sheet1: 380 more warnings`.

## Reading Rows

`xlsx.read` publishes `rows`, a list of objects keyed by header, each with `_row`, its 1-based sheet row number; `count`; `headers`; `sheet`; `range`, the cells that were read, such as `Orders!A1:F148`; `warnings`; and `truncated`.

### Where the Data Is

| Field | Description |
|-------|-------------|
| `sheet` | The sheet, the first by default. Names match exactly, then case-insensitively when that is unique. |
| `range` | `A2:F200`, `A2:F` or `A:F` (open end at the last used row), a single cell, `Sheet1!A2:F` or `'My Sheet'!A2:F` (the sheet in the range wins over `sheet`), a defined name, or a table name. |
| `header` | `true` (default): the first row of the range names the columns. `false`: columns are named `A`, `B`, `C`. A row number, or a list such as `[3, 4]` whose cells are joined with a space, so `Amount` merged over `Net` and `Tax` yields `Amount Net` and `Amount Tax`. |
| `columns` | Columns to keep, in order: names, or `{Invoice No: invoice_no}` entries to rename. A name that matches no header fails the step listing the headers present. |
| `merged` | `fill` (default): a merged value is read in every cell it covers. `first`: only in the top-left cell. |

Without `range`, the data block is detected: leading empty rows and columns are skipped, the header is the first row with two or more non-empty cells, and the block extends to the last non-empty row and column. Header text is trimmed, line breaks become spaces, an empty header becomes the column letter with a warning, and a duplicate gets a `_2` suffix with a warning.

### How Cells Become Values

| Cell | Value |
|------|-------|
| Number | A JSON number. Integral values within 2^53 are integers. |
| Number with a date, time, or date-time format | ISO 8601 text: `2026-10-01`, `15:04:05`, or `2026-10-01T14:30:00`. Built-in and custom date formats count, including ones such as `yyyy"年"m"月"d"日"`; elapsed time such as `[h]:mm` stays a number. The 1900 and 1904 date systems are honored. |
| Text, including text-formatted numbers | A string, so leading zeros survive. `trim: true` removes surrounding white space, including the full-width space. |
| Text under a pinned `number`, `integer`, `date`, `datetime`, or `boolean` | Japanese forms are read. Amounts: full-width digits, `￥123,000`, `123,000円`, `¥123,000-`, `▲1,000`, `(1,000)`, `10%`, `税込1,000`, `1,000（税込）`, `12万3,500円`, `1.5億`, `金壱拾弐万参千円也`. Dates: `2026年10月3日`, `二〇二六年十月三日`, `2026.10.3`, `令和8年10月3日`, `R8.10.3`, `㋿8.10.3`, a month alone (`2026年10月`) as its first day, a month and day with no year (`10月3日`) in the current year of the host, a weekday mark dropped, and a time of day after the date (`14:30`, `14時30分`, `午後2時30分`). Yes/no under `boolean`: `はい`/`いいえ`, `有`/`無`, `済`/`未`, `可`/`否`, `○`/`×`, check marks and boxes, a dash for none. Text outside these forms fails the type with the text quoted. The spec lists every form. |
| Boolean | `true` or `false`. |
| Formula | Its cached value. `formulas: text` yields the formula with its `=`; `formulas: calculate` evaluates it. A formula without a cached value is evaluated with a warning. |
| Error such as `#N/A` | `null`, with a warning naming the cell. |
| Empty | `null`. Trailing rows whose cells are all empty are dropped unless `keep_empty_rows: true`. |

`types` pins columns to `string`, `number`, `integer`, `boolean`, `date`, or `datetime`. A cell that cannot convert fails the step naming the cell, as `orders.xlsx Orders!D17: expected number, found "N/A"`; with `on_type_error: warn` it becomes `null` with a warning instead.

### Filtering and Limits

`where` keeps rows. A scalar matches equal values, `""` matches empty cells, `{ne: v}` excludes a value, and `{in: [a, b]}` matches a list. Numbers compare numerically and everything else as trimmed text. Keys may use the header as written, a loose match, or a `columns` alias.

```yaml
with:
  path: orders.xlsx
  where:
    Status: {ne: Done}
    Region: {in: [East, West]}
```

`stop_at_blank: true` stops at the first row whose values are all empty. `max_rows` (default `5000`) caps the rows that hold a value; reaching it sets `truncated` with a warning only when more rows remain. Rows that do not fit the step output budget are left out from the end, also with `truncated`. For a sheet larger than that, use [`xlsx.convert`](#exporting-a-sheet), which writes every row to a file.

## Writing Rows

`xlsx.write` takes `rows`, a list of objects or arrays and usually `${steps.<id>.outputs.rows}`, or `input`, a `.json` array, a `.jsonl` file, or a `.csv` file with a header line, with `format` overriding the extension. A missing workbook is created, a missing sheet is added, and an existing sheet is replaced (`mode: replace`, the default) or extended (`mode: append`). Other sheets, column widths, styles, and defined names are untouched, and formulas on other sheets that refer to the replaced sheet stay valid.

```yaml
steps:
  - id: totals
    action: postgres.query
    with:
      dsn: ${env.REPORTING_DSN}
      query: select customer, sum(amount) as total from orders group by customer

  - id: report
    depends: totals
    action: xlsx.write
    with:
      path: reports/${context.attempt.started_at}.xlsx
      sheet: Totals
      rows: ${steps.totals.outputs.rows}
      columns: [customer, total]
      types: {total: number}
      artifact: true
```

- Objects decoded from a step output arrive with their keys in alphabetical order, so pass `columns` to order a new or replaced sheet, for example `columns: ${steps.<id>.outputs.headers}` to keep the order of a sheet that was read. An append onto a sheet that already has rows places each field under the header cell of the same name, so key order does not matter there. A `_row` field is never written.
- Values are written by type: numbers as numbers, booleans as booleans, `2026-10-01` and `2026-10-01T14:30:00` strings as dates, other strings as text. `types` pins a column: `number` and `date` convert strings, `string` keeps ISO-looking text as text.
- `style: table` (default) gives a new or replaced sheet a bold header on a light fill, frozen panes below it, fitted column widths, and number formats by column: dates `yyyy-mm-dd`, decimals with two places, text `@`. `style: none` writes bare cells.
- `xlsx.append`, and `mode: append`, write below the last used row with no header, and each new cell copies the style of the cell above it, so a date column stays a date column. An append that starts an empty sheet writes the header, so the first run creates the table.
- Appended fields are matched to the header row by exact name: a name the header has only loosely, differing in case or spacing, fails with `column "amount" not found in header row 1; did you mean "Amount"?`; a name the header lacks adds a column at the right, counted in `columns_added`; header columns no field carries stay empty. Array rows have no names and are written by position. `header: false` says the sheet has no header row: rows are written by position, and an empty sheet gets no header.

A CSV `input` takes `encoding` (`utf-8`, the default, `utf-8-bom`, or `shift_jis`) and `delimiter`, one character:

```yaml
steps:
  - id: import
    action: xlsx.write
    with:
      path: orders.xlsx
      sheet: Imported
      input: exports/orders.csv
      encoding: shift_jis
      delimiter: ";"
```

Both fields require `input` and a CSV format.

## Writing Results Back

`xlsx.update_rows` writes columns into existing rows. `rows` is a list of objects, each carrying the `key` column and optionally `_row`; `key` is the column that identifies a row, or `_row` to address rows by number alone; `set` maps sheet columns to what they receive:

```yaml
with:
  path: orders.xlsx
  key: order_id
  rows: ${RESULTS}
  set:
    Status: status            # a field of each row
    Reviewed: {value: "yes"}  # one literal for every row
    Code: {value: "007", type: string}   # pinned, so the zeros stay
```

A literal that is text in the canonical form of a number, such as `"100"` or `"-12.5"`, is written as a number, because a reference interpolated into `with` arrives as text; `type` pins it the way a column type does, so `{value: "007", type: string}` stays text. Without `set`, every field other than the key and `_row` goes to the column of the same name. A column the sheet lacks is added at the right of the header. `rows` also accepts the aggregate output of a `foreach` step, as in the [quick start](#quick-start): its collected objects of the items that succeeded are written.

Rows are matched by `_row` when present, else by the key column, with keys compared as trimmed text so `7` and `"7"` match. A key found at two rows is an error. A key not found does what `missing` says: `fail` (default), `skip` with a warning, or `append` below the last used row, copying the styles of the row above.

Only the columns in `set` change. A row that does not carry a mapped field leaves that cell alone; an explicit `null` empties it. A cell that already holds the value is not counted as a change, and the number `7` and the text `7` are different values.

Two checks run before any cell is written, and either failure leaves the workbook untouched:

1. The key column and every `set` column that already exists must still be in the header row by exact name. A header that matches only ignoring case or spacing is reported with `did you mean "Status"?`.
2. A row carrying `_row` must still hold its key at that row. A sheet that was sorted or had rows inserted since it was read fails with `expected key "INV-17", found "INV-18"; the sheet changed since it was read`.

## Validating a Workbook

`xlsx.validate` checks a sheet before a workflow acts on it. It reads the sheet the way `xlsx.read` does (`sheet`, `range`, `header`, `columns`, `merged`, `trim`, `formulas`) and applies rules to every non-empty row. At least one rule is required.

| Rule | Checks that |
|------|-------------|
| `required: [Invoice No, Amount]` | The header row has these columns. |
| `not_blank: [Customer]` | No row leaves these columns empty. Rows whose cells are all empty are skipped. |
| `unique: [Invoice No]` | Values in these columns do not repeat. Empty cells are skipped. |
| `types: {Amount: number, Due: date}` | Every cell converts to the column's type. |
| `allowed: {Status: [Open, Done]}` | Cells hold one of the listed values. Empty cells are skipped. |

Names in the rules match a header exactly, loosely, or through a `columns` alias. Every failed check is one problem with a `code`, the `sheet`, the `cell` and `row` (absent for a missing column), the `column`, and a `message`:

| Code | Example message |
|------|-----------------|
| `missing_column` | `column "Due" not found; headers present: Invoice No, Amount, Status`. The rule is skipped. |
| `blank` | `Customer is blank` |
| `type` | `expected number, found "N/A"` |
| `duplicate` | `duplicate value "INV-1"; first at row 5` |
| `not_allowed` | `value "Pending" is not one of Open, Done` |

The step publishes `ok`, `problems`, `count` (every problem found), `rows` (the rows checked), `headers`, `sheet`, `range`, `warnings`, and `truncated`. `problems` keeps at most `max_problems` (default `1000`) while `count` counts them all. Each problem is also written to the step log as `problem: Orders!D17: expected number, found "N/A"`.

By default the step succeeds with the problems published (`on_problem: warn`). With `on_problem: fail` it fails after listing them, with `2 problems found in orders.xlsx Orders`; a failed step publishes no outputs, so a workflow that must act on the problems keeps the default.

To stop and ask someone when a workbook has problems, follow the validation with a [human task](/writing-workflows/human-tasks) gated on the count, and let the workflow continue past the task when it is skipped:

```yaml
steps:
  - id: check
    action: xlsx.validate
    with:
      path: orders.xlsx
      required: [Invoice No, Amount]
      not_blank: [Customer]
      allowed: {Status: [Open, Done]}

  - id: review
    depends: check
    action: human.task
    preconditions:
      - condition: "${steps.check.outputs.count}"
        expected: "num:>0"
    continue_on:
      skipped: true
    with:
      prompt: Fix the problems in orders.xlsx and continue

  - id: process
    depends: review
    action: xlsx.read
    with:
      path: orders.xlsx
```

With no problems the task is skipped and the run goes on; with problems the run waits until the task is completed, then continues.

## Filling a Template

`xlsx.write_cells` writes into named cells of an existing workbook, the way a template is filled. `cells` maps addresses to what they receive:

```yaml
with:
  path: templates/invoice.xlsx
  output: out/invoice-1042.xlsx
  cells:
    Customer: Acme              # a defined name that refers to one cell
    B2: 2026-10-01              # an ISO date becomes a date
    Sheet1!B7: 1250
    "'Notes'!A1": {value: "007", type: string}   # pinned, so it stays text
    B9: {formula: "=B7*1.1"}
    B10: null                   # empties the cell and removes its formula
```

- An address is a cell such as `B2`, `Sheet1!B2`, or `'My Sheet'!B2`, or a defined name that refers to one cell. An address without a sheet uses `sheet`, the first sheet by default. A range, a named range, or a table is refused, and so are two addresses that name the same cell, such as `B3` and `$B$3`.
- An ISO date string becomes a date, and text in the canonical form of a number, `100` or `-12.5` but not `007`, `1,234`, or `1e3`, becomes a number, so `${foreach.item.amount}`, which arrives as text, lands as a number a formula can use; `{value: "100", type: string}` keeps such text as text.
- Every cell keeps its style, and a date written into a plain cell gains a date format. A cell that already holds the value, or the formula, is not a change.
- The workbook must exist, since a template fill needs a template; `xlsx.write` creates workbooks. With `output`, the result is written to that file and the workbook at `path` is left as it was, so one template serves many fills. `output` must be a different file from `path`.
- `changes` reports `cells_changed`, `rows_updated` as the distinct rows a changed cell was on, and `sheet` and `range` as the bounding box of the cells changed on the default sheet. With `output`, the `path` and `artifact` outputs name the file written.

Fill one invoice per order and keep the copies with the run:

```yaml
steps:
  - id: orders
    action: xlsx.read
    with:
      path: orders.xlsx
      columns: [{Invoice No: invoice}, {Customer: customer}, {Amount: amount}]

  - id: each
    depends: orders
    foreach:
      items: ${steps.orders.outputs.rows}
      key: ${foreach.item.invoice}
      steps:
        - id: fill
          action: xlsx.write_cells
          with:
            path: templates/invoice.xlsx
            output: out/invoice-${foreach.item.invoice}.xlsx
            cells:
              Customer: ${foreach.item.customer}
              B7: ${foreach.item.amount}
              B9: {formula: "=B7*1.1"}
            artifact: true
```

To merge cells first, so a title can span the filled template, list the ranges in `merge`; an address inside a merged range then writes its top-left cell, and `changes.merged` counts the ranges newly merged. A range already merged is left as it is. A range that overlaps another merged region, or that covers a filled cell other than its top-left, fails the step, since Excel keeps only the top-left value of a merged cell; clear the cell in an earlier step.

```yaml
steps:
  - action: xlsx.write_cells
    with:
      path: quote.xlsx
      merge: [A1:D1]
      cells:
        A1: 御見積書
        B3: Q-2026-001
```

## Managing Sheets

`xlsx.sheet` runs one `operation` on a workbook that must exist:

| `operation` | Effect | Fields |
|-------------|--------|--------|
| `add` | Create the empty sheet named `sheet`. | `if_exists`, `position` |
| `copy` | Duplicate `sheet` as `to`, right after its source by default. | `to`, `if_exists`, `missing`, `position` |
| `rename` | Give `sheet` the name `to`. | `to`, `if_exists`, `missing` |
| `delete` | Remove `sheet`. The only sheet of a workbook cannot be deleted. | `missing` |

A rerun must be safe, so the modes say what happens when the workbook is not as expected. `if_exists` applies to the sheet `add`, `copy`, and `rename` would create: `fail` (default), `skip` with a warning and nothing changed, or `replace`. `missing` applies to the sheet `copy`, `rename`, and `delete` start from: `fail` (default) or `skip` with a warning. `position` places the sheet `add` or `copy` creates, 1-based.

The step publishes the writer outputs plus `sheets`, the sheet names afterwards, and `skipped`. Start a new month from a template sheet, safe to run twice:

```yaml
steps:
  - id: query
    action: postgres.query
    with:
      dsn: ${env.REPORTING_DSN}
      query: select item, amount from expenses where month = '${params.MONTH}'

  - id: month
    action: xlsx.sheet
    with:
      path: report.xlsx
      operation: copy
      sheet: Template
      to: ${params.MONTH}
      if_exists: skip

  - id: fill
    depends: [query, month]
    action: xlsx.write
    with:
      path: report.xlsx
      sheet: ${params.MONTH}
      mode: append
      rows: ${steps.query.outputs.rows}
```

Three limits of the underlying library: a rename does not rewrite formulas on other sheets that name the sheet, though defined names follow it; a delete leaves such references dangling and drops the names scoped to the sheet; and a copy carries cells, styles, widths, merged regions, and validations, but not tables, images, charts, or page setup.

## Exporting a Sheet

`xlsx.convert` writes the rows of a sheet to the file named by `output`, as CSV, JSON, or JSON Lines by the file's extension (`.csv`, `.json`, `.jsonl` or `.ndjson`) or by `format`. It reads the way `xlsx.read` does (`sheet`, `range`, `header`, `columns`, `types`, `trim`, `merged`, `formulas`), but writes every row with no cap, and a cell that fails a pinned type fails the step. Columns follow the header order, or `columns`; `_row` is not written. CSV cells are text as a reader would show them, with dates in ISO form; JSON keeps the typed values.

```yaml
steps:
  - id: export
    action: xlsx.convert
    with:
      path: orders.xlsx
      sheet: Orders
      output: out/orders.csv
      encoding: shift_jis
      columns: [品名, 数量, 金額]
```

For CSV, `encoding` is `utf-8` (default, no byte order mark), `utf-8-bom` so that Excel opens the file as UTF-8 by double click, or `shift_jis` as Windows uses it (code page 932; `cp932`, `windows-31j`, `sjis`, and `ms932` are accepted spellings), and `delimiter` is one character, a comma by default. The file is written through a temporary file and renamed into place. The step publishes `path`, `format`, `count`, `sheet`, `range`, `warnings`, and with `artifact: true` the copy's path as `artifact`. The other direction, a file into a workbook, is [`xlsx.write` with `input`](#writing-rows).

## Extracting Fields from a Form

Not every workbook is a table. A supplier's quote, an order, or an application is often a form on a grid, with labels and values scattered and a different layout for every sender. `xlsx.extract` reads such a sheet: `instruction` says what to find, `schema` names the fields, a model is asked which cell holds each field, and the step reads the typed value from that cell.

```yaml
llm:
  provider: anthropic
  model: claude-sonnet-5
  api_key_name: ANTHROPIC_API_KEY

steps:
  - id: fields
    action: xlsx.extract
    with:
      path: inbox/${params.FILE}
      instruction: A supplier's quote. Find the quote number, the delivery date, and the total amount.
      schema:
        type: object
        properties:
          quote_no: {type: string, description: 見積番号}
          delivery: {type: string, format: date, description: 納期}
          total: {type: number, description: 合計金額}

  - id: record
    depends: fields
    action: xlsx.append
    with:
      path: quotes.xlsx
      sheet: Quotes
      rows: '[{"quote_no": "${steps.fields.outputs.quote_no}", "delivery": "${steps.fields.outputs.delivery}", "total": ${steps.fields.outputs.total}}]'
```

- **The model returns addresses, never values.** It is shown the sheet's non-empty cells, one per line as `B3 [text,bold]: 見積番号` with the address, the kind (`text`, `number`, `date`, `datetime`, `time`, `bool`), `bold` and `fill` hints, and the text cut to 200 characters, and it answers with the address of each field's cell, or `null` for a field the sheet lacks. The engine reads the value from that cell with the usual typing, so no number is invented and every output has a cell behind it. A property's `type` pins the cell (`number`, `integer`, `boolean`, `string`, `string` with `format: date` or `date-time`); a `description` in the sheet's own language helps the model find the label.
- **Outputs** are each property, `cells` (property to the `Sheet1!B7` it was read from, empty when absent), `sheet`, `warnings`, and `source`, `model` or `cache`. An empty cell or an absent field is null.
- **What is sent.** The listed cells and the instruction, nothing else: no variables and no screenshots. `send_values: false` lists a non-text cell as its kind only, `B7 [number]`, so amounts and dates stay on the host. A sheet with more than 2000 cells, or whose listing is longer than 200 KB, is refused before any request; set `range` to the part that holds the fields. An instruction holding the value of a declared secret fails the step before any request, and secret values are masked in the text sent.
- **Repeated layouts need no model call.** The model also names the cells that are labels, and the answered addresses are cached by the sheet's shape, which cells hold something, their kinds and emphasis, and the merged regions, with a digest of each label. A second quote from the same supplier in the same template is read from the cache, and so is one that leaves an optional box blank, since its labels still hold and it lists no cell the recording did not see. A layout no recording serves, a renamed or moved label, a changed instruction, or a schema with a new field asks the model again. An entry is kept only when the step succeeds. `cache: false` asks every run, and `dagu xlsx cache clear <dag>` drops the entries.
- The step uses the DAG-level `llm` block or `with.llm`, which replaces it, as [browser steps](/step-types/browser) do. `dagu dry` checks that the workbook and sheet exist, nothing about the model.

## Saving Safely

Every writer (`write`, `append`, `update_rows`, `write_cells`, `sheet`) publishes `path`, `sheet`, `changes`, `dry_run`, and `warnings`:

```json
{"sheet": "Orders", "range": "Orders!A2:F148", "rows_updated": 147,
 "rows_appended": 0, "columns_added": 1, "cells_changed": 294}
```

| Field | Description |
|-------|-------------|
| `dry_run` | `true` computes the same change summary and saves nothing. |
| `atomic` | `true` (default) writes a temporary file beside the workbook and renames it over the target, so a crash never leaves a half-written workbook. `false` saves in place. |
| `wait_for_unlock` | How long to retry a workbook another program holds open, such as `5m`, waiting two seconds and doubling to one minute between tries. Without it the step fails at once. |
| `artifact` | `true` keeps a copy of the saved workbook, or of the converted file, under `xlsx/<step id>/` in the run's [artifacts](/writing-workflows/artifacts) and publishes its path as `artifact`. It enables artifact storage for the DAG. A copy that fails after the save is a warning, not a failed step, so a retry does not repeat the write. |

Excel's `~$name.xlsx` lock file is checked before a write. A lock file another process still holds, which on Windows means Excel has the workbook open, fails the step with `orders.xlsx is open in another program; close it and retry`; a lock file nobody holds is a leftover of a crash, so the step warns and continues.

Preview what an append would change, then do it:

```yaml
steps:
  - id: preview
    action: xlsx.append
    with:
      path: log.xlsx
      rows: ${params.ROWS}
      dry_run: true

  - id: append
    depends: preview
    action: xlsx.append
    with:
      path: log.xlsx
      rows: ${params.ROWS}
```

## Checking a Workflow Before It Runs

`dagu validate` rejects an xlsx step whose fields do not fit its action: a missing `path`, `rows` and `input` together, a validation without rules, `write_cells` without `cells`, a `sheet` operation without `operation` or `sheet`, `convert` without `output`, a field another action owns such as `range` on `xlsx.info`, a value outside its enum, or declared outputs.

[`dagu dry`](/getting-started/cli#dry) goes further and warns, without failing, when a step would fail on this host: the workbook of a reading, validating, converting, updating, cell-writing, or sheet step does not exist; the sheet named is not in it; a column named in `columns`, `types`, `where`, a validation rule, the `key`, or `set` is not in the header row; or the `input` file of `write` or `append` is missing. The warning names the field:

```text
Dry run: step may fail on this host
  field 'with.sheet': orders.xlsx: sheet "Order" not found; sheets present: Orders, Summary
```

A field that still holds a reference to a step output is skipped, since no step has run; params and environment variables resolve.

## Fields

| Field | Actions | Description |
|-------|---------|-------------|
| `path` | all | The workbook. Required. |
| `password` | all | Password of a protected workbook. |
| `sheet` | all but `info`, `list_sheets` | The sheet; the first by default. For `sheet`, the sheet operated on. |
| `range` | `read`, `validate`, `convert` | Cells to read. See [Where the Data Is](#where-the-data-is). |
| `header` | `read`, `write`, `append`, `update_rows`, `validate`, `convert` | `true`, `false`, a row number, or a list of row numbers. On `append` and `mode: append`, `false` means the sheet has no header row and rows are written by position. |
| `columns` | `read`, `write`, `append`, `validate`, `convert` | Columns to keep and their order, with optional `{name: alias}` renames. |
| `merged` | `read`, `validate`, `convert` | `fill` or `first`. |
| `trim` | `read`, `validate`, `convert` | Trim text cells. |
| `formulas` | `read`, `validate`, `convert` | `cached`, `text`, or `calculate`. |
| `types` | `read`, `write`, `append`, `validate`, `convert` | Column types: `string`, `number`, `integer`, `boolean`, `date`, `datetime`. |
| `on_type_error` | `read` | `fail` (default) or `warn`. |
| `where` | `read` | Row filter. |
| `max_rows` | `read` | Most rows to read. Defaults to `5000`. |
| `stop_at_blank`, `keep_empty_rows` | `read` | Stop at the first empty row; keep trailing empty rows. |
| `rows` | `write`, `append`, `update_rows` | Rows to write, or the aggregate output of a `foreach` step for `update_rows`. |
| `input` | `write`, `append` | A `.json`, `.jsonl`, or `.csv` file to write instead of `rows`. |
| `format` | `write`, `append`, `convert` | File format when the extension does not say. |
| `encoding`, `delimiter` | `write`, `append`, `convert` | CSV encoding and delimiter. |
| `mode` | `write` | `replace` (default) or `append`. |
| `style` | `write` | `table` (default) or `none`. |
| `key` | `update_rows` | The column that identifies a row, or `_row`. Required. |
| `set` | `update_rows` | Columns to write, from row fields or literals; a literal takes `{value: v, type: t}` to pin its type. |
| `missing` | `update_rows`, `sheet` | `fail`, `skip`, or `append` for a key not found; `fail` or `skip` for a sheet not found. |
| `required`, `not_blank`, `unique`, `allowed` | `validate` | The rules. See [Validating a Workbook](#validating-a-workbook). |
| `on_problem` | `validate` | `warn` (default) or `fail`. |
| `max_problems` | `validate` | Problems to keep in `problems`. Defaults to `1000`. |
| `cells` | `write_cells` | Addresses and what they receive. Required. |
| `merge` | `write_cells` | Ranges to merge before the cells are written, such as `[A1:D1]`. |
| `output` | `write_cells`, `convert` | The file to write; for `write_cells`, a copy of the template. Required for `convert`. |
| `operation` | `sheet` | `add`, `copy`, `rename`, or `delete`. Required. |
| `to` | `sheet` | The new name for `copy` and `rename`. |
| `if_exists` | `sheet` | `fail`, `skip`, or `replace`. |
| `position` | `sheet` | 1-based place of the sheet `add` or `copy` creates. |
| `atomic` | writers, `convert` | Save through a temporary file. Defaults to `true`. |
| `dry_run` | writers | Report the changes and save nothing. |
| `wait_for_unlock` | writers | How long to retry a locked workbook. |
| `artifact` | writers, `convert` | Keep a copy with the run. |
| `instruction` | `extract` | What to find on the sheet. Required. |
| `schema` | `extract` | A JSON Schema with `type: object` whose properties name the fields. Required. |
| `send_values` | `extract` | Send cell values to the model. Defaults to `true`; `false` sends labels and kinds only. |
| `cache` | `extract` | Keep the answered cells by sheet layout. Defaults to `true`. |
| `llm` | `extract` | The model to ask, replacing the DAG-level `llm` block. |

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `only .xlsx and .xlsm workbooks are supported; save as .xlsx` | The path is a `.xls`, `.csv`, or `.ods` file. | Save the file as `.xlsx`. For CSV, use `xlsx.write` with `input`. |
| `orders.xlsx: workbook not found` | The path does not exist. Only `xlsx.write` and `xlsx.append` create workbooks. | Check the path; relative paths resolve from the step working directory. |
| `sheet "Order" not found; sheets present: Orders, Summary` | No sheet has that name. | Use one of the names listed; `dagu xlsx inspect` shows them. |
| `column "Nope" not found; headers present: ...` | A `columns`, `types`, `where`, or rule name matches no header. | Use the header as written, or the alias given in `columns`. |
| `orders.xlsx Orders!D17: expected number, found "N/A"` | A cell does not convert to its pinned type. | Fix the cell, remove the type, or set `on_type_error: warn` on a read. |
| `key column "Invoice" not found in header row 1; did you mean "Invoice No"?` | `update_rows` resolves the key and `set` columns by exact name. | Use the exact header. |
| `column "amount" not found in header row 1; did you mean "Amount"?` | An appended field, or a `set` column, matches a header only ignoring case or spacing. | Use the exact header, or `columns` with the header's spelling. |
| `no header row found; use header: false to append rows by position` | An append onto a sheet with rows found no header row to match names against. | Set `header: false` to write by position. |
| `Orders!A17: expected key "INV-17", found "INV-18"; the sheet changed since it was read` | Rows moved between the read and the write-back. | Run the workflow again from the read. |
| `key "INV-99" not found` | A row to update is not in the sheet and `missing` is `fail`. | Set `missing: skip` or `missing: append`. |
| `orders.xlsx is open in another program; close it and retry` | Excel holds the workbook on Windows. | Close it, or set `wait_for_unlock` so the step retries. |
| `2 problems found in orders.xlsx Orders` | `xlsx.validate` with `on_problem: fail` found problems. | Read them in the step log; keep `on_problem: warn` to act on them in the workflow. |
| `template.xlsx: "A1:B2" is not a single cell` | A `cells` address names a range, a named range, or a table. | Address one cell. |
| `report.xlsx: sheet "October" already exists` | The sheet `add`, `copy`, or `rename` would create exists and `if_exists` is `fail`. | Set `if_exists: skip` for a rerun, or `replace`. |
| `report.xlsx: cannot delete the only sheet "Sheet1"` | A workbook needs one sheet. | Add the replacement sheet first. |
| `xlsx actions have fixed outputs` | The step declares `output:` or `outputs:`. | Remove it; read the published names instead. |
| `artifact requires artifact storage` | `artifact: true` in a DAG whose artifacts are disabled. | Enable `artifacts` or drop the field. |
| `xlsx.extract needs a model: set llm at the DAG level or with.llm on the step` | No model is configured for the extract step. | Add an `llm` block to the DAG or `with.llm` to the step. |
| `quote.xlsx Sheet1: 2415 cells in Sheet1!A1:H600 is more than 2000; set range to the part of the sheet that holds the fields` | The sheet has too many non-empty cells to list for the model. | Set `range` to the area of the form. |
| `template.xlsx: merge A1:D1 overlaps merged cell Sheet1!B1:E1` | The range to merge crosses a merged region that is already there. | Merge a range that lies beside it, or unmerge the region in Excel first. |
| `template.xlsx: merge B10:D10 would discard the value of Sheet1!C10; clear it first` | A cell under the range, other than its top-left, holds something that the merge would drop. | Clear the cell with `write_cells` (`C10: null`) in an earlier step, or move the value to the top-left cell. |
| `xlsx: model answered field "total" with "H40", which is outside Sheet1!A1:D20` | The model named a cell outside the listed sheet or range. | Widen `range`, or improve the instruction and descriptions. |

## Related

- [File](/step-types/file)
- [Artifacts](/writing-workflows/artifacts)
- [Human Tasks](/writing-workflows/human-tasks)
- [Control Flow](/writing-workflows/control-flow)
- [CLI Reference](/getting-started/cli#xlsx-inspect)
- [MCP Tools](/mcp/tools#dagu-read)
