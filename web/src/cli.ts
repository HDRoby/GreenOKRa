/** Command line interface: `greenokra check` and `greenokra show`. */

import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

import {
  type Initiative,
  type OkrFile,
  Report,
  formatProgress,
  initiativeProgress,
  keyResultProgress,
  objectiveProgress,
  parse,
  stringify,
  toData,
  validate,
} from './lib/okr.ts'

const USAGE = `Usage:
  greenokra check <file...> [--fix] [--strict]   validate OKR files
  greenokra show  <file...>                      print the tree with progress

  --fix      write normalised values back to the file
  --strict   treat warnings as failures
`

export function main(argv: string[]): number {
  const [command, ...rest] = argv
  const flags = new Set(rest.filter((arg) => arg.startsWith('--')))
  const paths = rest.filter((arg) => !arg.startsWith('--'))

  if (command === undefined || flags.has('--help') || paths.length === 0) {
    process.stdout.write(USAGE)
    return command === '--help' ? 0 : 1
  }

  const unknown = [...flags].filter(
    (flag) => !['--fix', '--strict', '--help'].includes(flag),
  )
  if (unknown.length > 0) {
    process.stdout.write(`unknown option ${unknown[0]}\n\n${USAGE}`)
    return 1
  }

  if (command === 'check') {
    return check(paths, flags.has('--fix'), flags.has('--strict'))
  }
  if (command === 'show') {
    return show(paths)
  }
  process.stdout.write(`unknown command '${command}'\n\n${USAGE}`)
  return 1
}

function print(line: string): void {
  process.stdout.write(`${line}\n`)
}

function read(path: string): { text: string } | { problem: string } {
  try {
    return { text: readFileSync(path, 'utf8') }
  } catch (error) {
    return { problem: `cannot read file: ${(error as Error).message}` }
  }
}

function check(paths: string[], fix: boolean, strict: boolean): number {
  let failed = false

  for (const path of paths) {
    const result = read(path)
    print(path)
    if ('problem' in result) {
      print(`  error    ${result.problem}`)
      failed = true
      continue
    }

    const doc = parse(result.text)
    if (doc.errors.length > 0) {
      for (const error of doc.errors) {
        print(`  error    not valid YAML: ${error.message}`)
      }
      failed = true
      continue
    }

    const report = validate(doc)
    for (const message of report.fixes) print(`  fixed    ${message}`)
    for (const message of report.warnings) print(`  warning  ${message}`)
    for (const message of report.errors) print(`  error    ${message}`)

    if (report.fixes.length > 0) {
      if (!fix) {
        print('  note     re-run with --fix to write these repairs back')
      } else if (report.ok) {
        writeFileSync(path, stringify(doc), 'utf8')
        print(`  written  ${path}`)
      } else {
        print('  note     repairs not written: fix the errors above first')
      }
    }

    print(`  ${tally(report)}`)
    if (report.errors.length > 0 || (strict && report.warnings.length > 0)) {
      failed = true
    }
  }
  return failed ? 1 : 0
}

function tally(report: Report): string {
  const parts = [
    plural(report.errors.length, 'error', 'errors'),
    plural(report.warnings.length, 'warning', 'warnings'),
    plural(report.fixes.length, 'fix', 'fixes'),
  ].filter((part) => part !== null)
  return parts.length > 0 ? parts.join(', ') : 'ok'
}

function plural(count: number, one: string, many: string): string | null {
  if (count === 0) return null
  return `${count} ${count === 1 ? one : many}`
}

function show(paths: string[]): number {
  let failed = false

  for (const path of paths) {
    const result = read(path)
    print(path)
    if ('problem' in result) {
      print(`  error    ${result.problem}`)
      failed = true
      continue
    }
    const doc = parse(result.text)
    if (doc.errors.length > 0) {
      print(`  error    not valid YAML: ${doc.errors[0]?.message ?? ''}`)
      failed = true
      continue
    }
    const data: OkrFile = toData(doc)
    for (const initiative of data.strategic_initiatives ?? []) {
      showInitiative(initiative)
    }
    print('')
  }
  return failed ? 1 : 0
}

function showInitiative(initiative: Initiative): void {
  const id = initiative.id ?? '?'
  print('')
  print(
    `${id.padEnd(6)} ${formatProgress(initiativeProgress(initiative)).padStart(7)}  ` +
      `${initiative.title ?? ''}  ` +
      `(${initiative.status ?? '?'}, ${initiative.timeframe ?? '?'})`,
  )

  for (const objective of initiative.objectives ?? []) {
    const objectiveId = `${id}.${objective.id ?? '?'}`
    print(
      `  ${objectiveId.padEnd(9)} ` +
        `${formatProgress(objectiveProgress(objective)).padStart(7)}  ` +
        `${objective.title ?? ''}`,
    )
    for (const keyResult of objective.key_results ?? []) {
      print(
        `    ${`${objectiveId}.${keyResult.id ?? '?'}`.padEnd(15)} ` +
          `${formatProgress(keyResultProgress(keyResult)).padStart(7)}  ` +
          `${(keyResult.status ?? '?').padEnd(12)} ` +
          `${(keyResult.priority ?? '?').padEnd(8)} ` +
          `due ${keyResult.target_date ?? '?'}`,
      )
    }
  }
}
