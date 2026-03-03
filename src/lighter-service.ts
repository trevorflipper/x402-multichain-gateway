/**
 * Lighter Intelligence Service
 *
 * Serves proprietary collected data from spread tracking, depth snapshots,
 * whale monitoring, signal scoring, and XLP LP analysis.
 *
 * Data sources:
 * - spread_history.csv: 5-min granularity spread/depth data (Lighter vs Hyperliquid)
 * - depth_summary_latest.json: Current OB depth snapshot across all markets
 * - whales.json / signal_scores.json: Live whale/signal data from Lighter dashboard
 * - xlp_snapshot.json / xlp_history.jsonl: XLP experimental LP tracking
 */

import fs from "fs";
import path from "path";

// ─── Data Paths ──────────────────────────────────────────────────────────────

const DATA_DIR = process.env.LIGHTER_DATA_DIR
  || "/home/openclaw/.openclaw/workspace/projects/perp-dex-spreads/scripts/data";
const XLP_DIR = process.env.XLP_DATA_DIR
  || "/home/openclaw/.openclaw/workspace/intelligence/xlp-tracker";

const SPREAD_CSV = path.join(DATA_DIR, "spread_history.csv");
const DEPTH_JSON = path.join(DATA_DIR, "depth_summary_latest.json");
const XLP_SNAPSHOT = path.join(XLP_DIR, "xlp_snapshot.json");
const XLP_HISTORY = path.join(XLP_DIR, "xlp_history.jsonl");

const WHALES_URL = "https://lighter-research.vercel.app/data/whales.json";
const SIGNALS_URL = "https://lighter-research.vercel.app/data/signal_scores.json";

// ─── Cache ───────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const cache: Record<string, CacheEntry<unknown>> = {};
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.fetchedAt < CACHE_TTL_MS) {
    return entry.data as T;
  }
  return null;
}

function setCache<T>(key: string, data: T): void {
  cache[key] = { data, fetchedAt: Date.now() };
}

// ─── CSV Parser (minimal, no external deps) ─────────────────────────────────

interface SpreadRow {
  timestamp_utc: string;
  symbol: string;
  lighter_best_bid: number;
  lighter_best_ask: number;
  lighter_spread_bps: number;
  lighter_mid: number;
  lighter_depth_bid_usd: number;
  lighter_depth_ask_usd: number;
  lighter_depth_0_3_bid_usd: number;
  lighter_depth_0_3_ask_usd: number;
  hl_best_bid: number;
  hl_best_ask: number;
  hl_spread_bps: number;
  hl_mid: number;
  hl_depth_bid_usd: number;
  hl_depth_ask_usd: number;
  hl_depth_0_3_bid_usd: number;
  hl_depth_0_3_ask_usd: number;
  spread_diff_bps: number;
  lighter_wider: number;
}

function parseSpreadCsv(content: string): SpreadRow[] {
  const lines = content.split("\n");
  if (lines.length < 2) return [];

  const headers = lines[0].split(",");
  const rows: SpreadRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const vals = line.split(",");
    const row: Record<string, string | number> = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j].trim();
      const v = (vals[j] || "").trim();
      // Parse numeric fields, keep timestamp_utc and symbol as strings
      if (h === "timestamp_utc" || h === "symbol") {
        row[h] = v;
      } else {
        row[h] = v ? parseFloat(v) : 0;
      }
    }
    rows.push(row as unknown as SpreadRow);
  }

  return rows;
}

// ─── Service Methods ─────────────────────────────────────────────────────────

export class LighterService {

  /**
   * Current spreads — latest rows from spread_history.csv for each symbol
   */
  getCurrentSpreads(): object {
    const cached = getCached<object>("spreads_current");
    if (cached) return cached;

    if (!fs.existsSync(SPREAD_CSV)) {
      return { error: "Spread data not available", path: SPREAD_CSV };
    }

    const content = fs.readFileSync(SPREAD_CSV, "utf-8");
    const rows = parseSpreadCsv(content);

    // Get latest row per symbol
    const latest: Record<string, SpreadRow> = {};
    for (const row of rows) {
      if (!row.symbol) continue;
      // Keep the last (most recent) row per symbol
      latest[row.symbol] = row;
    }

    const result = {
      updated_at: Object.values(latest)[0]?.timestamp_utc || "unknown",
      symbols: Object.fromEntries(
        Object.entries(latest).map(([symbol, row]) => [
          symbol,
          {
            lighter_spread_bps: row.lighter_spread_bps,
            hl_spread_bps: row.hl_spread_bps,
            spread_diff_bps: row.spread_diff_bps,
            lighter_mid: row.lighter_mid,
            hl_mid: row.hl_mid,
            lighter_wider: row.lighter_wider === 1,
            lighter_depth_0_3_bid_usd: row.lighter_depth_0_3_bid_usd,
            lighter_depth_0_3_ask_usd: row.lighter_depth_0_3_ask_usd,
            hl_depth_0_3_bid_usd: row.hl_depth_0_3_bid_usd,
            hl_depth_0_3_ask_usd: row.hl_depth_0_3_ask_usd,
          },
        ])
      ),
      source: "forge/spread_tracker",
      granularity: "5min",
    };

    setCache("spreads_current", result);
    return result;
  }

