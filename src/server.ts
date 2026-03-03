import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { registerExactSvmScheme } from "@x402/svm/exact/server";
import { registerExactEvmScheme } from "@x402/evm/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { declareDiscoveryExtension, bazaarResourceServerExtension } from "@x402/extensions/bazaar";
import { NearClient } from "./near-client.js";
import { NearService } from "./near-service.js";
import { SolanaClient } from "./solana-client.js";
import { SolanaService } from "./solana-service.js";
import { BaseClient } from "./base-client.js";
import { BaseService } from "./base-service.js";
import * as analytics from "./analytics.js";
import { DASHBOARD_HTML } from "./dashboard.js";
import { OPENAPI_SPEC, AGENT_CARD, AI_PLUGIN, LLMS_TXT } from "./discovery.js";
import path from "path";

// ─── Config ──────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.X402_PORT || "8084", 10);
const HOST = process.env.X402_HOST || "127.0.0.1";

// Solana wallet address to receive USDC payments.
// Set via X402_PAY_TO env var. If not set, gateway runs in free/demo mode.
const PAY_TO = process.env.X402_PAY_TO || "";

// Solana mainnet CAIP-2 identifier
const NETWORK = (process.env.X402_NETWORK || "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp") as `${string}:${string}`;

// Base L2 wallet address to receive USDC payments
const BASE_PAY_TO = process.env.X402_BASE_PAY_TO || "0x364839A584817393D347Aaf40D4f860EE40Fb884";

// Base mainnet CAIP-2 identifier (EIP-155 chain ID 8453)
const BASE_NETWORK = (process.env.X402_BASE_NETWORK || "eip155:8453") as `${string}:${string}`;

// AutoIncentive facilitator — free, supports Solana mainnet + Base
const FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://facilitator.x402endpoints.online";

const FREE_MODE = !PAY_TO;

// ─── Analytics DB ─────────────────────────────────────────────────────────────

const DB_PATH = process.env.ANALYTICS_DB_PATH || path.resolve(process.cwd(), "analytics.db");
analytics.initDb(DB_PATH);

// ─── NEAR Client ─────────────────────────────────────────────────────────────

const nearClient = new NearClient();
const nearService = new NearService(nearClient);

// ─── Solana Client ────────────────────────────────────────────────────────────

const solanaClient = new SolanaClient();
const solanaService = new SolanaService(solanaClient);

// ─── Base Client ─────────────────────────────────────────────────────────────

const baseClient = new BaseClient();
const baseService = new BaseService(baseClient);

// ─── Express App ─────────────────────────────────────────────────────────────

const app = express();
app.set("trust proxy", true);
app.use(express.json());

// ─── Request Logging Middleware ───────────────────────────────────────────────

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    // Skip logging analytics/dashboard requests to avoid noise
    if (req.path.startsWith("/api/analytics") || req.path === "/dashboard") return;
    try {
      analytics.logRequest({
        method: req.method,
        path: req.path,
        status_code: res.statusCode,
        ip: req.ip || req.socket.remoteAddress || "",
        user_agent: (req.headers["user-agent"] || "").slice(0, 512),
        response_time_ms: Date.now() - start,
      });
    } catch (_) {
      // Don't let analytics errors break requests
    }
  });
  next();
});

// ─── Dashboard & Analytics API (free, before x402 middleware) ─────────────────

app.get("/dashboard", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(DASHBOARD_HTML);
});

app.get("/api/analytics/summary", (_req, res) => {
  res.json(analytics.getStats());
});

app.get("/api/analytics/payments", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 50, 200);
  res.json(analytics.getRecentPayments(limit));
});

app.get("/api/analytics/payers", (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  res.json(analytics.getTopPayers(limit));
});

app.get("/api/analytics/endpoints", (_req, res) => {
  res.json(analytics.getEndpointStats());
});

app.get("/api/analytics/timeseries", (req, res) => {
  const period = req.query.period === "hour" ? "hour" : "day";
  res.json(analytics.getTimeSeries(period));
});

// ─── Agent Discovery (free, no x402) ──────────────────────────────────────────

