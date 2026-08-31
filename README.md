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

Progress is derived from Key Result status, never stored. A file cannot drift out
of sync with itself, and nobody has to maintain a rollup by hand. See
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

A static web app (Next.js, Tailwind, shadcn/ui, dark by default) that runs
entirely in the browser:

- **Open** a `.yaml` file from disk
- **View** initiatives, objectives and key results with computed progress
- **Edit** fields, statuses, and prepend progress notes
- **Save** the file back to disk, comments and field order preserved as far as possible

No backend, no auth, no database. You keep the files; git is the history.

## Status

Format spec and validator: done. Editor: next.

## License

See [LICENSE](LICENSE).