  /**
   * Historical spread timeseries for a symbol
   */
  getSpreadHistory(symbol: string, hours: number = 24): object {
    const maxHours = 168; // 7 days
    hours = Math.min(hours, maxHours);

    const cacheKey = `spreads_history_${symbol}_${hours}`;
    const cached = getCached<object>(cacheKey);
    if (cached) return cached;

    if (!fs.existsSync(SPREAD_CSV)) {
      return { error: "Spread data not available" };
    }

    const content = fs.readFileSync(SPREAD_CSV, "utf-8");
    const rows = parseSpreadCsv(content);

    const cutoff = new Date(Date.now() - hours * 3600_000);
    const symbolUpper = symbol.toUpperCase();

    const filtered = rows.filter((r) => {
      if (r.symbol !== symbolUpper) return false;
      try {
        return new Date(r.timestamp_utc) >= cutoff;
      } catch {
        return false;
      }
    });

    const result = {
      symbol: symbolUpper,
      hours,
      data_points: filtered.length,
      data: filtered.map((r) => ({
        timestamp: r.timestamp_utc,
        lighter_spread_bps: r.lighter_spread_bps,
        hl_spread_bps: r.hl_spread_bps,
        spread_diff_bps: r.spread_diff_bps,
        lighter_mid: r.lighter_mid,
        hl_mid: r.hl_mid,
        lighter_depth_0_3_bid_usd: r.lighter_depth_0_3_bid_usd,
        lighter_depth_0_3_ask_usd: r.lighter_depth_0_3_ask_usd,
        hl_depth_0_3_bid_usd: r.hl_depth_0_3_bid_usd,
        hl_depth_0_3_ask_usd: r.hl_depth_0_3_ask_usd,
      })),
      source: "forge/spread_tracker",
      granularity: "5min",
    };

    setCache(cacheKey, result);
    return result;
  }

  /**
   * Current depth snapshot from depth_summary_latest.json
   */
  getCurrentDepth(): object {
    const cached = getCached<object>("depth_current");
    if (cached) return cached;

    if (!fs.existsSync(DEPTH_JSON)) {
      return { error: "Depth data not available" };
    }

    const data = JSON.parse(fs.readFileSync(DEPTH_JSON, "utf-8"));
    setCache("depth_current", data);
    return data;
  }

  /**
   * Whale positions from Lighter dashboard (proxied + cached)
   */
  async getWhales(): Promise<object> {
    const cached = getCached<object>("whales");
    if (cached) return cached;

    try {
      const resp = await fetch(WHALES_URL, {
        headers: { "User-Agent": "x402-gateway/4.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as unknown[];

      const result = {
        count: data.length,
        whales: (data as Record<string, unknown>[]).map((w) => ({
          address: (w.l1Address as string || "").slice(0, 10) + "...",
          full_address: w.l1Address,
          bias: w.bias,
          total_value: w.totalValue,
          net_exposure: w.netExposure,
          unrealized_pnl: w.unrealizedPnl,
          positions: w.positions,
        })),
        source: "lighter-research.vercel.app",
        cached_at: new Date().toISOString(),
      };

      setCache("whales", result);
      return result;
    } catch (err) {
      return { error: `Failed to fetch whale data: ${err}`, source: WHALES_URL };
    }
  }

  /**
   * Signal wallet scores from Lighter dashboard (proxied + cached)
   */
  async getSignals(): Promise<object> {
    const cached = getCached<object>("signals");
    if (cached) return cached;

    try {
      const resp = await fetch(SIGNALS_URL, {
        headers: { "User-Agent": "x402-gateway/4.0" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json() as unknown[];

      const result = {
        count: data.length,
        tiers: {
          S: (data as Record<string, unknown>[]).filter((s) => s.tier === "S").length,
          A: (data as Record<string, unknown>[]).filter((s) => s.tier === "A").length,
          B: (data as Record<string, unknown>[]).filter((s) => s.tier === "B").length,
        },
        signals: (data as Record<string, unknown>[]).map((s) => ({
          address: (s.l1Address as string || "").slice(0, 10) + "...",
          full_address: s.l1Address,
          tier: s.tier,
          total_score: s.totalScore,
        })),
        source: "lighter-research.vercel.app",
        cached_at: new Date().toISOString(),
      };

      setCache("signals", result);
      return result;
    } catch (err) {
      return { error: `Failed to fetch signal data: ${err}`, source: SIGNALS_URL };
    }
  }

  /**
   * XLP experimental LP data — snapshot + recent history
   */
  getXlp(): object {
    const cached = getCached<object>("xlp");
    if (cached) return cached;

    let snapshot: unknown = null;
    let history: unknown[] = [];

    // Read snapshot
    if (fs.existsSync(XLP_SNAPSHOT)) {
      try {
        snapshot = JSON.parse(fs.readFileSync(XLP_SNAPSHOT, "utf-8"));
      } catch {
        snapshot = null;
      }
    }

    // Read last 50 lines of history
    if (fs.existsSync(XLP_HISTORY)) {
      try {
        const lines = fs.readFileSync(XLP_HISTORY, "utf-8").trim().split("\n");
        const recent = lines.slice(-50);
        history = recent
          .map((line) => {
            try { return JSON.parse(line); }
            catch { return null; }
          })
          .filter(Boolean);
      } catch {
        history = [];
      }
    }

    const result = {
      snapshot,
      history_entries: history.length,
      history,
      source: "xlp-tracker",
      snapshot_path: XLP_SNAPSHOT,
    };

    setCache("xlp", result);
    return result;
  }
}
