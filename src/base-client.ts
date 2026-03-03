/**
 * Lightweight Base (Ethereum L2) JSON-RPC client. No SDK dependency — just fetch.
 * Read-only: no signing, no keypairs.
 */

export class BaseClient {
  private rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || process.env.BASE_RPC_URL || "https://mainnet.base.org";
  }

  async rpc(method: string, params: unknown[] = []): Promise<unknown> {
    const res = await fetch(this.rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    if (!res.ok) {
      throw new Error(`Base RPC error: ${res.status} ${res.statusText}`);
    }
    const json = await res.json() as { result?: unknown; error?: { message: string; code: number } };
    if (json.error) {
      throw new Error(`Base RPC: ${json.error.message} (code ${json.error.code})`);
    }
    return json.result;
  }

  getNetwork(): string { return "base-mainnet"; }
  getChainId(): number { return 8453; }
  getRpcUrl(): string { return this.rpcUrl; }
}
