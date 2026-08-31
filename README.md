# GreenOKRa

A plain-text standard for describing OKRs (Objectives and Key Results), plus a
web UI to view and edit those files.

Two parts, deliberately small:

1. **The format** — one YAML file per cycle. Human-readable, git-diffable, no database.
2. **The editor** — a static web app. Open a file, edit it, save it back. No server.

---

## Why YAML

OKRs are written and revised by people, not machines. YAML wins because it is the
easiest to hand-edit, supports comments (useful for the "why" behind a target),
and produces clean line-by-line git diffs when a number changes. A JSON Schema
keeps it honest for tooling.

## The format

One file per cycle, named after the cycle: `okrs/2026-Q3.yaml`.

```yaml
cycle: 2026-Q3
starts: 2026-07-01
ends: 2026-09-30

objectives:
  - id: onboarding
    title: Make onboarding effortless
    owner: roberto
    key_results:
      - title: Median time-to-first-value
        start: 45
        target: 10
        current: 22
        unit: min
```

### Top level

| Field | Required | Description |
|---|---|---|
| `cycle` | yes | Name of the period. Free text, e.g. `2026-Q3`, `H1-2026`, `Jan-2026`. |
| `starts` | no | First day of the cycle, `YYYY-MM-DD`. |
| `ends` | no | Last day of the cycle, `YYYY-MM-DD`. |
| `objectives` | yes | List of objectives. |

### Objective

| Field | Required | Description |
|---|---|---|
| `id` | yes | Short slug, unique within the file. Stable across edits — the UI keys off it. |
| `title` | yes | The objective, in plain language. Qualitative and inspirational. |
| `owner` | no | Who is accountable. Free text. |
| `notes` | no | Free-form context. Multi-line is fine. |
| `key_results` | yes | List of key results. At least one. |

### Key result

| Field | Required | Description |
|---|---|---|
| `title` | yes | What is being measured. |
| `start` | yes | Value at the beginning of the cycle (the baseline). |
| `target` | yes | Value that counts as done. |
| `current` | yes | Where it stands now. This is the field you keep updating. |
| `unit` | no | `%`, `min`, `EUR`, `users`, … Display only. |
| `notes` | no | Free-form context. |

Everything else is computed, never stored.

### Progress is derived

```
progress = (current - start) / (target - start)
```

clamped to `0…1`. This one formula covers every case:

- **Growth** — `start: 100, target: 500, current: 200` → 25%
- **Reduction** — `start: 45, target: 10, current: 22` → 66% (works because
  `target - start` is negative; no special casing)
- **Binary / done-or-not** — `start: 0, target: 1, current: 0` → 0%, flip to `1` for 100%

**Objective progress** is the unweighted mean of its key results. No weights, no
confidence scores, no check-in history — those can be added later if they earn
their keep.

`start == target` is invalid: progress would divide by zero.

## Repository layout

```
okrs/                 your OKR files, one per cycle
  2026-Q3.yaml
schema/
  okr.schema.json     JSON Schema for validation
web/                  the static viewer/editor
```

## The editor

A static web app (Next.js, Tailwind, shadcn/ui, dark by default) that runs
entirely in the browser:

- **Open** a `.yaml` file from disk
- **View** objectives with computed progress bars
- **Edit** titles, owners, and the `current` value
- **Save** the file back to disk, comments and field order preserved as far as possible

No backend, no auth, no database. You keep the files; git is the history.

## Status

Format spec: drafted here. Schema and editor: next.

## License

See [LICENSE](LICENSE).
