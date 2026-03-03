import { SolanaClient } from "./solana-client.js";

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

/**
 * Solana data service — wraps SolanaClient into REST-friendly functions.
 * All methods return plain JSON-safe objects.
 */
export class SolanaService {
  constructor(private client: SolanaClient) {}

  // ─── Account / Balance ────────────────────────────────────────────

  async getBalance(address: string) {
    const result = await this.client.rpc("getBalance", [address]) as { value: number };
    const lamports = result.value;
    return {
      address,
      lamports,
      sol: lamports / 1e9,
      network: this.client.getNetwork(),
    };
  }

  async getAccountInfo(address: string) {
    const result = await this.client.rpc("getAccountInfo", [
      address,
      { encoding: "jsonParsed" },
    ]) as { value: Record<string, unknown> | null };
    if (!result.value) {
      return { address, exists: false, network: this.client.getNetwork() };
    }
    const info = result.value as any;
    return {
      address,
      exists: true,
      lamports: info.lamports,
      sol: info.lamports / 1e9,
      owner: info.owner,
      executable: info.executable,
      rent_epoch: info.rentEpoch,
      data_size: info.data?.length || 0,
      network: this.client.getNetwork(),
    };
  }

  // ─── Token Accounts (SPL) ────────────────────────────────────────

  async getTokenAccounts(ownerAddress: string) {
    const result = await this.client.rpc("getTokenAccountsByOwner", [
      ownerAddress,
      { programId: TOKEN_PROGRAM },
      { encoding: "jsonParsed" },
    ]) as { value: Array<{ pubkey: string; account: any }> };

    const tokens = result.value.map((item) => {
      const parsed = item.account.data?.parsed?.info;
      return {
        token_account: item.pubkey,
        mint: parsed?.mint,
        owner: parsed?.owner,
        amount: parsed?.tokenAmount?.uiAmountString || "0",
        decimals: parsed?.tokenAmount?.decimals || 0,
        is_usdc: parsed?.mint === USDC_MINT,
      };
    });

    // Sort: USDC first, then by amount descending
    tokens.sort((a, b) => {
      if (a.is_usdc && !b.is_usdc) return -1;
      if (!a.is_usdc && b.is_usdc) return 1;
      return parseFloat(b.amount) - parseFloat(a.amount);
    });

    return {
      owner: ownerAddress,
      token_count: tokens.length,
      tokens: tokens.slice(0, 50),
      network: this.client.getNetwork(),
    };
  }

  // ─── Transaction ─────────────────────────────────────────────────

  async getTransaction(signature: string) {
    const tx = await this.client.rpc("getTransaction", [
      signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]) as Record<string, any> | null;

    if (!tx) {
      return { signature, found: false, network: this.client.getNetwork() };
    }

    const meta = tx.meta || {};
    const message = tx.transaction?.message || {};
    const instructions = message.instructions || [];

    return {
      signature,
      found: true,
      slot: tx.slot,
      block_time: tx.blockTime,
      block_time_iso: tx.blockTime ? new Date(tx.blockTime * 1000).toISOString() : null,
      success: meta.err === null,
      error: meta.err,
      fee_lamports: meta.fee,
      fee_sol: (meta.fee || 0) / 1e9,
      signer: message.accountKeys?.[0]?.pubkey || null,
      instructions_count: instructions.length,
      instructions: instructions.slice(0, 10).map((ix: any) => ({
        program: ix.programId,
        type: ix.parsed?.type || "unknown",
        info: ix.parsed?.info || null,
      })),
      log_messages: (meta.logMessages || []).slice(0, 20),
      network: this.client.getNetwork(),
    };
  }

  // ─── Recent Transactions for Address ──────────────────────────────

  async getRecentTransactions(address: string, limit = 10) {
    const signatures = await this.client.rpc("getSignaturesForAddress", [
      address,
      { limit: Math.min(limit, 50) },
    ]) as Array<{ signature: string; slot: number; blockTime: number | null; err: unknown }>;

    return {
      address,
      count: signatures.length,
      transactions: signatures.map((s) => ({
        signature: s.signature,
        slot: s.slot,
        block_time: s.blockTime,
        block_time_iso: s.blockTime ? new Date(s.blockTime * 1000).toISOString() : null,
        success: s.err === null,
      })),
      network: this.client.getNetwork(),
    };
  }

  // ─── Staking / Vote Accounts ──────────────────────────────────────