app.get("/openapi.json", (_req, res) => { res.json(OPENAPI_SPEC); });
app.get("/openapi.yaml", (_req, res) => {
  res.setHeader("Content-Type", "text/yaml");
  // Serve JSON with yaml content-type — most consumers parse both
  res.send(JSON.stringify(OPENAPI_SPEC, null, 2));
});
app.get("/.well-known/agent-card.json", (_req, res) => { res.json(AGENT_CARD); });
app.get("/.well-known/ai-plugin.json", (_req, res) => { res.json(AI_PLUGIN); });
app.get("/llms.txt", (_req, res) => {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(LLMS_TXT);
});

// Health check (always free)
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "x402-multi-chain-gateway",
    mode: FREE_MODE ? "free" : "paid",
    chains: ["near", "solana", "base"],
    networks: {
      solana: NETWORK,
      base: BASE_NETWORK,
      near: process.env.NEAR_NETWORK_ID || "mainnet",
    },
  });
});

// API info (always free)
app.get("/", (_req, res) => {
  res.json({
    name: "x402 Blockchain Data API",
    version: "3.0.0",
    description: "Pay-per-call multi-chain blockchain data API powered by x402 (NEAR, Solana & Base)",
    mode: FREE_MODE ? "free (no wallet configured)" : "paid",
    total_endpoints: 24,
    chains: {
      near: {
        endpoints: {
          "GET /api/near/account/[id]/balance": { price: "$0.001", description: "Account balance" },
          "GET /api/near/account/[id]/keys": { price: "$0.001", description: "Access keys" },
          "GET /api/near/tx/[hash]": { price: "$0.001", description: "Transaction details" },
          "GET /api/near/validators": { price: "$0.002", description: "Active validators" },
          "GET /api/near/validators/[id]": { price: "$0.001", description: "Validator details" },
          "GET /api/near/account/[id]/staking": { price: "$0.002", description: "Staking delegations" },
          "GET /api/near/nft/[contract]/tokens": { price: "$0.002", description: "NFT tokens" },
          "GET /api/near/defi/pools": { price: "$0.005", description: "Ref Finance pools" },
        },
      },
      solana: {
        endpoints: {
          "GET /api/solana/account/[id]/balance": { price: "$0.001", description: "SOL balance" },
          "GET /api/solana/account/[id]/info": { price: "$0.001", description: "Account info" },
          "GET /api/solana/account/[id]/tokens": { price: "$0.002", description: "SPL token holdings" },
          "GET /api/solana/account/[id]/stakes": { price: "$0.002", description: "Stake accounts" },
          "GET /api/solana/account/[id]/transactions": { price: "$0.002", description: "Recent transactions" },
          "GET /api/solana/tx/[signature]": { price: "$0.001", description: "Transaction details" },
          "GET /api/solana/validators": { price: "$0.002", description: "Vote accounts / validators" },
          "GET /api/solana/tokens/prices": { price: "$0.002", description: "Top token prices (Jupiter)" },
          "GET /api/solana/network/stats": { price: "$0.002", description: "Network stats (epoch, TPS, supply)" },
        },
      },
      base: {
        endpoints: {
          "GET /api/base/account/[id]/balance": { price: "$0.001", description: "ETH balance on Base" },
          "GET /api/base/account/[id]/info": { price: "$0.001", description: "Account info (EOA vs contract)" },
          "GET /api/base/account/[id]/tokens": { price: "$0.002", description: "ERC-20 token balances" },
          "GET /api/base/tx/[hash]": { price: "$0.001", description: "Transaction details" },
          "GET /api/base/block/latest": { price: "$0.002", description: "Latest block info" },
          "GET /api/base/gas": { price: "$0.001", description: "Current gas price" },
          "GET /api/base/network/stats": { price: "$0.002", description: "Network stats" },
        },
      },
    },
    analytics: {
      dashboard: "/dashboard",
      api: "/api/analytics/summary",
    },
    payment: FREE_MODE
      ? "Gateway running in free mode. Set X402_PAY_TO to enable payments."
      : [
          { chain: "Solana", token: "USDC", network: NETWORK, payTo: PAY_TO },
          { chain: "Base", token: "USDC", network: BASE_NETWORK, payTo: BASE_PAY_TO },
        ],
  });
});

// ─── x402 Payment Middleware ─────────────────────────────────────────────────

