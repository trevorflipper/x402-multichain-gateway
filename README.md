# x402 Multi-Chain Blockchain API

Pay-per-call blockchain data API for **NEAR Protocol**, **Solana**, and **Base (Ethereum L2)** — powered by [x402](https://www.x402.org/) USDC micropayments.

**Live:** [ironflip.duckdns.org](https://ironflip.duckdns.org)

## Features

- **24 REST endpoints** across 3 chains (NEAR, Solana, Base)
- **x402 micropayments** — $0.001–$0.005 USDC per call on Solana or Base
- **No API keys, no signup** — just attach an `X-PAYMENT` header
- **Agent-discoverable** — OpenAPI 3.1, A2A agent card, ChatGPT plugin manifest, llms.txt
- **Analytics dashboard** with payment tracking
- **MCP Registry** listed as `io.github.trevorflipper/near-solana-blockchain-api`

## Endpoints

### NEAR Protocol (8)
| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/near/account/{id}/balance` | $0.001 | NEAR balance (total, staked, available) |
| `GET /api/near/account/{id}/keys` | $0.001 | Access keys (full + function-call) |
| `GET /api/near/tx/{hash}?sender_id={id}` | $0.001 | Transaction with receipts and actions |
| `GET /api/near/validators` | $0.002 | Active validator set |
| `GET /api/near/validators/{id}` | $0.001 | Single validator details |
| `GET /api/near/account/{id}/staking` | $0.002 | Staking delegations across pools |
| `GET /api/near/nft/{contract}/tokens` | $0.002 | NFT tokens with metadata |
| `GET /api/near/defi/pools` | $0.005 | Ref Finance liquidity pools |

### Solana (9)
| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/solana/account/{id}/balance` | $0.001 | SOL balance |
| `GET /api/solana/account/{id}/info` | $0.001 | Account metadata |
| `GET /api/solana/account/{id}/tokens` | $0.002 | SPL token holdings |
| `GET /api/solana/account/{id}/stakes` | $0.002 | Stake accounts |
| `GET /api/solana/account/{id}/transactions` | $0.002 | Recent transaction signatures |
| `GET /api/solana/tx/{signature}` | $0.001 | Parsed transaction details |
| `GET /api/solana/validators` | $0.002 | Top vote accounts by stake |
| `GET /api/solana/tokens/prices` | $0.002 | SOL, USDC, JUP, JTO, BONK prices |
| `GET /api/solana/network/stats` | $0.002 | Epoch, TPS, supply |

### Base / Ethereum L2 (7)
| Endpoint | Price | Description |
|----------|-------|-------------|
| `GET /api/base/account/{id}/balance` | $0.001 | ETH balance on Base |
| `GET /api/base/account/{id}/info` | $0.001 | EOA vs contract detection |
| `GET /api/base/account/{id}/tokens` | $0.002 | ERC-20 balances (USDC, DAI, WETH, etc.) |
| `GET /api/base/tx/{hash}` | $0.001 | Transaction details |
| `GET /api/base/block/latest` | $0.002 | Latest block info |
| `GET /api/base/gas` | $0.001 | Current gas price |
| `GET /api/base/network/stats` | $0.002 | Network stats |

## Payment

Payments use the [x402 protocol](https://www.x402.org/). Include an `X-PAYMENT` header with a USDC transaction proof:

- **Solana mainnet** — `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- **Base (EIP-155:8453)** — `eip155:8453`

The facilitator (AutoIncentive) is free — no API key needed.

## Discovery

| Standard | URL |
|----------|-----|
| OpenAPI 3.1 | [/openapi.json](https://ironflip.duckdns.org/openapi.json) |
| A2A Agent Card | [/.well-known/agent-card.json](https://ironflip.duckdns.org/.well-known/agent-card.json) |
| ChatGPT Plugin | [/.well-known/ai-plugin.json](https://ironflip.duckdns.org/.well-known/ai-plugin.json) |
| LLMs.txt | [/llms.txt](https://ironflip.duckdns.org/llms.txt) |
| Dashboard | [/dashboard](https://ironflip.duckdns.org/dashboard) |

## Self-hosting

```bash
git clone https://github.com/trevorflipper/x402-multichain-gateway.git
cd x402-multichain-gateway
npm install
npm run build

# Required env vars for paid mode:
export X402_PAY_TO="<your-solana-usdc-address>"
export X402_BASE_PAY_TO="<your-base-usdc-address>"

npm start
```

Without `X402_PAY_TO`, the gateway runs in free/demo mode (no payment required).

## Tech Stack

- TypeScript + Express
- [@x402/express](https://www.npmjs.com/package/@x402/express) middleware
- [near-api-js](https://www.npmjs.com/package/near-api-js) v5
- Raw JSON-RPC for Solana and Base (no SDK dependencies)
- [better-sqlite3](https://www.npmjs.com/package/better-sqlite3) for analytics

## License

MIT
