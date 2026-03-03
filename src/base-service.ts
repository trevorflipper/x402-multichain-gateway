import { BaseClient } from "./base-client.js";

/**
 * Popular ERC-20 tokens on Base with their contract addresses and decimals.
 */
const BASE_TOKENS: Array<{ symbol: string; name: string; address: string; decimals: number }> = [
  { symbol: "USDC", name: "USD Coin", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  { symbol: "USDbC", name: "USD Base Coin (bridged)", address: "0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA", decimals: 6 },
  { symbol: "DAI", name: "Dai Stablecoin", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  { symbol: "WETH", name: "Wrapped Ether", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  { symbol: "cbETH", name: "Coinbase Wrapped Staked ETH", address: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", decimals: 18 },
  { symbol: "AERO", name: "Aerodrome Finance", address: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", decimals: 18 },
];

// ERC-20 balanceOf(address) selector
const BALANCE_OF_SELECTOR = "0x70a08231";

/**
 * Base data service — wraps BaseClient into REST-friendly functions.
 * All methods return plain JSON-safe objects.
 */
export class BaseService {
  constructor(private client: BaseClient) {}

  // ─── ETH Balance ─────────────────────────────────────────────────

  async getBalance(address: string) {
    const result = await this.client.rpc("eth_getBalance", [address, "latest"]) as string;
    const wei = BigInt(result);
    return {
      address,
      wei: wei.toString(),
      eth: Number(wei) / 1e18,
      network: this.client.getNetwork(),
      chain_id: this.client.getChainId(),
    };
  }

  // ─── Account Info ────────────────────────────────────────────────

  async getAccountInfo(address: string) {
    const [nonce, code, balance] = await Promise.all([
      this.client.rpc("eth_getTransactionCount", [address, "latest"]) as Promise<string>,
      this.client.rpc("eth_getCode", [address, "latest"]) as Promise<string>,
      this.client.rpc("eth_getBalance", [address, "latest"]) as Promise<string>,
    ]);

    const isContract = code !== "0x" && code !== "0x0";
    const wei = BigInt(balance);

    return {
      address,
      is_contract: isContract,
      nonce: parseInt(nonce, 16),
      balance_wei: wei.toString(),
      balance_eth: Number(wei) / 1e18,
      code_size: isContract ? (code.length - 2) / 2 : 0, // hex bytes
      network: this.client.getNetwork(),
      chain_id: this.client.getChainId(),
    };
  }

  // ─── ERC-20 Token Balances ───────────────────────────────────────

  async getTokenBalances(address: string) {
    // Pad address to 32 bytes for balanceOf call
    const paddedAddress = "0x" + address.slice(2).toLowerCase().padStart(64, "0");
    const callData = BALANCE_OF_SELECTOR + paddedAddress.slice(2);

    const results = await Promise.all(
      BASE_TOKENS.map(async (token) => {
        try {
          const result = await this.client.rpc("eth_call", [
            { to: token.address, data: callData },
            "latest",
          ]) as string;
          const raw = BigInt(result || "0x0");
          const human = Number(raw) / 10 ** token.decimals;
          return {
            symbol: token.symbol,
            name: token.name,
            contract: token.address,
            balance_raw: raw.toString(),
            balance: human,
            decimals: token.decimals,
          };
        } catch {
          return {
            symbol: token.symbol,
            name: token.name,
            contract: token.address,
            balance_raw: "0",
            balance: 0,
            decimals: token.decimals,
          };
        }
      }),
    );

    // Filter to tokens with non-zero balances, but always include USDC
    const tokens = results.filter((t) => t.balance > 0 || t.symbol === "USDC");

    return {
      address,
      token_count: tokens.length,
      tokens,
      network: this.client.getNetwork(),
      chain_id: this.client.getChainId(),
    };
  }

  // ─── Transaction ─────────────────────────────────────────────────

  async getTransaction(hash: string) {
    const [tx, receipt] = await Promise.all([
      this.client.rpc("eth_getTransactionByHash", [hash]) as Promise<Record<string, any> | null>,
      this.client.rpc("eth_getTransactionReceipt", [hash]) as Promise<Record<string, any> | null>,
    ]);

    if (!tx) {
      return { hash, found: false, network: this.client.getNetwork() };
    }

    return {
      hash,
      found: true,
      from: tx.from,
      to: tx.to,
      value_wei: tx.value ? BigInt(tx.value).toString() : "0",
      value_eth: tx.value ? Number(BigInt(tx.value)) / 1e18 : 0,
      gas_limit: tx.gas ? parseInt(tx.gas, 16) : null,
      gas_price_gwei: tx.gasPrice ? parseInt(tx.gasPrice, 16) / 1e9 : null,
      nonce: tx.nonce ? parseInt(tx.nonce, 16) : null,
      block_number: tx.blockNumber ? parseInt(tx.blockNumber, 16) : null,
      block_hash: tx.blockHash,
      input_size: tx.input ? (tx.input.length - 2) / 2 : 0,
      // Receipt fields
      status: receipt ? (receipt.status === "0x1" ? "success" : "reverted") : "pending",
      gas_used: receipt?.gasUsed ? parseInt(receipt.gasUsed, 16) : null,
      effective_gas_price_gwei: receipt?.effectiveGasPrice
        ? parseInt(receipt.effectiveGasPrice, 16) / 1e9
        : null,
      logs_count: receipt?.logs?.length || 0,
      network: this.client.getNetwork(),
      chain_id: this.client.getChainId(),
    };
  }

  // ─── Latest Block ────────────────────────────────────────────────

  async getLatestBlock() {
    const block = await this.client.rpc("eth_getBlockByNumber", ["latest", false]) as Record<string, any>;

    return {
      number: parseInt(block.number, 16),
      hash: block.hash,
      parent_hash: block.parentHash,
      timestamp: parseInt(block.timestamp, 16),
      timestamp_iso: new Date(parseInt(block.timestamp, 16) * 1000).toISOString(),
      transaction_count: block.transactions?.length || 0,
      gas_used: parseInt(block.gasUsed, 16),
      gas_limit: parseInt(block.gasLimit, 16),
      gas_used_pct: ((parseInt(block.gasUsed, 16) / parseInt(block.gasLimit, 16)) * 100).toFixed(2) + "%",
      base_fee_gwei: block.baseFeePerGas ? parseInt(block.baseFeePerGas, 16) / 1e9 : null,
      miner: block.miner,
      network: this.client.getNetwork(),
      chain_id: this.client.getChainId(),
    };
  }

  // ─── Gas Price ───────────────────────────────────────────────────

  async getGasPrice() {
    const result = await this.client.rpc("eth_gasPrice") as string;
    const wei = parseInt(result, 16);

    return {
      gas_price_wei: wei,
      gas_price_gwei: wei / 1e9,
      network: this.client.getNetwork(),
      chain_id: this.client.getChainId(),
    };
  }

  // ─── Network Stats ───────────────────────────────────────────────

  async getNetworkStats() {
    const [blockHex, gasHex] = await Promise.all([
      this.client.rpc("eth_blockNumber") as Promise<string>,
      this.client.rpc("eth_gasPrice") as Promise<string>,
    ]);

    const blockNumber = parseInt(blockHex, 16);
    const gasWei = parseInt(gasHex, 16);

    return {
      chain_id: this.client.getChainId(),
      block_number: blockNumber,
      gas_price_gwei: gasWei / 1e9,
      network: this.client.getNetwork(),
      rpc_url: "https://mainnet.base.org",
    };
  }
}
