# GreenOKRa Project Rules

A plain-text standard for OKRs (see `SPEC.md`) plus a browser-only editor for
those files. TypeScript throughout. **No Python, no backend, no database.**

## Repository layout

```
okrs/                 the OKR files themselves, one YAML file per timeframe
SPEC.md               the format specification — prose
web/
  src/lib/okr.ts      the format specification — code
  src/cli.ts          terminal front end (check / show)
  src/bin.ts          executable entry point
```

## The one rule that matters

`web/src/lib/okr.ts` is the single implementation of the spec. It has **no Node
imports**, so the browser editor and the command line enforce identical rules.

Never write a second copy of the validation, normalisation, or progress logic —
not in a component, not in a script, not in another language. If the editor needs
a rule, export it from `okr.ts`.

When the format changes, `SPEC.md` and `okr.ts` change in the same commit.

## Package management

npm, run from inside `web/`. Commit `package-lock.json`.

- Add a dependency: `npm install <package>`
- Add a dev dependency: `npm install -D <package>`
- Install from the lockfile: `npm ci`

Keep the dependency list short. `yaml` is the only runtime dependency and needs
to stay that way unless there is a strong reason.

## Running code

Node 23.6+ runs TypeScript directly, so there is no build step for the CLI.
Never add a bundler or `tsc` emit step just to run a script.

```bash
cd web
node src/bin.ts check ../okrs/2026.yaml          # or: npm run check ../okrs/2026.yaml
node src/bin.ts check ../okrs/2026.yaml --fix
node src/bin.ts show  ../okrs/2026.yaml
```

## Testing

- Framework: vitest
- Run: `npm test` (from `web/`)
- Tests sit next to the code they test: `src/lib/okr.test.ts`
- Resolve fixture paths with `new URL('...', import.meta.url)`, never relative to
  the working directory

Every format rule in `SPEC.md` should have a test. When fixing a validator bug,
add the failing case first.

## Type checking

- `npm run typecheck` (`tsc --noEmit`)
- `strict` is on. Do not add `any` or `@ts-expect-error` to silence it — the YAML
  AST is genuinely loosely typed, so narrow with the library's `isMap` / `isSeq` /
  `isScalar` guards instead.

## Code style

Follow what is already in `src/`:

- 2-space indent, single quotes, no semicolons
- Named exports, no default exports
- Small pure functions over classes; `Report` is a class only because it
  accumulates state
- Comments explain *why*, not *what*. Prefer a sentence about the decision over a
  restatement of the code.

## Editing OKR files

- Run `check` after editing anything in `okrs/`
- Never hand-write a percentage — progress is always computed from status
- Never renumber or reuse an id. Dropped work gets `status: Aborted` and keeps
  its id forever
- Add progress notes to the top of the list, never edit an existing one

## Working with YAML

The editor must preserve comments and formatting, so always go through
`parse()` / `stringify()` from `okr.ts` — they carry the round-trip options that
make saving an unchanged file byte-identical.

- Never use `JSON.parse`/`JSON.stringify` or a non-round-tripping YAML API on
  these files; it silently deletes every comment
- Mutate scalar values in place (`node.value = x`) rather than replacing nodes,
  which drops attached comments
- Values inserted with `doc.setIn(...)` arrive as plain JS, not YAML nodes;
  `validate()` materialises them, so validate after editing

## Web UI

- Stack: Next.js, Tailwind CSS, shadcn/ui, Lucide React icons
- Visual style: clean, minimalist, dark mode by default
- **Browser-only.** No API routes, no server actions that touch a filesystem, no
  database. Files are opened and saved through the browser
- Import shared logic from `src/lib/okr.ts`

## What NOT to do

- Do not add Python, a backend, or a database
- Do not duplicate spec logic outside `okr.ts`
- Do not add a build step for the CLI
- Do not store computed values (percentages) in the YAML
- Do not let `SPEC.md` and `okr.ts` drift apart