  async getStakeAccounts(ownerAddress: string) {
    // Get stake accounts owned by this wallet via getProgramAccounts
    const result = await this.client.rpc("getProgramAccounts", [
      "Stake11111111111111111111111111111111111111",
      {
        encoding: "jsonParsed",
        filters: [
          { memcmp: { offset: 12, bytes: ownerAddress } },
        ],
      },
    ]) as Array<{ pubkey: string; account: any }>;

    const stakes = result.map((item) => {
      const parsed = item.account.data?.parsed?.info;
      const stake = parsed?.stake;
      return {
        stake_account: item.pubkey,
        voter: stake?.delegation?.voter,
        stake_lamports: stake?.delegation?.stake,
        stake_sol: stake?.delegation?.stake ? parseInt(stake.delegation.stake) / 1e9 : 0,
        activation_epoch: stake?.delegation?.activationEpoch,
        state: parsed?.type || "unknown",
      };
    });

    const total_staked = stakes.reduce((sum, s) => sum + s.stake_sol, 0);

    return {
      owner: ownerAddress,
      stake_accounts: stakes.length,
      total_staked_sol: total_staked,
      stakes,
      network: this.client.getNetwork(),
    };
  }

  async getVoteAccounts() {
    const result = await this.client.rpc("getVoteAccounts") as {
      current: Array<Record<string, any>>;
      delinquent: Array<Record<string, any>>;
    };

    return {
      current_count: result.current.length,
      delinquent_count: result.delinquent.length,
      top_validators: result.current
        .sort((a, b) => parseInt(b.activatedStake) - parseInt(a.activatedStake))
        .slice(0, 30)
        .map((v) => ({
          vote_pubkey: v.votePubkey,
          node_pubkey: v.nodePubkey,
          activated_stake_sol: parseInt(v.activatedStake) / 1e9,
          commission: v.commission,
          last_vote: v.lastVote,
          epoch_vote_account: v.epochVoteAccount,
        })),
      network: this.client.getNetwork(),
    };
  }

  // ─── DeFi / Token Prices ──────────────────────────────────────────

  async getTopTokens() {
    // CoinGecko free API — no auth, 30 req/min
    const TOKENS: Record<string, string> = {
      "solana": "SOL",
      "usd-coin": "USDC",
      "tether": "USDT",
      "jupiter-exchange-solana": "JUP",
      "jito-governance-token": "JTO",
      "pyth-network": "PYTH",
      "bonk": "BONK",
      "raydium": "RAY",
      "marinade-staked-sol": "mSOL",
      "tensor": "TNSR",
    };

    try {
      const ids = Object.keys(TOKENS).join(",");
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`,
        { headers: { "User-Agent": "x402-gateway/2.0" } },
      );
      if (!res.ok) throw new Error(`CoinGecko API: ${res.status}`);
      const json = await res.json() as Record<string, { usd: number; usd_24h_change?: number }>;

      const tokens = Object.entries(json).map(([id, data]) => ({
        id,
        symbol: TOKENS[id] || id,
        price_usd: data.usd,
        change_24h_pct: data.usd_24h_change ? parseFloat(data.usd_24h_change.toFixed(2)) : null,
      }));

      // Sort by market relevance (SOL first)
      tokens.sort((a, b) => {
        const order = Object.values(TOKENS);
        return order.indexOf(a.symbol) - order.indexOf(b.symbol);
      });

      return { tokens, source: "coingecko", network: this.client.getNetwork() };
    } catch (err) {
      return { tokens: [], source: "coingecko", error: err instanceof Error ? err.message : String(err), network: this.client.getNetwork() };
    }
  }

  // ─── Network Stats ────────────────────────────────────────────────

  async getNetworkStats() {
    const [epochInfo, supply, perf] = await Promise.all([
      this.client.rpc("getEpochInfo") as Promise<any>,
      this.client.rpc("getSupply") as Promise<any>,
      this.client.rpc("getRecentPerformanceSamples", [5]) as Promise<any>,
    ]);

    const avgTps = perf && perf.length > 0
      ? perf.reduce((sum: number, s: any) => sum + (s.numTransactions / s.samplePeriodSecs), 0) / perf.length
      : null;

    return {
      epoch: epochInfo.epoch,
      slot_index: epochInfo.slotIndex,
      slots_in_epoch: epochInfo.slotsInEpoch,
      epoch_progress_pct: ((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(2) + "%",
      absolute_slot: epochInfo.absoluteSlot,
      total_supply_sol: supply?.value?.total ? parseInt(supply.value.total) / 1e9 : null,
      circulating_supply_sol: supply?.value?.circulating ? parseInt(supply.value.circulating) / 1e9 : null,
      avg_tps: avgTps ? Math.round(avgTps) : null,
      network: this.client.getNetwork(),
    };
  }
}
