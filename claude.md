# Project rules

A plain-text standard for OKRs (see `SPEC.md`) plus a browser-only editor for
those files. TypeScript throughout. **No Python, no backend, no database.**

## Repository layout

```
okrs/                        the OKR files themselves, one YAML file per timeframe
SPEC.md                      the format specification — prose
web/
  src/lib/okr.ts             the format specification — code: parse, validate,
                             normalise, roll up
  src/lib/edit.ts            every mutation of a document, and the status rules
  src/lib/dates.ts           timeframes and target dates
  src/lib/labels.ts          the people and themes a file reuses, and their colours
  src/lib/filter.ts          narrowing the view to one person
  src/lib/review.ts          whether a key result is overdue a review
  src/lib/file-access.ts     opening and saving in the browser
  src/cli.ts, src/bin.ts     terminal front end (check / show)
  src/app/                   the Next.js page
  src/components/            the editor's UI
```

## The rules that matter

**One implementation of the spec.** `web/src/lib/okr.ts` has **no Node imports**,
so the browser editor and the command line enforce identical rules. Never write a
second copy of the validation, normalisation or progress logic — not in a
component, not in a script, not in another language. If the editor needs a rule,
export it from `okr.ts`. When the format changes, `SPEC.md` and `okr.ts` change
in the same commit.

**Derive, never store — except people.** Progress percentages, the date a period
resolves to, the themes in use, who the filter can offer, whether a review is
overdue: all computed from the document on every read. A value derived on demand
cannot drift out of sync. Resist the urge to cache any of it in state.

The exception is deliberate. **People are defined once in a `people` roster and
referenced by identity** — their address, or their name where they have no
address. That is storage, and it buys something derivation cannot: one place to
correct a name or an address, rather than the same person written out eight
times. Consequences to keep in mind:

- Owner fields hold reference strings, not people. Resolve with `findPerson`.
- Nobody is pruned. Removing somebody's last mention leaves them defined, so
  they can be reassigned without being retyped.
- Changing an address changes an identity, so `updatePerson` rewrites every
  reference. Changing only a name does not, unless they have no address.

**Every format change migrates itself on read.** Five have landed so far — the
progress field retired, cadence made an enum, people given addresses, two RACI
roles renamed, people factored into a roster — and each one repairs an older
file rather than rejecting it, reporting what it did. A file written against any
earlier version still opens. Keep it that way: reach for a repair before an
error, and only error where no repair could be correct.

**Filtered lists must carry their original indices.** Editing addresses YAML
nodes by position — `strategic_initiatives[2].objectives[0]` — so filtering an
array and then indexing the result renumbers everything and sends edits to the
wrong record. Use `withIndices` from `filter.ts`, which pairs each item with its
true position *before* filtering. This is silent data corruption if you get it
wrong; there are tests pinning it.

**Editor conveniences are not format rules.** The status auto-advance and the
review-overdue clock live outside `validate()`, and `SPEC.md` says plainly that
a file they disagree with is still valid. Anything done for the user's
convenience belongs on that side of the line.

**Fixtures and examples are canonical.** Every test fixture and the YAML example
in `SPEC.md` parse with no errors and no repairs. They are the first thing
anybody reads, so they should show the shape the writer actually produces. After
a format change, re-canonicalise them by running them through
`parse → validate → stringify` rather than hand-editing.

## Package management

npm, run from inside `web/`. Commit `package-lock.json`.

- Add a dependency: `npm install <package>`
- Add a dev dependency: `npm install -D <package>`
- Install from the lockfile: `npm ci`

Keep the dependency list short. The whole runtime list is `next`, `react`,
`react-dom`, `yaml` and `lucide-react`, and it should stay that short unless
there is a strong reason.

## Running code

Node 23.6+ runs TypeScript directly, so the CLI has no build step. Never add a
bundler or `tsc` emit step just to run a script.

```bash
cd web
npm run dev                                      # the editor, on :3000
npm run build                                    # static export into out/
node src/bin.ts check ../okrs/2026.yaml          # or: npm run check ...
node src/bin.ts check ../okrs/2026.yaml --fix
node src/bin.ts show  ../okrs/2026.yaml
```

