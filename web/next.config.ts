import type { NextConfig } from 'next'

/**
 * Static export: the editor is browser-only, so there is no server to run.
 * `next build` produces a folder of files that can be opened from anywhere.
 */
const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  // The project's conventions live in ../claude.md; don't generate a competing
  // set of agent rules inside web/.
  agentRules: false,
}

export default nextConfig
