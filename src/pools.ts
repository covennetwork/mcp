import { type Address, type PublicClient, parseAbi } from 'viem'
import { COVEN_LENS, USDC } from '@covennetwork/core'

const discoverAbi = parseAbi([
  'struct Pool { uint8 protocol; address token0; address token1; uint24 fee; int24 tickSpacing; address hooks; address pool; bytes32 poolId; uint128 liquidity; uint160 sqrtPriceX96; }',
  'function discoverPools(address[] tokens) view returns (Pool[])',
])

export type PoolState = {
  protocol: 'v3' | 'v4'
  token0: Address
  token1: Address
  fee: number
  tickSpacing: number
  hooks: Address
  liquidity: bigint
  sqrtPriceX96: bigint
}

export async function poolsForToken(client: PublicClient, token: Address, usdc: Address = USDC): Promise<PoolState[]> {
  const raw = await client.readContract({ address: COVEN_LENS, abi: discoverAbi, functionName: 'discoverPools', args: [[usdc, token]] })
  return raw
    .filter((p) => p.sqrtPriceX96 > 0n)
    .map((p) => ({
      protocol: (p.protocol === 0 ? 'v3' : 'v4') as 'v3' | 'v4',
      token0: p.token0,
      token1: p.token1,
      fee: p.fee,
      tickSpacing: p.tickSpacing,
      hooks: p.hooks,
      liquidity: p.liquidity,
      sqrtPriceX96: p.sqrtPriceX96,
    }))
}