Imports carry their `.ts` extension, because Node's native TypeScript needs it.

## Testing

- Framework: vitest. Run `npm test` from `web/`
- Tests sit next to the code they test: `src/lib/okr.test.ts`
- Resolve fixture paths with `new URL('...', import.meta.url)`, never relative to
  the working directory

Every format rule in `SPEC.md` should have a test. When fixing a bug, add the
failing case first.

There is no test runner for the React components, so **UI behaviour is
unverified by tests** — push logic down into `src/lib/` where it can be tested,
and keep components thin enough that reading them is enough.

## Type checking, linting, formatting

- `npm run typecheck` (`tsc --noEmit`). `strict` is on
- Do not add `any` or `@ts-expect-error` to silence it — the YAML AST is
  genuinely loosely typed, so narrow with the library's `isMap` / `isSeq` /
  `isScalar` guards instead
- **No linter or formatter is installed.** There is no `npm run lint`. Match the
  style of the surrounding code by hand

## Code style

- 2-space indent, single quotes, no semicolons
- Named exports, no default exports (except `src/app/page.tsx` and
  `src/app/layout.tsx`, which Next requires)
- Small pure functions over classes; `Report` is a class only because it
  accumulates state
- Comments explain *why*, not *what*. Prefer a sentence about the decision over a
  restatement of the code

## Working with YAML

The editor must preserve comments and formatting, so always go through `parse()`
/ `stringify()` from `okr.ts` — they carry the round-trip options that make
saving an unchanged file byte-identical.

- Never use `JSON.parse`/`JSON.stringify` or a non-round-tripping YAML API on
  these files; it silently deletes every comment
- Mutate scalar values in place (`node.value = x`) rather than replacing nodes,
  which drops attached comments. Block scalars (`>`) and quoted scalars are
  `str` subclasses — rewriting them destroys their formatting
- Numbers need a number node. Writing the string `'40'` emits `"40"`, which
  reads back as text — this cost a rollup once, before the progress field was
  retired
- Values inserted with `doc.setIn(...)` arrive as plain JS, not YAML nodes;
  `validate()` materialises them, so validate after editing
- New fields go in at their documented position via `setField`, not appended
- People are written as a one-line flow mapping inside a block list. A flow
  list line-wraps once it grows, which breaks byte-stability and reads badly

## The format, in brief

Read `SPEC.md` for the whole of it. The parts most easily got wrong:

- **Status is a ladder that carries the percentage** — `Not Started` 0,
  `Started` 25, `In Progress` 50, `In Completion` 75, `Completed` 100. There is
  no separate progress field. `Aborted` is not a rung: it is excluded from
  rollups rather than scored zero, and reports no percentage of its own at any
  level
- **Percentages display to the nearest 5%**, and 0% and 100% are reserved for
  actually-none and actually-all
- **RACI is `accountable`, `responsible`, `consult`, `inform`** — the last two
  are not the textbook's `consulted` and `informed`
- **`review_cadence` is an enum** — Weekly, Bi-Weekly, Monthly, Quarterly,
  6 Months, Yearly — because the editor measures the newest progress note
  against it
- **An empty list is legal at every level.** A file is built downwards, so a
  container exists before its contents. At the top that is simply a new file
  and passes without comment; an initiative with no objectives, or an objective
  with no key results, warns
- **Aborting and deleting differ.** `Aborted` drops the work from every rollup
  and keeps its id spoken for. Deleting removes the record and **frees the id**,
  so the next one added takes it — repointing anything that referred to the old
  one. Delete what was never really there; abort what was

## Web UI

- **Next.js 16** (App Router, `output: 'export'` — a static folder, no server)
- **Tailwind CSS v4**, configured CSS-first: the palette is `@theme` custom
  properties in `src/app/globals.css`, not a JS config file
