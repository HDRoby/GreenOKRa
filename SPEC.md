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
    review_cadence: Quarterly
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
| `timeframe` | yes | A year, optionally narrowed to a half or a quarter: `"2026"`, `"2026.H1"`, `"2026.Q3"`. **Quote it** — see [Gotchas](#gotchas). |
| `review_cadence` | no | How often the work is looked at: `Weekly`, `Bi-Weekly`, `Quarterly`, `6 Months`, `Yearly`. |
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
| `status` | yes | See [Status](#status). Carries the percentage. |
| `priority` | yes | `Blocker`, `High`, `Medium`, `Low`. |
| `complexity` | yes | `Very High`, `High`, `Medium`, `Low`. |
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

A review log, **most recent first**. Each entry is a `date` (`YYYY-MM-DD`,
unquoted is fine here) and a `note`.

```yaml
progress_notes:
  - date: 2026-08-20
    note: Pilot teams at 31% saved. Two teams blocked on runner capacity.
  - date: 2026-07-18
    note: Baseline measured at 12 h/feature across four teams.
```

Entries stay ordered newest first. A note can be dated anything, not only the
day it was written, so tooling that adds or re-dates one is expected to re-sort
the list rather than assume the newest arrival is the most recent.

Entries are editable: a note written in haste can be corrected, and a
misdated one moved. What the format does not do is track that history — there
is no record of what an entry said before, so a log that needs to be
authoritative belongs somewhere with an audit trail, not here.

### Reviews falling behind

The newest note's date is when a Key Result was last looked at, and the
initiative's `review_cadence` says how often it should be. The editor compares
the two and marks a Key Result as on time, overdue, or badly overdue — amber
once the interval has passed, red beyond twice it.

That is a reading of the file, not a rule of it: a file whose notes are years
old is perfectly valid, it is just not being looked after. Finished work is
exempt, since nothing needs reviewing after it is `Completed` or `Aborted`, and
so is an initiative with no cadence set.

---

## Status

A ladder, where each rung carries a percentage. The same values apply at every
level.

| Value | Progress | Meaning |
|---|---|---|
| `Not Started` | 0% | Agreed but no work begun. |
| `Started` | 25% | Under way, early. |
| `In Progress` | 50% | Squarely in the middle of it. |
| `In Completion` | 75% | Nearly there. |
| `Completed` | 100% | Done, target met. |
| `Aborted` | — | Dropped or descoped. Not a failure, and not a zero — it no longer counts at all. |

There is no separate progress field. The status *is* the progress, so the two
cannot disagree, and a percentage cannot be quietly maintained by hand while the
status says something else.

Status is **authored** at every level, including on Strategic Initiatives and
Objectives. It is a human judgement, not a rollup: an initiative can be
`In Progress` before any Key Result has moved, and can be `Aborted` while its
Key Results still read `In Progress`.

Percentages, by contrast, are always computed.

### One editor convenience

The editor advances anything sitting at `Not Started` to `In Progress` as soon
as work below it has begun — an Objective when one of its Key Results has, a
Strategic Initiative when one of its Objectives has — and says so when it does.
A Key Result starting work therefore carries up both levels at once.

"Begun" means any rung above `Not Started`, so the lowest one counts, and so
does work already `Completed`. `Aborted` does not: it means the work no longer
applies.

That is a convenience, not a rule of the format: a file where the levels
disagree is still valid, and any other tool is free to leave it alone.

Two things it will not do. `Completed` and `Aborted` are never overwritten —
closing something is a decision, and work still moving underneath does not undo
it. And the transition is never reversed: work having stopped is not the same as
it never having started.

---

## Progress

Every Key Result's percentage is the one its status carries, from the table in
[Status](#status). `Aborted` is *excluded* — it counts in neither numerator nor
denominator.

Then roll up by plain average:

- **Objective progress** — mean of its non-aborted Key Results.
- **Initiative progress** — mean of *all* non-aborted Key Results under it,
  flattened across objectives. Not the mean of objective percentages: an
  objective with six Key Results represents more work than one with a single Key
  Result, and flattening keeps every Key Result weighted equally.

Exclusion rules:

- An `Aborted` **Objective** is excluded entirely from its initiative's progress,
  and has no percentage of its own either — it reports `—`, exactly as an
  aborted Key Result does. The two must agree: an objective that showed a
  figure while its initiative ignored it would make the same record read two
  different ways.
- An `Aborted` **Strategic Initiative** likewise reports `—`.
- If every Key Result in scope is aborted, progress is **undefined** — display
  `—`, not `0%`.

Every other status leaves the computed percentage to the work underneath: a
`Completed` Objective whose Key Results are half done still *computes* to what
its Key Results say.

Where an editor shows a summary rather than the detail — a tab, a heading — it
reports `Completed` or `Aborted` as the word instead of a figure. Those two are
decisions somebody took, and a percentage beside one would either contradict it
or, for aborted work, not exist. The detail underneath still shows the computed
value, which is where a Completed Objective with unfinished Key Results becomes
visible.

No weights, no confidence scores, and no way to say a Key Result is 47% done —
because nobody knows that. Four rungs between nothing and finished is as much
precision as a status honestly supports.

### Displaying a percentage

Rollups produce numbers like 41.666…, so a displayed percentage is **rounded to
the nearest 5% and shown without decimals**. The arithmetic stays exact; only
the display rounds.

`0%` and `100%` mean actually none and actually all. Anything in between rounds
to at most `95%`, so a nearly finished initiative never claims to be done.

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
| `timeframe: 2026.Q3` | string ✓ | fine as-is |

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
