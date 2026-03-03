# Directory Submission Status

**Domain:** https://ironflip.duckdns.org (HTTPS via Let's Encrypt + DuckDNS DNS-01)

## Completed

### 1. Official MCP Registry
- **Status:** PUBLISHED v3.0.0
- **Name:** `io.github.trevorflipper/near-solana-blockchain-api`
- **Version:** 3.0.0 (updated 2026-03-03)
- **Title:** NEAR, Solana & Base Blockchain Data Gateway
- **URL:** https://registry.modelcontextprotocol.io
- **Cascading:** PulseMCP auto-ingests from here weekly

### 2. x402 Bazaar
- **Status:** REGISTERED (active, verified_up)
- **ID:** `a790deb7-945f-466a-80ff-0c1ca4230e62`
- **Catalog:** https://x402-discovery-api.onrender.com/catalog
- **Note:** Name/description still says "17 endpoints" — no update API, will update on next health crawl via live discovery endpoints (which now show 24 endpoints / 3 chains)
- **Stale listing:** `a4b7badb` (bare IP) at 0% uptime, will age out naturally

### 3. x402 Bazaar Extension (in-app)
- **Status:** INTEGRATED
- `bazaarResourceServerExtension` registered on x402ResourceServer
- `declareDiscoveryExtension` metadata on all 24 routes (was 17)

---

## Pending (Quick Manual Steps)

### 4. PulseMCP (pulsemcp.com/submit)
- **Type:** MCP Server
- **URL:** https://ironflip.duckdns.org
- **Note:** May auto-list from MCP Registry within a week

### 5. mcp.so/submit
- **Type:** MCP Server
- **Name:** NEAR, Solana & Base Blockchain Data Gateway
- **URL:** https://ironflip.duckdns.org
- **Cloud hosted:** Yes
- **Innovation:** Yes

### 6. Smithery (smithery.ai)
- **Commands:**
  ```bash
  npx @smithery/cli@latest auth login
  npx @smithery/cli@latest mcp publish "https://ironflip.duckdns.org" -n trevorflipper/near-solana-base-gateway
  ```

### 7. awesome-mcp-servers (GitHub PR → cascades to Glama)
- **Requires:** `gh auth login`
- **Entry:**
  ```markdown
  - [NEAR, Solana & Base Blockchain Data Gateway](https://ironflip.duckdns.org) - 24 pay-per-call NEAR + Solana + Base blockchain data endpoints via x402 USDC micropayments
  ```

---

## Discovery Endpoints (Live)
- OpenAPI 3.1: https://ironflip.duckdns.org/openapi.json
- A2A Agent Card: https://ironflip.duckdns.org/.well-known/agent-card.json
- ChatGPT Plugin: https://ironflip.duckdns.org/.well-known/ai-plugin.json
- LLMs.txt: https://ironflip.duckdns.org/llms.txt
- Dashboard: https://ironflip.duckdns.org/dashboard
- Analytics API: https://ironflip.duckdns.org/api/analytics/summary
