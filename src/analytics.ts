import Database from "better-sqlite3";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestLog {
  method: string;
  path: string;
  status_code: number;
  ip: string;
  user_agent: string;
  response_time_ms: number;
}

export interface PaymentLog {
  payer: string;
  tx_hash: string;
  amount: string;
  amount_usd: number;
  endpoint: string;
  network: string;
  ip: string;
  user_agent: string;
}

export interface Summary {
  total_requests: number;
  total_payments: number;
  total_revenue_usd: number;
  unique_payers: number;
  unique_callers: number;
  requests_today: number;
  payments_today: number;
  revenue_today_usd: number;
}

export interface PaymentRecord {
  id: number;
  timestamp: string;
  payer: string;
  tx_hash: string;
  amount: string;
  amount_usd: number;
  endpoint: string;
  network: string;
}

export interface PayerStats {
  payer: string;
  total_payments: number;
  total_usd: number;
  last_payment: string;
}

export interface EndpointStats {
  path: string;
  total_requests: number;
  total_payments: number;
  total_revenue_usd: number;
}

export interface TimeSeriesPoint {
  period: string;
  requests: number;
  payments: number;
  revenue_usd: number;
}

// ─── Database ─────────────────────────────────────────────────────────────────

let db: Database.Database;

export function initDb(dbPath?: string): void {
  const resolvedPath = dbPath || path.resolve(process.cwd(), "analytics.db");
  db = new Database(resolvedPath);

  // WAL mode for better concurrent read performance
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      method TEXT,
      path TEXT,
      status_code INTEGER,
      ip TEXT,
      user_agent TEXT,
      response_time_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT DEFAULT (datetime('now')),
      payer TEXT,
      tx_hash TEXT,
      amount TEXT,
      amount_usd REAL,
      endpoint TEXT,
      network TEXT,
      ip TEXT,
      user_agent TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_requests_timestamp ON requests(timestamp);
    CREATE INDEX IF NOT EXISTS idx_requests_path ON requests(path);
    CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer);
    CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);
  `);
}

// ─── Logging ──────────────────────────────────────────────────────────────────

const stmtCache: Record<string, Database.Statement> = {};

function getStmt(key: string, sql: string): Database.Statement {
  if (!stmtCache[key]) {
    stmtCache[key] = db.prepare(sql);
  }
  return stmtCache[key];
}

export function logRequest(log: RequestLog): void {
  const stmt = getStmt(
    "insertRequest",
    `INSERT INTO requests (method, path, status_code, ip, user_agent, response_time_ms)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  stmt.run(log.method, log.path, log.status_code, log.ip, log.user_agent, log.response_time_ms);
}

export function logPayment(log: PaymentLog): void {
  const stmt = getStmt(
    "insertPayment",
    `INSERT INTO payments (payer, tx_hash, amount, amount_usd, endpoint, network, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  stmt.run(
    log.payer, log.tx_hash, log.amount, log.amount_usd,
    log.endpoint, log.network, log.ip, log.user_agent
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function getStats(): Summary {
  const totals = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM requests) AS total_requests,
      (SELECT COUNT(*) FROM payments) AS total_payments,
      (SELECT COALESCE(SUM(amount_usd), 0) FROM payments) AS total_revenue_usd,
      (SELECT COUNT(DISTINCT payer) FROM payments) AS unique_payers,
      (SELECT COUNT(DISTINCT ip) FROM requests) AS unique_callers,
      (SELECT COUNT(*) FROM requests WHERE timestamp >= date('now')) AS requests_today,
      (SELECT COUNT(*) FROM payments WHERE timestamp >= date('now')) AS payments_today,
      (SELECT COALESCE(SUM(amount_usd), 0) FROM payments WHERE timestamp >= date('now')) AS revenue_today_usd
  `).get() as Summary;
  return totals;
}

export function getRecentPayments(limit = 50): PaymentRecord[] {
  return db.prepare(`
    SELECT id, timestamp, payer, tx_hash, amount, amount_usd, endpoint, network
    FROM payments ORDER BY id DESC LIMIT ?
  `).all(limit) as PaymentRecord[];
}

export function getTopPayers(limit = 20): PayerStats[] {
  return db.prepare(`
    SELECT
      payer,
      COUNT(*) AS total_payments,
      SUM(amount_usd) AS total_usd,
      MAX(timestamp) AS last_payment
    FROM payments
    GROUP BY payer
    ORDER BY total_usd DESC
    LIMIT ?
  `).all(limit) as PayerStats[];
}

export function getEndpointStats(): EndpointStats[] {
  // Aggregate requests and payments per path
  return db.prepare(`
    SELECT
      r.path,
      r.total_requests,
      COALESCE(p.total_payments, 0) AS total_payments,
      COALESCE(p.total_revenue_usd, 0) AS total_revenue_usd
    FROM (
      SELECT path, COUNT(*) AS total_requests
      FROM requests
      WHERE path LIKE '/api/near/%'
      GROUP BY path
    ) r
    LEFT JOIN (
      SELECT endpoint AS path, COUNT(*) AS total_payments, SUM(amount_usd) AS total_revenue_usd
      FROM payments
      GROUP BY endpoint
    ) p ON r.path = p.path
    ORDER BY r.total_requests DESC
  `).all() as EndpointStats[];
}

export function getTimeSeries(period: "hour" | "day" = "day"): TimeSeriesPoint[] {
  const fmt = period === "hour" ? "%Y-%m-%d %H:00" : "%Y-%m-%d";
  const lookback = period === "hour" ? "datetime('now', '-48 hours')" : "datetime('now', '-30 days')";

  return db.prepare(`
    SELECT
      rp.period,
      COALESCE(rp.requests, 0) AS requests,
      COALESCE(pp.payments, 0) AS payments,
      COALESCE(pp.revenue_usd, 0) AS revenue_usd
    FROM (
      SELECT strftime('${fmt}', timestamp) AS period, COUNT(*) AS requests
      FROM requests
      WHERE timestamp >= ${lookback}
      GROUP BY period
    ) rp
    LEFT JOIN (
      SELECT strftime('${fmt}', timestamp) AS period, COUNT(*) AS payments, SUM(amount_usd) AS revenue_usd
      FROM payments
      WHERE timestamp >= ${lookback}
      GROUP BY period
    ) pp ON rp.period = pp.period
    ORDER BY rp.period ASC
  `).all() as TimeSeriesPoint[];
}
