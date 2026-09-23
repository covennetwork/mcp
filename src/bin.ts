#!/usr/bin/env node
import { buildServerDeps } from './index.js'
import { buildTools } from './tools.js'
import { serveStdio } from './server.js'

async function main() {
  const deps = await buildServerDeps()
  serveStdio(buildTools(deps), { name: 'coven-mcp', version: '0.1.0' })
}
main().catch((e) => {
  process.stderr.write(`coven-mcp: ${e instanceof Error ? e.message : String(e)}\n`)
  process.exit(1)
})