// Price map used by both payment middleware and the onAfterSettle hook
const PRICE_MAP: Record<string, string> = {
  // NEAR endpoints
  "GET /api/near/account/[id]/balance": "$0.001",
  "GET /api/near/account/[id]/keys": "$0.001",
  "GET /api/near/tx/[hash]": "$0.001",
  "GET /api/near/validators": "$0.002",
  "GET /api/near/validators/[id]": "$0.001",
  "GET /api/near/account/[id]/staking": "$0.002",
  "GET /api/near/nft/[contract]/tokens": "$0.002",
  "GET /api/near/defi/pools": "$0.005",
  // Solana endpoints
  "GET /api/solana/account/[id]/balance": "$0.001",
  "GET /api/solana/account/[id]/info": "$0.001",
  "GET /api/solana/account/[id]/tokens": "$0.002",
  "GET /api/solana/account/[id]/stakes": "$0.002",
  "GET /api/solana/account/[id]/transactions": "$0.002",
  "GET /api/solana/tx/[signature]": "$0.001",
  "GET /api/solana/validators": "$0.002",
  "GET /api/solana/tokens/prices": "$0.002",
  "GET /api/solana/network/stats": "$0.002",
  // Base endpoints
  "GET /api/base/account/[id]/balance": "$0.001",
  "GET /api/base/account/[id]/info": "$0.001",
  "GET /api/base/account/[id]/tokens": "$0.002",
  "GET /api/base/tx/[hash]": "$0.001",
  "GET /api/base/block/latest": "$0.002",
  "GET /api/base/gas": "$0.001",
  "GET /api/base/network/stats": "$0.002",
};

// ─── Bazaar Discovery Metadata ────────────────────────────────────────────────

