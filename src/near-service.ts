import { NearClient } from "./near-client.js";

const REF_FINANCE_CONTRACT = "v2.ref-finance.near";
const PRICE_ORACLE = "priceoracle.near";

/**
 * NEAR data service — wraps NearClient into REST-friendly async functions.
 * All methods return plain objects suitable for JSON serialization.
 * Read-only — no signing keys required.
 */
export class NearService {
  constructor(private client: NearClient) {}

  // ─── Wallet / Account ──────────────────────────────────────────────

  async getBalance(accountId: string) {
    const account = await this.client.getAccount(accountId);
    const balance = await account.getAccountBalance();
    return {
      account_id: accountId,
      total: balance.total,
      stateStaked: balance.stateStaked,
      staked: balance.staked,
      available: balance.available,
      network: this.client.getNetworkId(),
    };
  }

  async getAccessKeys(accountId: string) {
    const account = await this.client.getAccount(accountId);
    const keys = await account.getAccessKeys();
    return {
      account_id: accountId,
      count: keys.length,
      access_keys: keys.map((k: any) => ({
        public_key: k.public_key,
        permission:
          k.access_key.permission === "FullAccess"
            ? "FullAccess"
            : {
                type: "FunctionCall",
                receiver_id: k.access_key.permission?.FunctionCall?.receiver_id,
                method_names: k.access_key.permission?.FunctionCall?.method_names,
                allowance: String(k.access_key.permission?.FunctionCall?.allowance ?? "0"),
              },
        nonce: String(k.access_key.nonce),
      })),
      network: this.client.getNetworkId(),
    };
  }

  // ─── Explorer ──────────────────────────────────────────────────────

  async getTransaction(txHash: string, senderId: string) {
    const provider = await this.client.getProvider();
    const tx = await provider.txStatus(txHash, senderId);
    const outcome = tx.transaction_outcome;
    const receipts = tx.receipts_outcome || [];
    const status = tx.status as any;
    const isSuccess =
      status?.SuccessValue !== undefined || status?.SuccessReceiptId !== undefined;

    let returnValue: unknown = null;
    if (status?.SuccessValue) {
      try {
        const decoded = Buffer.from(status.SuccessValue, "base64").toString("utf-8");
        try { returnValue = JSON.parse(decoded); } catch { returnValue = decoded || null; }
      } catch { /* best effort */ }
    }

    return {
      tx_hash: txHash,
      sender: tx.transaction?.signer_id,
      receiver: tx.transaction?.receiver_id,
      success: isSuccess,
      return_value: returnValue,
      actions: tx.transaction?.actions,
      outcome: {
        block_hash: outcome?.block_hash,
        gas_burnt: outcome?.outcome?.gas_burnt,
        logs: outcome?.outcome?.logs,
      },
      receipts_count: receipts.length,
      receipts: receipts.map((r: any) => ({
        id: r.id,
        executor_id: r.outcome?.executor_id,
        gas_burnt: r.outcome?.gas_burnt,
        status: r.outcome?.status,
      })),
      network: this.client.getNetworkId(),
    };
  }

  // ─── Staking ───────────────────────────────────────────────────────

  async getValidators() {
    const near = await this.client.connect();
    const provider = near.connection.provider;
    const validators = await provider.validators(null);

    return {
      epoch_height: (validators as any).epoch_height,
      epoch_start_height: (validators as any).epoch_start_height,
      current_validators_count: validators.current_validators.length,
      next_validators_count: validators.next_validators.length,
      current_validators: validators.current_validators.map((v: any) => ({
        account_id: v.account_id,
        stake: v.stake,
        is_slashed: v.is_slashed,
        num_produced_blocks: v.num_produced_blocks,
        num_expected_blocks: v.num_expected_blocks,
      })),
      network: this.client.getNetworkId(),
    };
  }

