/**
 * Lightweight Solana JSON-RPC client. No SDK dependency — just fetch.
 * Read-only: no signing, no keypairs.
 */

export class SolanaClient {
  private rpcUrl: string;
  private network: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    this.network = this.rpcUrl.includes("devnet") ? "devnet"
      : this.rpcUrl.includes("testnet") ? "testnet" : "mainnet-beta";
  }

  async rpc(method: string, params: unknown[] = []): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok) {
      throw new Error(`Solana RPC error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json() as { result?: unknown; error?: { message: string; code: number } };
    if (json.error) {
      throw new Error(`Solana RPC: ${json.error.message} (code ${json.error.code})`);
    }
    return json.result;
  }

  getNetwork(): string { return this.network; }
  getRpcUrl(): string { return this.rpcUrl; }
}
