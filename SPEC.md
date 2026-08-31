# GreenOKRa file format

Version 1.

A single YAML file describes a portfolio of OKRs across three nested levels:

```
Strategic Initiative (SI)     PEP, PRO, TEK — high-level grouping
  └── Objective               O1, O2 …      — qualitative goal
        └── Key Result        KR1, KR2 …    — measurable outcome
```

Nothing is stored twice. Percentages are always derived, never written down.

---

## File shape

```yaml
version: 1

strategic_initiatives:
  - id: TEK
    title: Technology
    owner: roberto.basile
    timeframe: "2026"
    review_cadence: Monthly review, quarterly sponsor review
    status: In Progress
    objectives:
      - id: O1
        title: Make the SDLC AI-assisted end to end
        description: >
          Delivery teams still hand-write scaffolding and tests.
          Close the gap between an approved design and running code.
        theme: AI-assisted SDLC
        owners: [roberto.basile, maria.rossi]
        status: In Progress
        links:
          - title: AI-assisted SDLC charter
            url: https://confluence.example.com/x/AI-SDLC
        key_results:
          - id: KR1
            target_measure: >
              Coding time saved versus the pre-orchestrator baseline
              reaches at least 60%.
            target_date: Q3
            owners:
              accountable: [roberto.basile]
              responsible: [maria.rossi]
              consulted: [architecture-board]
              informed: [cto]
            status: In Progress
            priority: High
            complexity: High
            progress_notes:
              - date: 2026-08-20
                note: Baseline measured at 12 h/feature. Pilot teams at 31% saved.
```

Top level has exactly two keys:

| Field | Required | Description |
|---|---|---|
| `version` | no | Format version. Defaults to `1`. |
| `strategic_initiatives` | yes | List of Strategic Initiatives. |

---

## Strategic Initiative

