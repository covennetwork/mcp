import type { Tool } from './tools.js'

type JsonRpc = { jsonrpc: '2.0'; id?: number | string | null; method?: string; params?: unknown; result?: unknown; error?: unknown }

// Minimal MCP stdio transport: newline-delimited JSON-RPC 2.0 over stdin/stdout.
// Implements initialize, tools/list and tools/call. No dependency on a vendored SDK,
// which keeps the tool handlers directly unit-testable.
export function serveStdio(tools: Tool[], info = { name: 'coven-mcp', version: '0.1.0' }): void {
  const byName = new Map(tools.map((t) => [t.name, t]))
  const send = (msg: JsonRpc) => process.stdout.write(`${JSON.stringify(msg)}\n`)
  const ok = (id: JsonRpc['id'], result: unknown) => send({ jsonrpc: '2.0', id, result })
  const err = (id: JsonRpc['id'], code: number, message: string) => send({ jsonrpc: '2.0', id, error: { code, message } })

  let buf = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk: string) => {
    buf += chunk
    let nl: number
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line) void handle(line)
    }
  })

  async function handle(line: string) {
    let msg: JsonRpc
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }
    const { id, method, params } = msg
    if (method === 'initialize') {
      return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: info })
    }
    if (method === 'notifications/initialized') return
    if (method === 'tools/list') {
      return ok(
        id,
        { tools: tools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })) },
      )
    }
    if (method === 'tools/call') {
      const p = (params ?? {}) as { name?: string; arguments?: Record<string, unknown> }
      const tool = p.name ? byName.get(p.name) : undefined
      if (!tool) return err(id, -32601, `unknown tool: ${p.name}`)
      try {
        const result = await tool.handler(p.arguments ?? {})
        return ok(id, { content: [{ type: 'text', text: JSON.stringify(result) }] })
      } catch (e) {
        // Tool errors are returned as tool results (isError) so the model can read and relay them.
        return ok(id, { content: [{ type: 'text', text: (e as Error).message }], isError: true })
      }
    }
    if (id !== undefined && id !== null) err(id, -32601, `unknown method: ${method}`)
  }
}
