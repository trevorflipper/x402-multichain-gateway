/**
 * Agent discovery layer — serves standard manifests so AI agents can find,
 * understand, and consume our API automatically.
 *
 * Standards implemented:
 * - OpenAPI 3.1 spec (/openapi.yaml)
 * - A2A Agent Card (/.well-known/agent-card.json)
 * - llms.txt (/llms.txt)
 * - Legacy AI Plugin (/.well-known/ai-plugin.json)
 */

const BASE_URL = process.env.X402_PUBLIC_URL || "https://ironflip.duckdns.org";

// ─── OpenAPI 3.1 Spec ─────────────────────────────────────────────────────────

export const OPENAPI_SPEC = {
  openapi: "3.1.0",
  info: {
    title: "x402 Multi-Chain Blockchain & Lighter Intelligence API",
    version: "4.0.0",
    description: "Pay-per-call blockchain data API for NEAR Protocol, Solana, and Base (Ethereum L2), plus proprietary Lighter DEX intelligence (spreads, depth, whales, signals, XLP). All data endpoints require x402 USDC micropayment on Solana or Base. No API keys, no signup — just attach a payment header.",
    contact: { email: "openclaw@proton.me" },
  },
  servers: [{ url: BASE_URL, description: "Production" }],
  paths: {
    // NEAR endpoints
    "/api/near/account/{id}/balance": {
      get: {
        operationId: "getNearBalance",
        summary: "NEAR account balance",
        description: "Returns native NEAR balance breakdown (total, staked, available). Price: $0.001 USDC.",
        tags: ["NEAR"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "relay.near" }],
        responses: {
          "200": { description: "Balance data", content: { "application/json": { schema: { type: "object", properties: { account_id: { type: "string" }, total: { type: "string" }, available: { type: "string" }, staked: { type: "string" } } } } } },
          "402": { description: "Payment required — x402 USDC on Solana" },
        },
      },
    },
    "/api/near/account/{id}/keys": {
      get: {
        operationId: "getNearAccessKeys",
        summary: "NEAR access keys",
        description: "Returns all access keys (full + function-call) for an account. Price: $0.001 USDC.",
        tags: ["NEAR"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Access key list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/near/tx/{hash}": {
      get: {
        operationId: "getNearTransaction",
        summary: "NEAR transaction details",
        description: "Returns full transaction with receipts, actions, and status. Requires sender_id query param. Price: $0.001 USDC.",
        tags: ["NEAR"],
        parameters: [
          { name: "hash", in: "path", required: true, schema: { type: "string" } },
          { name: "sender_id", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { "200": { description: "Transaction data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/near/validators": {
      get: {
        operationId: "getNearValidators",
        summary: "NEAR validators",
        description: "Returns current validator set with stake amounts, block production, and slashing status. Price: $0.002 USDC.",
        tags: ["NEAR"],
        responses: { "200": { description: "Validator list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/near/validators/{id}": {
      get: {
        operationId: "getNearValidatorById",
        summary: "NEAR validator details",
        description: "Returns detailed info for a specific validator including uptime percentage. Price: $0.001 USDC.",
        tags: ["NEAR"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Validator detail" }, "402": { description: "Payment required" } },
      },
    },
    "/api/near/account/{id}/staking": {
      get: {
        operationId: "getNearStaking",
        summary: "NEAR staking delegations",
        description: "Returns staking positions across top 50 validators for an account. Price: $0.002 USDC.",
        tags: ["NEAR"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Staking positions" }, "402": { description: "Payment required" } },
      },
    },
    "/api/near/nft/{contract}/tokens": {
      get: {
        operationId: "getNearNftTokens",
        summary: "NEAR NFT tokens",
        description: "Returns NFT tokens on a contract with metadata. Price: $0.002 USDC.",
        tags: ["NEAR"],
        parameters: [
          { name: "contract", in: "path", required: true, schema: { type: "string" } },
          { name: "from_index", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
        ],
        responses: { "200": { description: "NFT token list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/near/defi/pools": {
      get: {
        operationId: "getNearDefiPools",
        summary: "NEAR DeFi pools (Ref Finance)",
        description: "Returns liquidity pool data from Ref Finance. Price: $0.005 USDC.",
        tags: ["NEAR"],
        parameters: [
          { name: "from_index", in: "query", schema: { type: "integer" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 100 } },
        ],
        responses: { "200": { description: "Pool list" }, "402": { description: "Payment required" } },
      },
    },
    // Solana endpoints
    "/api/solana/account/{id}/balance": {
      get: {
        operationId: "getSolanaBalance",
        summary: "SOL balance",
        description: "Returns SOL balance in lamports and SOL. Price: $0.001 USDC.",
        tags: ["Solana"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "vines1vzrYbzLMRdu58ou5XTby4qAqVRLmqo36NKPTg" }],
        responses: { "200": { description: "Balance data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/account/{id}/info": {
      get: {
        operationId: "getSolanaAccountInfo",
        summary: "Solana account info",
        description: "Returns account metadata (owner, executable, rent epoch, data size). Price: $0.001 USDC.",
        tags: ["Solana"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Account info" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/account/{id}/tokens": {
      get: {
        operationId: "getSolanaTokenAccounts",
        summary: "SPL token holdings",
        description: "Returns all SPL token accounts for a wallet, USDC sorted first. Price: $0.002 USDC.",
        tags: ["Solana"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Token account list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/account/{id}/stakes": {
      get: {
        operationId: "getSolanaStakeAccounts",
        summary: "Solana stake accounts",
        description: "Returns staking positions with validator, amount, and activation epoch. Price: $0.002 USDC.",
        tags: ["Solana"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Stake account list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/account/{id}/transactions": {
      get: {
        operationId: "getSolanaRecentTransactions",
        summary: "Recent Solana transactions",
        description: "Returns recent transaction signatures for an address. Price: $0.002 USDC.",
        tags: ["Solana"],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer", maximum: 50, default: 10 } },
        ],
        responses: { "200": { description: "Transaction list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/tx/{signature}": {
      get: {
        operationId: "getSolanaTransaction",
        summary: "Solana transaction details",
        description: "Returns parsed transaction with instructions, logs, and fee. Price: $0.001 USDC.",
        tags: ["Solana"],
        parameters: [{ name: "signature", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Transaction data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/validators": {
      get: {
        operationId: "getSolanaValidators",
        summary: "Solana validators",
        description: "Returns top 30 vote accounts by activated stake with commission rates. Price: $0.002 USDC.",
        tags: ["Solana"],
        responses: { "200": { description: "Validator list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/tokens/prices": {
      get: {
        operationId: "getSolanaTokenPrices",
        summary: "Top Solana token prices",
        description: "Returns prices and 24h change for top Solana tokens (SOL, USDC, JUP, JTO, etc.). Price: $0.002 USDC.",
        tags: ["Solana"],
        responses: { "200": { description: "Token price list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/solana/network/stats": {
      get: {
        operationId: "getSolanaNetworkStats",
        summary: "Solana network statistics",
        description: "Returns epoch info, TPS, total/circulating supply. Price: $0.002 USDC.",
        tags: ["Solana"],
        responses: { "200": { description: "Network stats" }, "402": { description: "Payment required" } },
      },
    },
    // Base endpoints
    "/api/base/account/{id}/balance": {
      get: {
        operationId: "getBaseBalance",
        summary: "ETH balance on Base",
        description: "Returns ETH balance in wei and human-readable ETH on Base L2. Price: $0.001 USDC.",
        tags: ["Base"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, example: "0x364839A584817393D347Aaf40D4f860EE40Fb884" }],
        responses: { "200": { description: "Balance data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/base/account/{id}/info": {
      get: {
        operationId: "getBaseAccountInfo",
        summary: "Base account info",
        description: "Returns account type (EOA vs contract), nonce, balance, and code size. Price: $0.001 USDC.",
        tags: ["Base"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Account info" }, "402": { description: "Payment required" } },
      },
    },
    "/api/base/account/{id}/tokens": {
      get: {
        operationId: "getBaseTokenBalances",
        summary: "ERC-20 token balances on Base",
        description: "Returns balances for popular Base ERC-20 tokens (USDC, USDbC, DAI, WETH, cbETH, AERO). Price: $0.002 USDC.",
        tags: ["Base"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Token balance list" }, "402": { description: "Payment required" } },
      },
    },
    "/api/base/tx/{hash}": {
      get: {
        operationId: "getBaseTransaction",
        summary: "Base transaction details",
        description: "Returns full transaction with receipt, status, gas used, and log count. Price: $0.001 USDC.",
        tags: ["Base"],
        parameters: [{ name: "hash", in: "path", required: true, schema: { type: "string" } }],
        responses: { "200": { description: "Transaction data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/base/block/latest": {
      get: {
        operationId: "getBaseLatestBlock",
        summary: "Latest Base block",
        description: "Returns latest block number, timestamp, tx count, gas used, and base fee. Price: $0.002 USDC.",
        tags: ["Base"],
        responses: { "200": { description: "Block data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/base/gas": {
      get: {
        operationId: "getBaseGasPrice",
        summary: "Base gas price",
        description: "Returns current gas price in wei and gwei on Base L2. Price: $0.001 USDC.",
        tags: ["Base"],
        responses: { "200": { description: "Gas price" }, "402": { description: "Payment required" } },
      },
    },
    "/api/base/network/stats": {
      get: {
        operationId: "getBaseNetworkStats",
        summary: "Base network statistics",
        description: "Returns chain ID, block number, and gas price for Base L2. Price: $0.002 USDC.",
        tags: ["Base"],
        responses: { "200": { description: "Network stats" }, "402": { description: "Payment required" } },
      },
    },
    // Lighter Intelligence endpoints
    "/api/lighter/spreads/current": {
      get: {
        operationId: "getLighterSpreadsCurrent",
        summary: "Current Lighter vs Hyperliquid spreads",
        description: "Returns current bid-ask spreads for BTC/ETH/SOL/HYPE/LIT on both Lighter and Hyperliquid, with spread_diff_bps showing which venue is tighter. 5-minute granularity from continuous collection. Price: $0.01 USDC.",
        tags: ["Lighter Intelligence"],
        responses: { "200": { description: "Current spread data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/lighter/spreads/history": {
      get: {
        operationId: "getLighterSpreadsHistory",
        summary: "Historical spread timeseries",
        description: "Returns historical bid-ask spread timeseries for a symbol. 5-minute granularity, up to 7 days. Includes depth at 0.3% bands for both exchanges. Price: $0.03 USDC.",
        tags: ["Lighter Intelligence"],
        parameters: [
          { name: "symbol", in: "query", required: true, schema: { type: "string", enum: ["BTC", "ETH", "SOL", "HYPE", "LIT"] }, description: "Trading pair symbol" },
          { name: "hours", in: "query", schema: { type: "integer", maximum: 168, default: 24 }, description: "Hours of history (max 168 = 7 days)" },
        ],
        responses: { "200": { description: "Spread history timeseries" }, "402": { description: "Payment required" } },
      },
    },
    "/api/lighter/depth/current": {
      get: {
        operationId: "getLighterDepthCurrent",
        summary: "Current order book depth snapshot",
        description: "Returns current order book depth across all markets at 0.3% band, comparing Lighter and Hyperliquid. Shows which venue has deeper liquidity per market. Price: $0.01 USDC.",
        tags: ["Lighter Intelligence"],
        responses: { "200": { description: "Depth snapshot" }, "402": { description: "Payment required" } },
      },
    },
    "/api/lighter/whales": {
      get: {
        operationId: "getLighterWhales",
        summary: "Lighter whale positions",
        description: "Returns live whale positions on Lighter DEX — bias (long/short), total value, net exposure, unrealized PnL, and individual positions. Price: $0.02 USDC.",
        tags: ["Lighter Intelligence"],
        responses: { "200": { description: "Whale position data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/lighter/signals": {
      get: {
        operationId: "getLighterSignals",
        summary: "Lighter signal wallet scores",
        description: "Returns signal wallet scores with S/A/B tier classification, total scores, and PnL metrics. S-tier wallets have historically strong performance. Price: $0.02 USDC.",
        tags: ["Lighter Intelligence"],
        responses: { "200": { description: "Signal score data" }, "402": { description: "Payment required" } },
      },
    },
    "/api/lighter/xlp": {
      get: {
        operationId: "getLighterXlp",
        summary: "XLP experimental LP data",
        description: "Returns XLP (experimental liquidity provider) data across 26 markets — collateral, volume share, fees earned, PnL, position direction. Includes snapshot + recent history. Price: $0.02 USDC.",
        tags: ["Lighter Intelligence"],
        responses: { "200": { description: "XLP LP data" }, "402": { description: "Payment required" } },
      },
    },
  },
  "x-x402-payment": [
    {
      chain: "Solana",
      token: "USDC",
      network: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
      payTo: "91xx1zU7hV59fiYq9jzJtThzgHkzm1JRjtgeKK1TGwA7",
      facilitator: "https://facilitator.x402endpoints.online",
      protocol: "https://x402.org",
    },
    {
      chain: "Base",
      token: "USDC",
      network: "eip155:8453",
      payTo: "0x364839A584817393D347Aaf40D4f860EE40Fb884",
      facilitator: "https://facilitator.x402endpoints.online",
      protocol: "https://x402.org",
    },
  ],
};

// ─── A2A Agent Card ───────────────────────────────────────────────────────────

export const AGENT_CARD = {
  name: "x402 Multi-Chain Blockchain & Lighter Intelligence API",
  description: "Pay-per-call blockchain data for NEAR Protocol, Solana, and Base (Ethereum L2), plus proprietary Lighter DEX intelligence (spread analytics, order book depth, whale positions, signal wallets, XLP LP tracking). Returns account balances, token holdings, validators, staking positions, transactions, DeFi pools, and unique market microstructure data. All endpoints accept x402 USDC micropayments on Solana or Base — no API keys, no signup.",
  url: BASE_URL,
  provider: {
    organization: "OpenClaw",
    url: BASE_URL,
  },
  version: "4.0.0",
  documentationUrl: `${BASE_URL}/openapi.json`,
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: {
    schemes: ["x402"],
    credentials: null,
  },
  defaultInputModes: ["application/json"],
  defaultOutputModes: ["application/json"],
  skills: [
    {
      id: "near-balance",
      name: "NEAR Account Balance",
      description: "Get NEAR token balance for any account (total, staked, available)",
      tags: ["near", "blockchain", "balance", "wallet"],
      examples: ["What is the balance of relay.near?", "Check NEAR account aurora.near"],
    },
    {
      id: "near-validators",
      name: "NEAR Validators",
      description: "List current NEAR validators with stake, uptime, and slashing status",
      tags: ["near", "validators", "staking", "proof-of-stake"],
      examples: ["Show NEAR validators", "Which NEAR validator has highest uptime?"],
    },
    {
      id: "near-staking",
      name: "NEAR Staking Positions",
      description: "Get staking delegations for any NEAR account across validator pools",
      tags: ["near", "staking", "delegation", "yield"],
      examples: ["Show staking for relay.near", "Where is this account staking?"],
    },
    {
      id: "near-defi",
      name: "NEAR DeFi Pools",
      description: "Get Ref Finance liquidity pool data on NEAR",
      tags: ["near", "defi", "liquidity", "ref-finance", "yield"],
      examples: ["Show top DeFi pools on NEAR", "What are the best NEAR liquidity pools?"],
    },
    {
      id: "solana-balance",
      name: "Solana Balance",
      description: "Get SOL balance for any Solana address",
      tags: ["solana", "blockchain", "balance", "wallet"],
      examples: ["What is this Solana wallet balance?", "Check SOL balance"],
    },
    {
      id: "solana-tokens",
      name: "Solana Token Holdings",
      description: "Get all SPL token holdings for a Solana wallet (USDC, JUP, etc.)",
      tags: ["solana", "tokens", "spl", "portfolio", "usdc"],
      examples: ["Show tokens in this Solana wallet", "What USDC does this address hold?"],
    },
    {
      id: "solana-prices",
      name: "Solana Token Prices",
      description: "Get current prices and 24h changes for top Solana tokens",
      tags: ["solana", "prices", "market", "sol", "usdc", "jup", "bonk"],
      examples: ["What is SOL price?", "Show Solana token prices", "How much is JUP worth?"],
    },
    {
      id: "solana-network",
      name: "Solana Network Stats",
      description: "Get Solana network statistics: epoch, TPS, total and circulating supply",
      tags: ["solana", "network", "tps", "epoch", "supply"],
      examples: ["What is Solana TPS?", "Show Solana network stats", "Current Solana epoch?"],
    },
    {
      id: "solana-staking",
      name: "Solana Staking",
      description: "Get stake accounts and validator delegations for a Solana wallet",
      tags: ["solana", "staking", "validators", "delegation"],
      examples: ["Show staking for this Solana address", "Where is this wallet staking SOL?"],
    },
    {
      id: "solana-tx",
      name: "Solana Transaction Details",
      description: "Get parsed transaction data with instructions, logs, and fees",
      tags: ["solana", "transaction", "explorer"],
      examples: ["Show details for this Solana transaction"],
    },
    {
      id: "base-balance",
      name: "Base ETH Balance",
      description: "Get ETH balance for any address on Base L2",
      tags: ["base", "ethereum", "l2", "balance", "wallet"],
      examples: ["What is the ETH balance on Base?", "Check Base wallet balance"],
    },
    {
      id: "base-tokens",
      name: "Base Token Balances",
      description: "Get ERC-20 token balances (USDC, WETH, DAI, AERO, etc.) for an address on Base",
      tags: ["base", "erc20", "tokens", "usdc", "portfolio"],
      examples: ["Show Base token holdings", "What USDC does this address hold on Base?"],
    },
    {
      id: "base-tx",
      name: "Base Transaction Details",
      description: "Get transaction details with receipt, status, and gas info on Base L2",
      tags: ["base", "transaction", "explorer", "ethereum"],
      examples: ["Show details for this Base transaction"],
    },
    {
      id: "base-network",
      name: "Base Network Stats",
      description: "Get Base L2 network stats: block number, gas price, latest block info",
      tags: ["base", "network", "gas", "block", "l2"],
      examples: ["What is Base gas price?", "Show Base network stats", "Latest Base block?"],
    },
    {
      id: "lighter-spreads",
      name: "Lighter vs Hyperliquid Spreads",
      description: "Get current and historical bid-ask spreads comparing Lighter DEX and Hyperliquid. 5-minute granularity, up to 7 days of history.",
      tags: ["lighter", "hyperliquid", "spreads", "market-microstructure", "dex"],
      examples: ["Compare Lighter and Hyperliquid BTC spreads", "Show ETH spread history for 24 hours"],
    },
    {
      id: "lighter-depth",
      name: "DEX Order Book Depth",
      description: "Get current order book depth comparison between Lighter and Hyperliquid at 0.3% band across all markets",
      tags: ["lighter", "hyperliquid", "depth", "orderbook", "liquidity"],
      examples: ["Which DEX has deeper BTC liquidity?", "Show current DEX depth comparison"],
    },
    {
      id: "lighter-whales",
      name: "Lighter Whale Positions",
      description: "Get live whale positions on Lighter DEX — directional bias, total value, net exposure, and PnL",
      tags: ["lighter", "whales", "positions", "smart-money", "alpha"],
      examples: ["What are Lighter whales doing?", "Show whale positions on Lighter"],
    },
    {
      id: "lighter-signals",
      name: "Lighter Signal Wallets",
      description: "Get tiered signal wallet scores (S/A/B) based on historical trading performance on Lighter DEX",
      tags: ["lighter", "signals", "alpha", "wallets", "performance"],
      examples: ["Show S-tier signal wallets on Lighter", "Which wallets have best track records?"],
    },
    {
      id: "lighter-xlp",
      name: "XLP Liquidity Provider Data",
      description: "Get XLP experimental LP data — collateral, volume share, fees earned, PnL across 26 markets",
      tags: ["lighter", "xlp", "liquidity", "lp", "market-making"],
      examples: ["Show XLP LP performance", "How is XLP doing across markets?"],
    },
  ],
};

// ─── AI Plugin Manifest (Legacy) ──────────────────────────────────────────────

export const AI_PLUGIN = {
  schema_version: "v1",
  name_for_human: "Blockchain Data API",
  name_for_model: "blockchain_data_x402",
  description_for_human: "NEAR, Solana & Base blockchain data via x402 micropayments.",
  description_for_model: "API for querying NEAR Protocol, Solana, and Base (Ethereum L2) blockchain data, plus proprietary Lighter DEX intelligence (spread analytics, order book depth, whale positions, signal wallets, XLP LP tracking). Use this to look up account balances, token holdings, transaction details, validator information, staking positions, NFT tokens, DeFi pools, and unique market microstructure data comparing Lighter and Hyperliquid. All endpoints require x402 USDC payment on Solana mainnet or Base — send a payment header with each request. Blockchain endpoints: $0.001-$0.005. Lighter intelligence: $0.01-$0.03 per call.",
  auth: { type: "none" },
  api: {
    type: "openapi",
    url: `${BASE_URL}/openapi.json`,
    is_user_authenticated: false,
  },
  logo_url: `${BASE_URL}/logo.png`,
  contact_email: "openclaw@proton.me",
  legal_info_url: `${BASE_URL}/`,
};

// ─── llms.txt ─────────────────────────────────────────────────────────────────

export const LLMS_TXT = `# x402 Multi-Chain Blockchain & Lighter Intelligence API

> Pay-per-call NEAR Protocol, Solana, Base blockchain data, and proprietary Lighter DEX intelligence. All endpoints accept x402 USDC micropayments on Solana or Base. No API keys, no signup — just attach a payment header.

This API serves real-time blockchain data across three chains (NEAR, Solana & Base) plus unique Lighter DEX market intelligence with 30 endpoints. Blockchain endpoints cost $0.001-$0.005 USDC. Lighter intelligence endpoints cost $0.01-$0.03 USDC (premium, unique data). Agents pay by including an X-PAYMENT header with a USDC transaction proof on Solana or Base.

## NEAR Protocol Endpoints (8)

- [Account Balance](${BASE_URL}/api/near/account/{id}/balance): GET — Returns NEAR balance (total, staked, available). $0.001
- [Access Keys](${BASE_URL}/api/near/account/{id}/keys): GET — Returns full and function-call access keys. $0.001
- [Transaction](${BASE_URL}/api/near/tx/{hash}?sender_id={sender}): GET — Full transaction with receipts and actions. $0.001
- [Validators](${BASE_URL}/api/near/validators): GET — Current validator set with stake and uptime. $0.002
- [Validator Detail](${BASE_URL}/api/near/validators/{id}): GET — Single validator with uptime percentage. $0.001
- [Staking](${BASE_URL}/api/near/account/{id}/staking): GET — Staking delegations across pools. $0.002
- [NFT Tokens](${BASE_URL}/api/near/nft/{contract}/tokens): GET — NFTs with metadata on a contract. $0.002
- [DeFi Pools](${BASE_URL}/api/near/defi/pools): GET — Ref Finance liquidity pools. $0.005

## Solana Endpoints (9)

- [SOL Balance](${BASE_URL}/api/solana/account/{id}/balance): GET — SOL balance in lamports and SOL. $0.001
- [Account Info](${BASE_URL}/api/solana/account/{id}/info): GET — Account metadata (owner, executable). $0.001
- [Token Holdings](${BASE_URL}/api/solana/account/{id}/tokens): GET — All SPL tokens, USDC first. $0.002
- [Stake Accounts](${BASE_URL}/api/solana/account/{id}/stakes): GET — Staking positions with validators. $0.002
- [Recent Transactions](${BASE_URL}/api/solana/account/{id}/transactions): GET — Recent tx signatures. $0.002
- [Transaction Detail](${BASE_URL}/api/solana/tx/{signature}): GET — Parsed tx with instructions and logs. $0.001
- [Validators](${BASE_URL}/api/solana/validators): GET — Top 30 vote accounts by stake. $0.002
- [Token Prices](${BASE_URL}/api/solana/tokens/prices): GET — SOL, USDC, JUP, JTO, BONK prices + 24h change. $0.002
- [Network Stats](${BASE_URL}/api/solana/network/stats): GET — Epoch, TPS, supply. $0.002

## Base (Ethereum L2) Endpoints (7)

- [ETH Balance](${BASE_URL}/api/base/account/{id}/balance): GET — ETH balance in wei and human-readable. $0.001
- [Account Info](${BASE_URL}/api/base/account/{id}/info): GET — EOA vs contract, nonce, code size. $0.001
- [Token Balances](${BASE_URL}/api/base/account/{id}/tokens): GET — ERC-20 balances (USDC, WETH, DAI, AERO, etc.). $0.002
- [Transaction](${BASE_URL}/api/base/tx/{hash}): GET — Full tx with receipt, status, gas used. $0.001
- [Latest Block](${BASE_URL}/api/base/block/latest): GET — Block number, timestamp, tx count, gas. $0.002
- [Gas Price](${BASE_URL}/api/base/gas): GET — Current gas price in gwei. $0.001
- [Network Stats](${BASE_URL}/api/base/network/stats): GET — Chain ID, block number, gas price. $0.002

## Lighter DEX Intelligence Endpoints (6) — Premium

Proprietary data from continuous collection (5-min granularity, 22+ days of history). This data is unique — no other API provides structured Lighter vs Hyperliquid spread/depth comparisons.

- [Current Spreads](\${BASE_URL}/api/lighter/spreads/current): GET — Current bid-ask spreads for BTC/ETH/SOL/HYPE/LIT on both venues. $0.01
- [Spread History](\${BASE_URL}/api/lighter/spreads/history?symbol=BTC&hours=24): GET — Historical spread timeseries, 5-min granularity, up to 7 days. $0.03
- [Current Depth](\${BASE_URL}/api/lighter/depth/current): GET — Order book depth at 0.3% band, both exchanges, all markets. $0.01
- [Whale Positions](\${BASE_URL}/api/lighter/whales): GET — Live whale positions, bias, PnL, net exposure. $0.02
- [Signal Scores](\${BASE_URL}/api/lighter/signals): GET — Tiered signal wallet scores (S/A/B), performance metrics. $0.02
- [XLP LP Data](\${BASE_URL}/api/lighter/xlp): GET — XLP experimental LP across 26 markets: collateral, volume, fees, PnL. $0.02

## Payment

- Protocol: [x402](https://x402.org) — HTTP 402 payment flow
- Accepted on: Solana mainnet OR Base (Ethereum L2)
- Token: USDC
- Solana pay-to: 91xx1zU7hV59fiYq9jzJtThzgHkzm1JRjtgeKK1TGwA7
- Base pay-to: 0x364839A584817393D347Aaf40D4f860EE40Fb884
- Facilitator: https://facilitator.x402endpoints.online

## Documentation

- [OpenAPI Spec](${BASE_URL}/openapi.json): Full OpenAPI 3.1 specification
- [Agent Card](${BASE_URL}/.well-known/agent-card.json): A2A agent discovery manifest
- [Analytics Dashboard](${BASE_URL}/dashboard): Live usage stats

## Optional

- [Health Check](${BASE_URL}/health): Service status
- [Analytics API](${BASE_URL}/api/analytics/summary): JSON usage stats
`;
