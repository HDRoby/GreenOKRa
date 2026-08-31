#!/usr/bin/env node
import process from 'node:process'

import { main } from './cli.ts'

process.exit(main(process.argv.slice(2)))