| Field | Required | Description |
|---|---|---|
| `id` | yes | Short uppercase code, 2–5 letters, unique in the file: `PEP`, `PRO`, `TEK`. Stable — everything refers to it. |
| `title` | yes | Plain-language name, e.g. `People`, `Process`, `Technology`. |
| `owner` | yes | Single accountable person for the whole initiative. |
| `timeframe` | yes | `"2026"`, `"2026-Q3"`, `"H1-2026"`. **Quote it** — see [Gotchas](#gotchas). |
| `review_cadence` | no | Free text: `Weekly check-in`, `Monthly review, quarterly sponsor review`. |
| `status` | yes | See [Status](#status). |
| `description` | no | Free-form context. |
| `objectives` | yes | List of Objectives. At least one. |

`progress` is **not** a field — it is computed. See [Progress](#progress).

---

## Objective

| Field | Required | Description |
|---|---|---|
| `id` | yes | `O` + number, sequential within its initiative: `O1`, `O2`. Unique within the initiative, not globally. |
| `title` | yes | The qualitative goal — what we want to improve or achieve. |
| `description` | no | Brief but significant. Why this matters. |
| `theme` | no | Cross-cutting tag used to group objectives across initiatives: `Shared capability model`, `AI-assisted SDLC`, `Architecture governance`. |
| `owners` | no | List of names. Optional because it is usually the union of the Objective's Key Result owners; set it only when you want to state it explicitly. |
| `status` | yes | See [Status](#status). |
| `links` | no | List of `{title, url}` — Confluence pages, decision records, dashboards. |
| `key_results` | yes | List of Key Results. At least one. |

There is deliberately **no timeframe** on an Objective. Timing lives on each Key
Result's `target_date`.

### Global reference

An Objective is addressed as `<SI id>.<objective id>` — `TEK.O1`, `PEP.O2`. This
is derived by joining with dots; never store it as a field.

---

## Key Result

| Field | Required | Description |
|---|---|---|
| `id` | yes | `KR` + number, sequential within its objective: `KR1`, `KR2`. |
| `target_measure` | yes | The measurable indicator *and* the target that counts as success, in one sentence. E.g. *"Coding time saved versus the pre-orchestrator baseline reaches at least 60%."* |
| `target_date` | yes | A date or a label: `"2026-09-30"`, `Q3`, `H2`, `September`. Always a string — **quote real dates**. |
| `owners` | yes | RACI map. See below. |
| `status` | yes | `Not Started`, `In Progress`, `Completed`, `Aborted`. |
| `priority` | yes | `Blocker`, `High`, `Medium`, `Low`. |
| `complexity` | yes | `Very High`, `High`, `Medium`, `Low`. |
| `progress` | no | Integer `0`–`100`. Overrides the status-derived percentage when you know better. See [Progress](#progress). |
| `progress_notes` | no | Review history. See below. |

A Key Result is addressed as `<SI id>.<objective id>.<KR id>` — `TEK.O1.KR2`,
`PRO.O1.KR4`.

### Owners (RACI)

Four optional lists. `accountable` should name exactly one person — that is the
point of RACI.

```yaml
owners:
  accountable: [roberto.basile]     # owns the outcome, one person
  responsible: [maria.rossi, luca.bianchi]   # does the work
  consulted: [architecture-board]   # asked before decisions
  informed: [cto]                   # told after decisions
```

### Progress notes

An append-only review log, **most recent first**. Each entry is a `date`
(`YYYY-MM-DD`, unquoted is fine here) and a `note`.

```yaml
progress_notes:
  - date: 2026-08-20
    note: Pilot teams at 31% saved. Two teams blocked on runner capacity.
  - date: 2026-07-18
    note: Baseline measured at 12 h/feature across four teams.
```

Never edit or delete an existing entry — add a new one on top. The editor
prepends automatically.

---

## Status

The same four values apply at every level:

| Value | Meaning |
|---|---|
| `Not Started` | Agreed but no work begun. |
| `In Progress` | Actively being worked. |
| `Completed` | Done, target met. |
| `Aborted` | Dropped or descoped. Not a failure — it no longer counts. |

Status is **authored** at every level, including on Strategic Initiatives and
Objectives. It is a human judgement, not a rollup: an initiative can be
`In Progress` before any Key Result has moved, and can be `Aborted` while its
Key Results still read `In Progress`.

Percentages, by contrast, are always computed.

---

## Progress

Every Key Result maps to a percentage:

| Status | Progress |
|---|---|
| `Not Started` | 0% |
| `In Progress` | 50%, unless an explicit `progress` field says otherwise |
| `Completed` | 100% |
| `Aborted` | *excluded* — counts in neither numerator nor denominator |

Then roll up by plain average:

- **Objective progress** — mean of its non-aborted Key Results.
- **Initiative progress** — mean of *all* non-aborted Key Results under it,
  flattened across objectives. Not the mean of objective percentages: an
  objective with six Key Results represents more work than one with a single Key
  Result, and flattening keeps every Key Result weighted equally.

Two exclusion rules:

- An `Aborted` **Objective** is excluded entirely from its initiative's progress.
- If every Key Result in scope is aborted, progress is **undefined** — display
  `—`, not `0%`.

No weights, no confidence scores. If a Key Result needs to say it is 80% of the
way there, that is what the optional `progress` field is for.

---

## Identifiers

| Level | Pattern | Scope of uniqueness |
|---|---|---|
| Strategic Initiative | `^[A-Z]{2,5}$` | The whole file |
| Objective | `^O[0-9]+$` | Within its initiative |
| Key Result | `^KR[0-9]+$` | Within its objective |

Ids are **stable**: once written, never renumber. Reordering a list is free;
changing an id breaks every document, ticket, and note that references it. When
something is dropped, set its status to `Aborted` and leave the id in place —
never reuse it.

Numbering is expected to be sequential but gaps are legal, precisely because
aborted items keep their ids.

---

## Enum values

Status, priority and complexity are written in readable English, capitalised as
in the tables above: `In Progress`, `Not Started`, `Very High`. No quotes needed
— YAML reads a multi-word plain scalar as a string.

**Readers are lenient, writers are strict.** Tooling compares enum values
case-insensitively and treats `_` and `-` as spaces, so `in progress`,
`IN_PROGRESS` and `In-Progress` all load as `In Progress`. Normalisation happens
*before* validation, and files are always written back in the canonical form, so
a hand-typed variant is tidied up on the next save.

This keeps the file pleasant to read without making a stray capital letter into
a validation error.

---

## Gotchas

**Quote timeframes and dates used as labels.** YAML is helpful in ways that hurt
here:

| Written | Parsed as | Fix |
|---|---|---|
| `timeframe: 2026` | integer `2026` | `timeframe: "2026"` |
| `target_date: 2026-09-30` | a date object | `target_date: "2026-09-30"` |
| `timeframe: 2026-Q3` | string ✓ | fine as-is |

`target_date` and `timeframe` are always strings so one type covers both real
dates and labels like `Q3`. Inside `progress_notes`, `date` is a genuine date and
needs no quotes.

Note that parsers disagree here: YAML 1.2 reads `2026-09-30` as text, YAML 1.1
reads it as a date. Quoting removes the ambiguity, and the validator adds the
quotes for you.

---

## Reference implementation

`web/src/lib/okr.ts` is the executable version of this document — the enums, the
identifier patterns, the lenient reader, the progress rules. Where prose here and
that code disagree, the code is what runs; please report the discrepancy.

```bash
cd web && npm run check ../okrs/2026.yaml -- --fix
```
