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

**Derive, never store.** Progress percentages, the date a period resolves to, the
list of people and themes a file uses, who the filter can offer — all computed
from the document on every read. A value derived on demand cannot drift out of
sync, and cannot need cleaning up when its last use disappears. Resist the urge
to cache any of it in state.

**Filtered lists must carry their original indices.** Editing addresses YAML
nodes by position — `strategic_initiatives[2].objectives[0]` — so filtering an
array and then indexing the result renumbers everything and sends edits to the
wrong record. Use `withIndices` from `filter.ts`, which pairs each item with its
true position *before* filtering. This is silent data corruption if you get it
wrong; there are tests pinning it.

**Editor conveniences are not format rules.** The status auto-advance lives in
`edit.ts`, not in `validate()`, and `SPEC.md` says plainly that a file where the
levels disagree is still valid. Anything the editor does for the user's
convenience belongs on that side of the line.

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
- Numbers need a number node. Writing the string `'40'` emits `progress: "40"`,
  which reads back as text and breaks the rollup
- Values inserted with `doc.setIn(...)` arrive as plain JS, not YAML nodes;
  `validate()` materialises them, so validate after editing
- New fields go in at their documented position via `setField`, not appended

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
- **One component per affordance.** `AddButton` and `LabelPicker` exist so four
  add buttons and five owner fields cannot drift apart again
- **Never call a browser-only function during render.** `canSaveInPlace()`
  answers differently on the server and in the browser, which breaks hydration.
  Resolve it in an effect
- **Treat the File System Access API as fallible.** Brave and Arc block it, and
  Chrome guards some directories. Every path degrades to a file input and a
  download rather than throwing
- **Browser-only.** No API routes, no server actions touching a filesystem, no
  database

## Editing OKR files

- Run `check` after editing anything in `okrs/`
- Never hand-write a percentage — progress is always computed from status
- Never renumber or reuse an id. Dropped work gets `status: Aborted` and keeps
  its id forever, which is why the editor has no delete for initiatives,
  objectives or key results
- Progress notes are editable, and the log re-sorts newest-first when one is
  re-dated

## A naming inconsistency

The UI says **GreenOKR**; the repository, the npm package and the docs say
**GreenOKRa**. Unresolved on purpose — renaming the repo and the CLI binary has
knock-on effects. Do not "fix" one side without being asked.

## What NOT to do

- Do not add Python, a backend, or a database
- Do not duplicate spec logic outside `okr.ts`
- Do not add a build step for the CLI
- Do not store computed values in the YAML
- Do not let `SPEC.md` and `okr.ts` drift apart