  async getValidatorById(validatorId: string) {
    const near = await this.client.connect();
    const provider = near.connection.provider;
    const validators = await provider.validators(null);
    const v = validators.current_validators.find(
      (v: any) => v.account_id === validatorId
    ) as any;

    if (!v) {
      // Check next validators
      const next = validators.next_validators.find(
        (v: any) => v.account_id === validatorId
      ) as any;
      if (next) {
        return {
          account_id: validatorId,
          status: "next_epoch",
          stake: next.stake,
          network: this.client.getNetworkId(),
        };
      }
      return { account_id: validatorId, status: "not_found", network: this.client.getNetworkId() };
    }

    return {
      account_id: v.account_id,
      status: "active",
      stake: v.stake,
      is_slashed: v.is_slashed,
      num_produced_blocks: v.num_produced_blocks,
      num_expected_blocks: v.num_expected_blocks,
      uptime_pct:
        v.num_expected_blocks > 0
          ? ((v.num_produced_blocks / v.num_expected_blocks) * 100).toFixed(2) + "%"
          : "N/A",
      network: this.client.getNetworkId(),
    };
  }

  async getStakingForAccount(accountId: string) {
    const near = await this.client.connect();
    const provider = near.connection.provider;
    const validators = await provider.validators(null);
    const poolIds = validators.current_validators
      .map((v: any) => v.account_id)
      .slice(0, 50);

    const delegations: Array<{
      pool_id: string;
      staked_balance: string;
      unstaked_balance: string;
      can_withdraw: boolean;
    }> = [];

    for (const poolId of poolIds) {
      try {
        const staked = (await this.client.viewFunction(
          poolId, "get_account_staked_balance", { account_id: accountId }
        )) as string;
        const unstaked = (await this.client.viewFunction(
          poolId, "get_account_unstaked_balance", { account_id: accountId }
        )) as string;

        if (staked !== "0" || unstaked !== "0") {
          const canWithdraw = (await this.client.viewFunction(
            poolId, "is_account_unstaked_balance_available", { account_id: accountId }
          )) as boolean;
          delegations.push({
            pool_id: poolId,
            staked_balance: staked,
            unstaked_balance: unstaked,
            can_withdraw: canWithdraw,
          });
        }
      } catch { /* pool doesn't support staking interface */ }
    }

    return {
      account_id: accountId,
      pools_checked: poolIds.length,
      delegations_found: delegations.length,
      delegations,
      network: this.client.getNetworkId(),
    };
  }

  // ─── NFT ───────────────────────────────────────────────────────────

  async getNftTokens(contractId: string, fromIndex?: string, limit?: number) {
    const tokens = (await this.client.viewFunction(
      contractId, "nft_tokens", {
        from_index: fromIndex || "0",
        limit: Math.min(limit || 30, 100),
      }
    )) as Array<Record<string, unknown>>;

    let supply: unknown = null;
    try {
      supply = await this.client.viewFunction(contractId, "nft_total_supply", {});
    } catch { /* optional */ }

    return {
      contract: contractId,
      total_supply: supply,
      returned: tokens.length,
      tokens: tokens.map((t) => ({
        token_id: t.token_id,
        owner_id: t.owner_id,
        title: (t.metadata as any)?.title || null,
        description: (t.metadata as any)?.description || null,
        media: (t.metadata as any)?.media || null,
      })),
      network: this.client.getNetworkId(),
    };
  }

  // ─── DeFi ──────────────────────────────────────────────────────────

  async getDefiPools(fromIndex?: number, limit?: number) {
    const effectiveLimit = Math.min(limit || 20, 100);
    const pools = (await this.client.viewFunction(
      REF_FINANCE_CONTRACT, "get_pools", {
        from_index: fromIndex || 0,
        limit: effectiveLimit,
      }
    )) as Array<Record<string, unknown>>;

    let totalPools: unknown = null;
    try {
      totalPools = await this.client.viewFunction(
        REF_FINANCE_CONTRACT, "get_number_of_pools", {}
      );
    } catch { /* optional */ }

    return {
      total_pools: totalPools,
      returned: pools.length,
      from_index: fromIndex || 0,
      pools: pools.map((p, i) => ({
        pool_id: (fromIndex || 0) + i,
        ...p,
      })),
      network: this.client.getNetworkId(),
    };
  }
}
