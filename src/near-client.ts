import * as nearAPI from "near-api-js";
const { connect, keyStores } = nearAPI;

/**
 * Shared NEAR RPC client. Read-only — no signing keys needed for the gateway
 * since we only serve view calls and public chain data.
 */
export class NearClient {
  private networkId: string;
  private nodeUrl: string;
  private near: nearAPI.Near | null = null;
  private keyStore: nearAPI.keyStores.InMemoryKeyStore;

  constructor(networkId?: string, nodeUrl?: string) {
    this.networkId = networkId || process.env.NEAR_NETWORK_ID || "mainnet";
    this.nodeUrl =
      nodeUrl ||
      process.env.NEAR_NODE_URL ||
      (this.networkId === "mainnet"
        ? "https://rpc.mainnet.near.org"
        : "https://rpc.testnet.near.org");
    this.keyStore = new keyStores.InMemoryKeyStore();
  }

  async connect(): Promise<nearAPI.Near> {
    if (this.near) return this.near;
    this.near = await connect({
      networkId: this.networkId,
      nodeUrl: this.nodeUrl,
      keyStore: this.keyStore,
    } as any);
    return this.near;
  }

  async getAccount(accountId: string): Promise<nearAPI.Account> {
    const near = await this.connect();
    return near.account(accountId);
  }

  async getProvider(): Promise<nearAPI.providers.Provider> {
    const near = await this.connect();
    return near.connection.provider;
  }

  async viewFunction(
    contractId: string,
    methodName: string,
    args: Record<string, unknown> = {}
  ): Promise<unknown> {
    const near = await this.connect();
    const account = await near.account(contractId);
    return account.viewFunction({ contractId, methodName, args });
  }

  getNetworkId(): string {
    return this.networkId;
  }

  getNodeUrl(): string {
    return this.nodeUrl;
  }
}
