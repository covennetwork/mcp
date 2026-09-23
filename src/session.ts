import { type Address, type Hex, type PublicClient, type WalletClient } from 'viem'
import { covenSessionAbi, isFactorySession } from '@covennetwork/core'

// Session creation and owner-side management live in @covennetwork/core (one implementation,
// shared with the app). Re-exported here so consumers of the MCP package have them in one
// place. This file only adds the agent runtime: the SessionClient that simulates and
// executes with the hot session key.
export {
  covenSessionAbi,
  covenSessionFactoryAbi,
  sessionErc20Abi,
  createSession,
  predictSession,
  isFactorySession,
  sessionStatus,
  approveToken,
  allowanceOf,
  revokeSession,
  tokenDecimals,
  type SessionConfig,
  type TokenCapInput,
} from '@covennetwork/core'

export type SessionStatus = {
  expiry: bigint
  tradeCountCap: bigint
  tradesInWindow: bigint
  maxImpactBps: bigint
  maxSlippageBps: bigint
  revoked: boolean
}

export type TokenStatus = {
  allowed: boolean
  perTradeCap: bigint
  dailyCap: bigint
  spentToday: bigint
  remainingToday: bigint
}

export type SwapParams = { tokenIn: Address; tokenOut: Address; amountIn: bigint }

// The chain is the authority. previewSwap is the on-chain simulation the write path binds
// to: the server reads expectedOut from it and passes that same value into executeSwap, so
// the model never chooses the price the trade is measured against. executeSwap enforces
// minOut against that expectedOut and the per-token input caps.
export interface SessionClient {
  status(): Promise<SessionStatus>
  tokenStatus(token: Address): Promise<TokenStatus>
  simulate(p: SwapParams): Promise<{ expectedOut: bigint; asOfBlock: bigint }>
  execute(p: SwapParams & { expectedOut: bigint }): Promise<Hex>
}

export function createSessionClient(
  client: PublicClient,
  address: Address,
  wallet: WalletClient | undefined,
  deadlineSeconds = 120,
): SessionClient {
  const noExtras: readonly { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address }[] = []
  return {
    async status() {
      const s = await client.readContract({ address, abi: covenSessionAbi, functionName: 'status' })
      const [expiry, tradeCountCap, tradesInWindow, maxImpactBps, maxSlippageBps, , revoked] = s
      return { expiry, tradeCountCap, tradesInWindow, maxImpactBps, maxSlippageBps, revoked }
    },
    async tokenStatus(token) {
      const [allowed, perTradeCap, dailyCap, spentToday, remainingToday] = await client.readContract({
        address,
        abi: covenSessionAbi,
        functionName: 'tokenStatus',
        args: [token],
      })
      return { allowed, perTradeCap, dailyCap, spentToday, remainingToday }
    },
    async simulate(p) {
      const block = await client.getBlockNumber()
      const { result } = await client.simulateContract({
        address,
        abi: covenSessionAbi,
        functionName: 'previewSwap',
        args: [p.tokenIn, p.tokenOut, p.amountIn, noExtras],
        account: wallet?.account ?? '0x000000000000000000000000000000000000dEaD',
        blockNumber: block,
      })
      return { expectedOut: result[0], asOfBlock: block }
    },
    async execute(p) {
      if (!wallet?.account) throw new Error('no session key available to sign')
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)
      return wallet.writeContract({
        address,
        abi: covenSessionAbi,
        functionName: 'executeSwap',
        args: [p.tokenIn, p.tokenOut, p.amountIn, noExtras, p.expectedOut, deadline],
        account: wallet.account,
        chain: wallet.chain,
      })
    },
  }
}

// Refuse any session the canonical factory did not create. A lookalike session with a
// different router is indistinguishable by address, so the factory is the trust anchor.
export const assertFactorySession = isFactorySession
