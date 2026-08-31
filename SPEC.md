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
people:
  - {name: roberto.basile, email: roberto.basile@example.com}
  - {name: maria.rossi, email: maria.rossi@example.com}
  - {name: architecture-board}
  - {name: cto}

strategic_initiatives:
  - id: TEK
    title: Technology
    owner: roberto.basile@example.com
    timeframe: "2026"
    review_cadence: Monthly
    status: In Progress
    objectives:
      - id: O1
        title: Make the SDLC AI-assisted end to end
        description: >
          Delivery teams still hand-write scaffolding and tests. Close the gap
          between an approved design and running code.
        theme: AI-assisted SDLC
        owners:
          - roberto.basile@example.com
          - maria.rossi@example.com
        status: In Progress
        links:
          - title: AI-assisted SDLC charter
            url: https://confluence.example.com/x/AI-SDLC
        key_results:
          - id: KR1
            target_measure: >
              Coding time saved versus the pre-orchestrator baseline reaches at
              least 60%.
            target_date: Q3
            owners:
              accountable:
                - roberto.basile@example.com
              responsible:
                - maria.rossi@example.com
              consult:
                - architecture-board
              inform:
                - cto
            status: In Progress
            priority: High
            complexity: High
            progress_notes:
              - date: 2026-08-20
                note: Baseline measured at 12 h/feature. Pilot teams at 31% saved.
```

Top level:

| Field | Required | Description |
|---|---|---|
| `version` | no | Format version. Defaults to `1`. |
| `people` | no | Everyone the OKRs refer to, defined once. See [People](#people). |
| `strategic_initiatives` | yes | List of Strategic Initiatives. May be empty — that is what a file looks like before the first one is named. |

A file is built downwards: an initiative is named before it has objectives, and
an objective before it has key results. So an empty list at any level is legal.
It is reported as a warning rather than an error, except at the top, where an
empty file is simply a new one.

---

## Strategic Initiative

| Field | Required | Description |
|---|---|---|
| `id` | yes | Short uppercase code, 2–5 letters, unique in the file: `PEP`, `PRO`, `TEK`. Stable — everything refers to it. |
| `title` | yes | Plain-language name, e.g. `People`, `Process`, `Technology`. |
| `owner` | yes | The one person accountable for the whole initiative. A reference into [people](#people). |
| `timeframe` | yes | A year, optionally narrowed to a half or a quarter: `"2026"`, `"2026.H1"`, `"2026.Q3"`. **Quote it** — see [Gotchas](#gotchas). |
| `review_cadence` | no | How often the work is looked at: `Weekly`, `Bi-Weekly`, `Monthly`, `Quarterly`, `6 Months`, `Yearly`. |
| `status` | yes | See [Status](#status). |
| `description` | no | Free-form context. |
| `objectives` | yes | List of Objectives. May be empty while the initiative is being written; the report says so. |

`progress` is **not** a field — it is computed. See [Progress](#progress).

---

## Objective

| Field | Required | Description |
|---|---|---|
| `id` | yes | `O` + number, sequential within its initiative: `O1`, `O2`. Unique within the initiative, not globally. |
| `title` | yes | The qualitative goal — what we want to improve or achieve. |
| `description` | no | Brief but significant. Why this matters. |
| `theme` | no | Cross-cutting tag used to group objectives across initiatives: `Shared capability model`, `AI-assisted SDLC`, `Architecture governance`. |
| `owners` | no | References into [people](#people). Optional because it is usually the union of the Objective's Key Result owners; set it only when you want to state it explicitly. |
| `status` | yes | See [Status](#status). |
| `links` | no | List of `{title, url}` — Confluence pages, decision records, dashboards. |
| `key_results` | yes | List of Key Results. May be empty while the objective is being written; the report says so. |

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

Four optional lists of references into [people](#people). `accountable` should
name exactly one person — that is the point of RACI.

The last two are `consult` and `inform`, not the textbook's `consulted` and
`informed`. A file using the older names is renamed on read, and the repair is
reported.

```yaml
owners:
  # owns the outcome, one person
  accountable:
    - roberto.basile@example.com
  # does the work
  responsible:
    - maria.rossi@example.com
    - luca.bianchi@example.com
  # asked before decisions
  consult:
    - architecture-board
  # told after decisions
  inform:
    - cto
```

---

## People

Everyone is defined once, at the top of the file:

```yaml
people:
  - {name: roberto.basile, email: roberto.basile@example.com}
  - {name: architecture-board}
```

| Field | Required | Description |
|---|---|---|
| `name` | yes | What to show. |
| `email` | no | Where to reach them. |

The address is the durable identity: names get spelled three ways and change,
addresses do not. It stays optional because you often know who owns something
before you have looked up how to reach them, and a group alias like
`architecture-board` may never have one.

### Referring to somebody

Everywhere a person is named — an initiative's `owner`, an objective's `owners`,
any RACI role — the value is a **reference**: their address, or their name where
they have no address.

```yaml
owner: roberto.basile@example.com

owners:
  accountable:
    - roberto.basile@example.com
  consult:
    - architecture-board
```

One definition and many mentions, so correcting somebody's name or address is a
single edit rather than a search across the file.

### Anything else is collected

Three shapes are accepted and all three end up as a roster entry plus a
reference, reported as a repair:

```yaml
# written inline, before there was a roster
accountable: [{name: roberto.basile, email: roberto.basile@example.com}]

# a bare name, before people had addresses at all
accountable: [roberto.basile]

# a reference to somebody not yet in the roster — they are added
accountable: [someone.new]
```

That is what lets a file written against any earlier version open without
migration, and what keeps typing a name by hand practical.

Nobody is ever removed. Taking somebody off the last Key Result they were on
leaves them defined, so they can be given other work without being typed again;
a name entered in error is deleted from `people`, where it is visible, rather
than by hunting down its last use.

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
changing an id breaks every document, ticket, and note that references it.

Numbering is expected to be sequential but gaps are legal, precisely because
aborted items keep their ids.

### Aborting and deleting are different

Work that happened and then stopped should be set to `Aborted`. It disappears
from every rollup, and its id stays spoken for, so the ticket that mentions
`TEK.O1.KR2` still finds the thing it meant.

Deleting removes the record outright, and **frees its id**. Nothing records what
used to exist, so the next Key Result added becomes `KR2` again — and anything
that referred to the old one now points somewhere else entirely.

Delete what was never really there. Abort what was.

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
