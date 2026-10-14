# @covennetwork/mcp

An [MCP](https://modelcontextprotocol.io) server that lets AI agents swap tokens and bridge USDC on Arc through [Coven](https://coven.network).

Connect it to Claude, Cursor, or any other MCP client, and your agent can:

- **Swap tokens on Arc.** It quotes, simulates, and executes swaps across Uniswap v3 and v4 pools.
- **Bridge USDC.** It quotes CCTP transfers from Arc to other chains.
- **Research before trading.** It looks up token metadata, impersonator flags, pool liquidity, and hook risk.

Your funds stay protected. The agent trades through an on-chain Coven session that you create and control. The session sets the tokens it may trade, per-trade and daily spending caps, slippage and price impact limits, and an expiry. You can revoke it at any time. Without a session, the server runs read-only and needs no keys.

## Install

```sh
npm install -g @covennetwork/mcp
```

Or run it without installing:

```sh
npx -y @covennetwork/mcp
```

Requires Node.js 18 or newer.

## Client configuration

Add the server to any MCP client that supports stdio servers. For example:

```json
{
  "mcpServers": {
    "coven": {
      "command": "npx",
      "args": ["-y", "@covennetwork/mcp"],
      "env": {
        "ARC_RPC_URL": "https://your-private-arc-rpc"
      }
    }
  }
}
```

To enable the write path, add the session variables described below to `env`.

## Environment

| Variable | Required | Description |
| --- | --- | --- |
| `ARC_RPC_URL` | No | Arc RPC endpoint. Defaults to the public endpoint, which is rate limited. |
| `COVEN_SESSION_ADDRESS` | For writes | Address of the Coven session contract the agent trades through. |
| `COVEN_SESSION_FACTORY` | Recommended | Address of the canonical `CovenSessionFactory`. If set, the server refuses any session the factory did not create. |
| `COVEN_SESSION_KEY` | For execution | Hot session key (hex, with or without `0x`). Without it, write tools can simulate but cannot execute. |

## Tools

### Read

| Tool | Description |
| --- | --- |
| `quote` | Simulates a swap and returns the output, route, hooks in the path, and the platform fee. |
| `token_info` | Resolves token metadata and risk flags (impersonator, metadata unavailable). |
| `list_pools` | Lists USDC-paired pools for a token with liquidity and hook risk. |
| `pool_state` | Reads on-chain pool state: `sqrtPriceX96`, liquidity, fee tier, tick spacing. |
| `bridge_quote` | Quotes a CCTP bridge of USDC from Arc to another chain. |

### Write (session only)

| Tool | Description |
| --- | --- |
| `session_status` | Returns session caps, trades in the current window, expiry, and revocation state. |
| `swap_simulate` | Simulates the exact on-chain call and returns a binding handle and the input token's caps. |
| `swap_execute` | Executes a swap that was already simulated. The handle must be fresh and unused, and the parameters must match it. |

All tool arguments take token addresses (`0x...`). Symbols are never accepted. Amounts are integer strings in the token's smallest unit. Every result includes `as_of.block`.

## Safety model

- **The chain is the authority.** `swap_simulate` calls the session's `previewSwap`. The server stores `expectedOut` and passes that same value to `executeSwap`, so the model never chooses the price a trade is measured against.
- **Single-use, short-lived handles.** A handle expires 3 blocks after its simulation, can be used only once, and must match `tokenIn`, `tokenOut` and `amountIn` exactly. On a mismatch the server refuses the trade instead of adjusting it.
- **On-chain caps.** The session contract enforces per-trade and daily caps for each token, a trade count cap, price impact and slippage limits, expiry, and revocation.
- **Factory check.** A lookalike session that points at a different router cannot be told apart by its address. With `COVEN_SESSION_FACTORY` set, the server checks the session against the factory and disables the write path if the check fails.
- **Untrusted metadata.** The server strips control, zero-width and bidi characters from token names and symbols, collapses whitespace, truncates them, and returns them as `untrusted_symbol` and `untrusted_name`.

## Library usage

The package also exports its building blocks:

```ts
import { buildServerDeps, buildTools, serveStdio } from '@covennetwork/mcp'

const deps = await buildServerDeps()
serveStdio(buildTools(deps))
```

It also re-exports the session helpers from `@covennetwork/core`: `createSession`, `predictSession`, `sessionStatus`, `revokeSession`, `approveToken`, and the others.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

## License

MIT
