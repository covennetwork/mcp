import { type Address, createPublicClient, createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { ARC_RPC_URL, arc, createContext, createTokenRegistry } from '@covennetwork/core'
import { createCoven } from '@covennetwork/sdk'
import { type StoredSim, type ToolDeps, buildTools } from './tools.js'
import { assertFactorySession, createSessionClient } from './session.js'

export * from './sanitize.js'
export * from './tools.js'
export * from './session.js'
export * from './pools.js'
export { serveStdio } from './server.js'

export async function buildServerDeps(): Promise<ToolDeps> {
  const rpc = process.env.ARC_RPC_URL ?? ARC_RPC_URL
  const bundled = process.env.ARC_RPC_URL ? '' : ' (public endpoint; expect rate limits — set ARC_RPC_URL to a private endpoint)'
  if (bundled) process.stderr.write(`coven-mcp: using ${rpc}${bundled}\n`)
  const transport = http(rpc)
  const client = createPublicClient({ chain: arc, transport, batch: { multicall: true } })
  const ctx = createContext({ arcTransport: transport })
  const tokens = createTokenRegistry(ctx)
  const coven = createCoven({ arcTransport: transport })

  const deps: ToolDeps = { client, coven, tokens, handles: new Map<string, StoredSim>() }

  const sessionAddress = process.env.COVEN_SESSION_ADDRESS as Address | undefined
  const factory = process.env.COVEN_SESSION_FACTORY as Address | undefined
  if (sessionAddress) {
    if (factory) {
      const legit = await assertFactorySession(client, factory, sessionAddress).catch(() => false)
      if (!legit) {
        process.stderr.write(
          `coven-mcp: ${sessionAddress} was not created by the CovenSessionFactory at ${factory}; refusing the write path. A lookalike session can point at a different router.\n`,
        )
        return deps
      }
    } else {
      process.stderr.write(
        'coven-mcp: COVEN_SESSION_FACTORY is not set; the session address is unverified. Set it so the server can refuse a lookalike session.\n',
      )
    }
    const pk = process.env.COVEN_SESSION_KEY
    const wallet = pk
      ? createWalletClient({ account: privateKeyToAccount(pk.startsWith('0x') ? (pk as `0x${string}`) : (`0x${pk}` as `0x${string}`)), chain: arc, transport })
      : undefined
    if (!pk) process.stderr.write('coven-mcp: COVEN_SESSION_ADDRESS set without COVEN_SESSION_KEY; write tools will simulate but cannot execute\n')
    deps.session = createSessionClient(client, sessionAddress, wallet)
  }
  return deps
}