const ROUTE_DISCOVERY: Record<string, ReturnType<typeof declareDiscoveryExtension>> = {
  // NEAR endpoints
  "GET /api/near/account/[id]/balance": declareDiscoveryExtension({
    input: { id: "example.near" },
    inputSchema: { properties: { id: { type: "string", description: "NEAR account ID" } }, required: ["id"] },
    output: { example: { account_id: "example.near", balance: "1000000000000000000000000", balance_near: "1.0" } },
  }),
  "GET /api/near/account/[id]/keys": declareDiscoveryExtension({
    input: { id: "example.near" },
    inputSchema: { properties: { id: { type: "string", description: "NEAR account ID" } }, required: ["id"] },
    output: { example: { account_id: "example.near", keys: [{ public_key: "ed25519:...", access_key: { permission: "FullAccess" } }] } },
  }),
  "GET /api/near/tx/[hash]": declareDiscoveryExtension({
    input: { hash: "abc123", sender_id: "example.near" },
    inputSchema: { properties: { hash: { type: "string", description: "Transaction hash" }, sender_id: { type: "string", description: "Sender account ID (query param)" } }, required: ["hash", "sender_id"] },
    output: { example: { hash: "abc123", signer_id: "example.near", receiver_id: "target.near", status: "success" } },
  }),
  "GET /api/near/validators": declareDiscoveryExtension({
    output: { example: { validators: [{ account_id: "validator.poolv1.near", stake: "1000000" }] } },
  }),
  "GET /api/near/validators/[id]": declareDiscoveryExtension({
    input: { id: "validator.poolv1.near" },
    inputSchema: { properties: { id: { type: "string", description: "Validator account ID" } }, required: ["id"] },
    output: { example: { account_id: "validator.poolv1.near", stake: "1000000", is_active: true } },
  }),
  "GET /api/near/account/[id]/staking": declareDiscoveryExtension({
    input: { id: "example.near" },
    inputSchema: { properties: { id: { type: "string", description: "NEAR account ID" } }, required: ["id"] },
    output: { example: { account_id: "example.near", staking: [{ pool: "validator.poolv1.near", amount: "500" }] } },
  }),
  "GET /api/near/nft/[contract]/tokens": declareDiscoveryExtension({
    input: { contract: "nft.example.near" },
    inputSchema: { properties: { contract: { type: "string", description: "NFT contract account ID" } }, required: ["contract"] },
    output: { example: { contract: "nft.example.near", tokens: [{ token_id: "1", owner_id: "owner.near" }] } },
  }),
  "GET /api/near/defi/pools": declareDiscoveryExtension({
    output: { example: { pools: [{ id: 1, token_account_ids: ["wrap.near", "usdt.tether-token.near"], amounts: ["100", "200"] }] } },
  }),
  // Solana endpoints
  "GET /api/solana/account/[id]/balance": declareDiscoveryExtension({
    input: { id: "So11111111111111111111111111111111111111112" },
    inputSchema: { properties: { id: { type: "string", description: "Solana public key (base58)" } }, required: ["id"] },
    output: { example: { address: "So1...", lamports: 1000000000, sol: 1.0, network: "mainnet-beta" } },
  }),
  "GET /api/solana/account/[id]/info": declareDiscoveryExtension({
    input: { id: "So11111111111111111111111111111111111111112" },
    inputSchema: { properties: { id: { type: "string", description: "Solana public key (base58)" } }, required: ["id"] },
    output: { example: { address: "So1...", exists: true, lamports: 1000000000, sol: 1.0, owner: "11111111111111111111111111111111" } },
  }),
  "GET /api/solana/account/[id]/tokens": declareDiscoveryExtension({
    input: { id: "So11111111111111111111111111111111111111112" },
    inputSchema: { properties: { id: { type: "string", description: "Solana wallet public key" } }, required: ["id"] },
    output: { example: { owner: "So1...", token_count: 5, tokens: [{ mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", amount: "100.0", is_usdc: true }] } },
  }),
  "GET /api/solana/account/[id]/stakes": declareDiscoveryExtension({
    input: { id: "So11111111111111111111111111111111111111112" },
    inputSchema: { properties: { id: { type: "string", description: "Solana wallet public key" } }, required: ["id"] },
    output: { example: { owner: "So1...", stake_accounts: 2, total_staked_sol: 100.5 } },
  }),
  "GET /api/solana/account/[id]/transactions": declareDiscoveryExtension({
    input: { id: "So11111111111111111111111111111111111111112" },
    inputSchema: { properties: { id: { type: "string", description: "Solana public key" } }, required: ["id"] },
    output: { example: { address: "So1...", count: 10, transactions: [{ signature: "abc...", success: true }] } },
  }),
  "GET /api/solana/tx/[signature]": declareDiscoveryExtension({
    input: { signature: "abc123def456" },
    inputSchema: { properties: { signature: { type: "string", description: "Transaction signature (base58)" } }, required: ["signature"] },
    output: { example: { signature: "abc123...", found: true, slot: 123456, success: true, fee_sol: 0.000005 } },
  }),
  "GET /api/solana/validators": declareDiscoveryExtension({
    output: { example: { current_count: 1500, delinquent_count: 50, top_validators: [{ vote_pubkey: "...", activated_stake_sol: 1000000 }] } },
  }),
  "GET /api/solana/tokens/prices": declareDiscoveryExtension({
    output: { example: { tokens: [{ symbol: "SOL", price_usd: 150.0, change_24h_pct: 2.5 }], source: "coingecko" } },
  }),
  "GET /api/solana/network/stats": declareDiscoveryExtension({
    output: { example: { epoch: 500, avg_tps: 3000, total_supply_sol: 570000000, circulating_supply_sol: 420000000 } },
  }),
  // Base endpoints
  "GET /api/base/account/[id]/balance": declareDiscoveryExtension({
    input: { id: "0x364839A584817393D347Aaf40D4f860EE40Fb884" },
    inputSchema: { properties: { id: { type: "string", description: "Ethereum address (0x...)" } }, required: ["id"] },
    output: { example: { address: "0x364...", wei: "1000000000000000000", eth: 1.0, chain_id: 8453 } },
  }),
  "GET /api/base/account/[id]/info": declareDiscoveryExtension({
    input: { id: "0x364839A584817393D347Aaf40D4f860EE40Fb884" },
    inputSchema: { properties: { id: { type: "string", description: "Ethereum address (0x...)" } }, required: ["id"] },
    output: { example: { address: "0x364...", is_contract: false, nonce: 5, balance_eth: 1.0 } },
  }),
  "GET /api/base/account/[id]/tokens": declareDiscoveryExtension({
    input: { id: "0x364839A584817393D347Aaf40D4f860EE40Fb884" },
    inputSchema: { properties: { id: { type: "string", description: "Ethereum address (0x...)" } }, required: ["id"] },
    output: { example: { address: "0x364...", token_count: 3, tokens: [{ symbol: "USDC", balance: 100.5 }] } },
  }),
  "GET /api/base/tx/[hash]": declareDiscoveryExtension({
    input: { hash: "0xabc123..." },
    inputSchema: { properties: { hash: { type: "string", description: "Transaction hash (0x...)" } }, required: ["hash"] },
    output: { example: { hash: "0xabc...", found: true, from: "0x...", to: "0x...", status: "success" } },
  }),
  "GET /api/base/block/latest": declareDiscoveryExtension({
    output: { example: { number: 25000000, timestamp_iso: "2026-03-02T12:00:00.000Z", transaction_count: 150 } },
  }),
  "GET /api/base/gas": declareDiscoveryExtension({
    output: { example: { gas_price_gwei: 0.005, chain_id: 8453 } },
  }),
  "GET /api/base/network/stats": declareDiscoveryExtension({
    output: { example: { chain_id: 8453, block_number: 25000000, gas_price_gwei: 0.005 } },
  }),
};

if (!FREE_MODE) {
  const facilitatorClient = new HTTPFacilitatorClient({
    url: FACILITATOR_URL,
  });
  const resourceServer = new x402ResourceServer(facilitatorClient);
  registerExactSvmScheme(resourceServer);
  registerExactEvmScheme(resourceServer);
  resourceServer.registerExtension(bazaarResourceServerExtension);

  // Register payment settlement hook for analytics
  resourceServer.onAfterSettle(async (context) => {
    try {
      const payer = context.result.payer || "unknown";
      const txHash = context.result.transaction || "";
      const network = typeof context.result.network === "string"
        ? context.result.network
        : NETWORK;
      const amount = context.requirements?.amount || "0";
      // Parse dollar amount from requirements (amount is in smallest unit for USDC = 6 decimals)
      const amountUsd = parseInt(amount, 10) / 1_000_000;
      // Extract endpoint from payment payload resource URL
      const resourceUrl = context.paymentPayload?.resource?.url || "";
      let endpoint = "";
      try {
        endpoint = new URL(resourceUrl).pathname;
      } catch {
        endpoint = resourceUrl;
      }

      analytics.logPayment({
        payer,
        tx_hash: txHash,
        amount,
        amount_usd: amountUsd,
        endpoint,
        network,
        ip: "",
        user_agent: "",
      });
      console.log(`[analytics] Payment settled: ${payer} → ${endpoint} (${amountUsd} USDC) tx:${txHash.slice(0, 16)}...`);
    } catch (err) {
      console.error("[analytics] Failed to log payment:", err);
    }
  });

  const routeConfig: Record<string, any> = {};
  for (const [route, price] of Object.entries(PRICE_MAP)) {
    routeConfig[route] = {
      accepts: [
        { scheme: "exact" as const, price, network: NETWORK, payTo: PAY_TO },
        { scheme: "exact" as const, price, network: BASE_NETWORK, payTo: BASE_PAY_TO },
      ],
      description: "Blockchain data endpoint",
      mimeType: "application/json",
      ...(ROUTE_DISCOVERY[route] ? { extensions: { ...ROUTE_DISCOVERY[route] } } : {}),
    };
  }

  app.use(paymentMiddleware(routeConfig, resourceServer));
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

// Account balance
app.get("/api/near/account/:id/balance", async (req, res) => {
  try {
    const data = await nearService.getBalance(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Access keys
app.get("/api/near/account/:id/keys", async (req, res) => {
  try {
    const data = await nearService.getAccessKeys(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Transaction details
app.get("/api/near/tx/:hash", async (req, res) => {
  try {
    const senderId = req.query.sender_id as string;
    if (!senderId) {
      res.status(400).json({ error: "sender_id query parameter is required" });
      return;
    }
    const data = await nearService.getTransaction(req.params.hash, senderId);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// All validators
app.get("/api/near/validators", async (_req, res) => {
  try {
    const data = await nearService.getValidators();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Single validator
app.get("/api/near/validators/:id", async (req, res) => {
  try {
    const data = await nearService.getValidatorById(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Staking delegations for account
app.get("/api/near/account/:id/staking", async (req, res) => {
  try {
    const data = await nearService.getStakingForAccount(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// NFT tokens on a contract
app.get("/api/near/nft/:contract/tokens", async (req, res) => {
  try {
    const fromIndex = req.query.from_index as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const data = await nearService.getNftTokens(req.params.contract, fromIndex, limit);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// DeFi pools (Ref Finance)
app.get("/api/near/defi/pools", async (req, res) => {
  try {
    const fromIndex = req.query.from_index ? parseInt(req.query.from_index as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
    const data = await nearService.getDefiPools(fromIndex, limit);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ─── Solana Route Handlers ────────────────────────────────────────────────────

// SOL balance
app.get("/api/solana/account/:id/balance", async (req, res) => {
  try {
    const data = await solanaService.getBalance(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Account info
app.get("/api/solana/account/:id/info", async (req, res) => {
  try {
    const data = await solanaService.getAccountInfo(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// SPL token holdings
app.get("/api/solana/account/:id/tokens", async (req, res) => {
  try {
    const data = await solanaService.getTokenAccounts(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Stake accounts
app.get("/api/solana/account/:id/stakes", async (req, res) => {
  try {
    const data = await solanaService.getStakeAccounts(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Recent transactions
app.get("/api/solana/account/:id/transactions", async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const data = await solanaService.getRecentTransactions(req.params.id, limit);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Transaction details
app.get("/api/solana/tx/:signature", async (req, res) => {
  try {
    const data = await solanaService.getTransaction(req.params.signature);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Validators / vote accounts
app.get("/api/solana/validators", async (_req, res) => {
  try {
    const data = await solanaService.getVoteAccounts();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Top token prices
app.get("/api/solana/tokens/prices", async (_req, res) => {
  try {
    const data = await solanaService.getTopTokens();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Network stats
app.get("/api/solana/network/stats", async (_req, res) => {
  try {
    const data = await solanaService.getNetworkStats();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ─── Base Route Handlers ─────────────────────────────────────────────────────

// ETH balance on Base
app.get("/api/base/account/:id/balance", async (req, res) => {
  try {
    const data = await baseService.getBalance(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Account info (EOA vs contract)
app.get("/api/base/account/:id/info", async (req, res) => {
  try {
    const data = await baseService.getAccountInfo(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// ERC-20 token balances
app.get("/api/base/account/:id/tokens", async (req, res) => {
  try {
    const data = await baseService.getTokenBalances(req.params.id);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Transaction details
app.get("/api/base/tx/:hash", async (req, res) => {
  try {
    const data = await baseService.getTransaction(req.params.hash);
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(400).json({ error: message });
  }
});

// Latest block
app.get("/api/base/block/latest", async (_req, res) => {
  try {
    const data = await baseService.getLatestBlock();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Gas price
app.get("/api/base/gas", async (_req, res) => {
  try {
    const data = await baseService.getGasPrice();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// Network stats
app.get("/api/base/network/stats", async (_req, res) => {
  try {
    const data = await baseService.getNetworkStats();
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  // Pre-connect to NEAR RPC
  await nearClient.connect();
  console.log(`NEAR connected to ${nearClient.getNodeUrl()} (${nearClient.getNetworkId()})`);

  app.listen(PORT, HOST, () => {
    console.log(`x402 gateway listening on http://${HOST}:${PORT}`);
    console.log(`Chains: NEAR (${nearClient.getNetworkId()}) + Solana (${solanaClient.getNetwork()}) + Base (${baseClient.getNetwork()})`);
    console.log(`Mode: ${FREE_MODE ? "FREE (set X402_PAY_TO to enable payments)" : "PAID"}`);
    console.log(`Analytics: http://${HOST}:${PORT}/dashboard`);
    if (!FREE_MODE) {
      console.log(`Payment (Solana): USDC on ${NETWORK} → ${PAY_TO}`);
      console.log(`Payment (Base): USDC on ${BASE_NETWORK} → ${BASE_PAY_TO}`);
    }
  });
}

main().catch((err) => {
  console.error("Failed to start gateway:", err);
  process.exit(1);
});