- **Lucide React** for icons
- `agentRules: false` in `next.config.ts` stops Next generating its own
  `AGENTS.md` / `CLAUDE.md` inside `web/`, which would compete with this file
- Controls are hand-written; there is no component library — no shadcn/ui, no
  Radix. Text inputs and date inputs are native. **Dropdowns are not**: a
  native `<select>` popup is drawn by the operating system and Chrome and
  Safari ignore CSS on `<option>`, so a light OS menu fell out of every dark
  control. `components/dropdown.tsx` reimplements the listbox — arrows, Enter,
  Escape, Home/End, click-outside, `aria-activedescendant` — and every dropdown
  in the app goes through it. Do not reintroduce a bare `<select>`; the cost of
  that choice is that touch devices no longer get the OS picker
- Visual style: clean, minimalist, dark by default

Conventions worth keeping:

- **Text fields commit on blur**, not per keystroke, because validation
  normalises values and normalising mid-word fights the person typing. Selects
  commit immediately
- **One component per affordance.** `AddButton`, `LabelPicker`, `PersonPicker`,
  `DeleteButton`, `Dropdown` and `Wordmark` exist so the same control cannot
  drift apart in four places
- **Colours live in one map.** `TONES` in `fields.tsx` holds each value's pill,
  text and bar spellings in a single entry, because Tailwind only sees literal
  class names — `text-${colour}` never reaches the stylesheet, so composing one
  from the other is not an option
- **Colour is spent where it means something.** Statuses are a hue ramp because
  the order is the meaning; people are neutral, because a hue hashed from a name
  teaches the reader nothing. The accent marks the person being filtered on
- **Initiatives are tabs, objectives and key results are lists.** Tabs suit a
  handful; a strip that scrolls sideways hides most of what it holds
- **Never call a browser-only function during render.** `canSaveInPlace()`
  answers differently on the server and in the browser, which breaks hydration.
  Resolve it in an effect
- **Treat the File System Access API as fallible.** Brave and Arc block it, and
  Chrome guards some directories. Every path degrades to a file input and a
  download rather than throwing
- **Browser-only.** No API routes, no server actions touching a filesystem, no
  database

Two CSS traps, both from the same cause — Tailwind's reset and layers outrank
plain CSS in ways that are silent when they bite:

- **Custom classes belong in `@layer components`.** Unlayered CSS outranks
  every Tailwind utility, so `.field { width: 100% }` written plainly was
  beating every `w-*` a field was given — for several rounds, invisibly. If a
  utility appears to do nothing, check what layer its competition is in
- **A modal `<dialog>` needs `m-auto`.** It centres itself on `margin: auto`,
  which the reset zeroes, so without it the dialog opens in the corner

## Editing OKR files

- Run `check` after editing anything in `okrs/`
- Never hand-write a percentage — the status carries it
- Never write a person inline; add them to `people` and refer to them
- Never renumber an id, and prefer `Aborted` to deleting for work that was
  real — see the format summary above for why
- Progress notes are editable, and the log re-sorts newest-first when one is
  re-dated. Clearing a note's text deletes the entry
- A new record leaves out the fields only an author can supply, rather than
  writing them empty: `missing required field` reads better than
  `must not be empty`, and the file stays clean

## The name and the mark

**GreenOKRa** everywhere — the app, the repository, the npm package and the
docs.

The name is **set as text**, not drawn: `components/wordmark.tsx` puts it beside
the okra mark in two greens sampled from the original artwork. The artwork's own
wordmark reads "GreenOKR" and predates the trailing "a", so only the pod is used
from it. `public/logo.png` still holds the full lockup and is no longer
referenced.

The darker green is **lifted** from the sampled `rgb(24 90 56)`, which reaches
only 2:1 against this canvas and cannot be read. Sample brand colours, then
check them: a value that is right in the artwork can be wrong on a dark page.

## What NOT to do

- Do not add Python, a backend, or a database
- Do not duplicate spec logic outside `okr.ts`
- Do not add a build step for the CLI
- Do not store computed values in the YAML
- Do not let `SPEC.md` and `okr.ts` drift apart
