# GreenOKRa

A plain-text standard for describing OKRs (Objectives and Key Results), plus a
web UI to view and edit those files.

Two parts, deliberately small:

1. **The format** — a YAML file per timeframe. Human-readable, git-diffable, no database.
2. **The editor** — a static web app. Open a file, edit it, save it back. No server.

## The format

Three nested levels:

```
Strategic Initiative (SI)     PEP, PRO, TEK — high-level grouping
  └── Objective               O1, O2 …      — qualitative goal
        └── Key Result        KR1, KR2 …    — measurable outcome
```

Everything is addressable by a dotted id — `TEK.O1.KR2` — so an OKR can be
referenced from a ticket, a Confluence page, or a meeting note and still be
found a year later.

**[SPEC.md](SPEC.md) is the full format specification.** A working example lives
in [`okrs/2026.yaml`](okrs/2026.yaml).

### Why YAML

OKRs are written and revised by people, not machines. YAML is the easiest to
hand-edit, supports comments (useful for the *why* behind a target), and
produces clean line-by-line git diffs when a status changes. A JSON Schema keeps
it honest for tooling.

### Why percentages are computed

Status is a ladder — `Not Started`, `Started`, `In Progress`, `In Completion`,
`Completed` — and each rung carries a percentage, 0 through 100 in quarters.
There is no separate progress field, so the two cannot disagree, and no rollup
is maintained by hand. `Aborted` is not a rung: it means the work no longer
counts, and it is excluded rather than scored zero. See
[Progress](SPEC.md#progress).

## Repository layout

```
okrs/                 your OKR files, one per timeframe
  2026.yaml
SPEC.md               the format specification
web/
  src/lib/okr.ts      validate, autocorrect and roll up — the whole spec, in code
  src/cli.ts          the command line front end
```

One implementation, two front ends. `okr.ts` has no Node dependencies, so the
browser editor and the command line enforce exactly the same rules — there is no
second copy of the spec to drift.

## The validator

```bash
cd web && npm install

npm run check ../okrs/2026.yaml           # validate
npm run check ../okrs/2026.yaml -- --fix  # validate and repair
npm run show  ../okrs/2026.yaml           # print the tree with progress
```

`check` reports three kinds of finding:

| | Meaning | Exit code |
|---|---|---|
| **error** | The file breaks the spec. | 1 |
| **warning** | Legal but probably not what you meant — two accountable owners, notes out of order. | 0, or 1 with `--strict` |
| **fixed** | Autocorrected. Shown as a preview; `--fix` writes it. | 0 |

### Autocorrect

Readers are lenient, writers are strict. Validation repairs what it safely can:

- `IN_PROGRESS`, `in progress`, `In-Progress` → `In Progress`
- `timeframe: 2026` → `timeframe: "2026"` (YAML reads the bare form as a number)
- `target_date: 2026-09-30` → quoted, so YAML 1.1 parsers don't read it as a date
- `tek` / `o1` / `kr1` → `TEK` / `O1` / `KR1`
- `accountable: roberto` → `accountable: [roberto]`

Repairs are written only when the file is otherwise error-free, so `--fix` never
leaves you with a half-corrected file. Comments and formatting survive: saving an
unchanged file produces a byte-identical result.

Requires Node 23.6 or newer, which runs TypeScript without a build step.

## The editor

```bash
cd web && npm install && npm run dev     # http://localhost:3000
```

A static Next.js app (Tailwind, Lucide icons, dark by default) that runs
entirely in the browser. No backend, no auth, no database, nothing uploaded.
You keep the files; git is the history.

- **Open** a `.yaml` file from disk, or load the bundled example
- **Browse** one initiative at a time — each gets a tab showing its title and
  progress, with its details at the top and its objectives below
- **Expand** a key result to see its owners, dates and review notes; collapsed,
  it shows a one-line summary with status, priority and progress
- **Edit** any field in place — click, type, tab away
- **Pick** rather than type where a free-text box would only invite drift:
  timeframes, target dates, progress in tenths, and owner names drawn from the
  names already in the file
- **Add** initiatives, objectives, key results and links
- **Save** back to the file you opened, with `⌘S`

Owners appear as coloured chips, one colour per person, so the same name is
recognisable at a glance across the file. Priority and complexity share their
values (High, Medium, Low), so each carries an icon — a flag for priority,
layers for complexity — to tell them apart without reading.

Each key result carries a clock showing whether it is overdue a review, judged
against its initiative's cadence and the date of its newest note: green while on
time, amber once the interval has passed, red beyond twice it. Finished work
shows nothing, because nothing needs reviewing after it is done.

Links show their text and hide their address, the way a markdown editor does —
opening one reveals **text shown** and **URI link** as separate fields.

Initiative and objective statuses are mostly derived: each advances from
`Not Started` to `In Progress` once work below it starts, so moving one key
result can carry up both levels. Only `Completed` and `Aborted` are offered as
choices, because only those are decisions. Either can be undone.

Everything is validated as you type, and the counter in the header opens a panel
listing errors, warnings and anything that was tidied.

### One deliberate omission

**You cannot delete an initiative, objective or key result.** Ids must stay
stable — a ticket referencing `TEK.O1.KR2` should still resolve next year.
Dropped work is set to `Aborted`, which excludes it from progress while keeping
its id. Numbering never reuses a retired id either: abort `KR2` and the next key
result is `KR3`.

Progress notes are ordinary editable fields. Re-dating one re-sorts the log, so
it stays newest-first, and clearing a note's text deletes the entry — which is
how a note written in error is removed.

### Saving in place

Chrome and Edge implement the File System Access API, so `Save` writes back to
the file you opened. Safari and Firefox don't, so the button becomes `Download`
and you get a copy. Formatting is preserved either way — comments, folded prose
and field order all survive the round trip.

Build a deployable copy with `npm run build`; the result is a plain folder of
static files.

## Status

Format spec, validator and editor: done.

## License

See [LICENSE](LICENSE).
