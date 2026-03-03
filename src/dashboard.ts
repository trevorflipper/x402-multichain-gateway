export const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NEAR x402 Gateway — Analytics</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace; background: #0d1117; color: #c9d1d9; }
  .header { padding: 24px 32px; border-bottom: 1px solid #21262d; display: flex; align-items: center; gap: 16px; }
  .header h1 { font-size: 20px; color: #58a6ff; }
  .header .badge { background: #238636; color: #fff; padding: 2px 10px; border-radius: 12px; font-size: 12px; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px 32px; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .card { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; }
  .card .label { font-size: 12px; color: #8b949e; text-transform: uppercase; letter-spacing: 0.5px; }
  .card .value { font-size: 28px; font-weight: 700; margin-top: 4px; }
  .card .sub { font-size: 12px; color: #8b949e; margin-top: 4px; }
  .card .value.green { color: #3fb950; }
  .card .value.blue { color: #58a6ff; }
  .card .value.purple { color: #bc8cff; }
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 32px; }
  .chart-box { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; }
  .chart-box h3 { font-size: 14px; color: #8b949e; margin-bottom: 12px; }
  .table-section { background: #161b22; border: 1px solid #21262d; border-radius: 8px; padding: 20px; margin-bottom: 24px; }
  .table-section h3 { font-size: 14px; color: #8b949e; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 8px 12px; font-size: 11px; color: #8b949e; text-transform: uppercase; border-bottom: 1px solid #21262d; }
  td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #21262d; }
  .mono { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; }
  a { color: #58a6ff; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .truncate { max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: inline-block; vertical-align: bottom; }
  .refresh-bar { text-align: right; font-size: 11px; color: #484f58; margin-bottom: 8px; }
  @media (max-width: 800px) { .charts { grid-template-columns: 1fr; } }
</style>
</head>
<body>
<div class="header">
  <h1>NEAR x402 Gateway</h1>
  <span class="badge">Analytics</span>
</div>
<div class="container">
  <div class="refresh-bar">Auto-refresh every 30s &mdash; <span id="lastUpdate"></span></div>

  <div class="cards">
    <div class="card"><div class="label">Total Revenue</div><div class="value green" id="totalRevenue">$0.00</div><div class="sub" id="revenueToday">Today: $0.00</div></div>
    <div class="card"><div class="label">Total Payments</div><div class="value blue" id="totalPayments">0</div><div class="sub" id="paymentsToday">Today: 0</div></div>
    <div class="card"><div class="label">Unique Payers</div><div class="value purple" id="uniquePayers">0</div></div>
    <div class="card"><div class="label">Total Requests</div><div class="value" id="totalRequests">0</div><div class="sub" id="requestsToday">Today: 0</div></div>
    <div class="card"><div class="label">Unique Callers (IPs)</div><div class="value" id="uniqueCallers">0</div></div>
  </div>

  <div class="charts">
    <div class="chart-box"><h3>Daily Requests &amp; Revenue</h3><canvas id="timeChart"></canvas></div>
    <div class="chart-box"><h3>Requests by Endpoint</h3><canvas id="endpointChart"></canvas></div>
  </div>

  <div class="table-section">
    <h3>Top Payers</h3>
    <table><thead><tr><th>Wallet</th><th>Payments</th><th>Total Spent</th><th>Last Payment</th></tr></thead><tbody id="payersBody"></tbody></table>
  </div>

  <div class="table-section">
    <h3>Recent Payments</h3>
    <table><thead><tr><th>Time</th><th>Payer</th><th>Amount</th><th>Endpoint</th><th>Tx</th></tr></thead><tbody id="paymentsBody"></tbody></table>
  </div>
</div>

<script>
const BASE = window.location.origin;
let timeChart, endpointChart;

function solscanUrl(addr) { return 'https://solscan.io/account/' + addr; }
function solscanTx(hash) { return 'https://solscan.io/tx/' + hash; }
function truncate(s, n) { return s && s.length > n ? s.slice(0, n) + '...' : s; }
function fmt$(n) { return '$' + Number(n).toFixed(n >= 1 ? 2 : 4); }

async function fetchJSON(path) {
  const res = await fetch(BASE + path);
  return res.json();
}

async function refresh() {
  try {
    const [summary, timeseries, endpoints, payers, payments] = await Promise.all([
      fetchJSON('/api/analytics/summary'),
      fetchJSON('/api/analytics/timeseries?period=day'),
      fetchJSON('/api/analytics/endpoints'),
      fetchJSON('/api/analytics/payers?limit=10'),
      fetchJSON('/api/analytics/payments?limit=20'),
    ]);

    // Summary cards
    document.getElementById('totalRevenue').textContent = fmt$(summary.total_revenue_usd);
    document.getElementById('revenueToday').textContent = 'Today: ' + fmt$(summary.revenue_today_usd);
    document.getElementById('totalPayments').textContent = summary.total_payments;
    document.getElementById('paymentsToday').textContent = 'Today: ' + summary.payments_today;
    document.getElementById('uniquePayers').textContent = summary.unique_payers;
    document.getElementById('totalRequests').textContent = summary.total_requests;
    document.getElementById('requestsToday').textContent = 'Today: ' + summary.requests_today;
    document.getElementById('uniqueCallers').textContent = summary.unique_callers;

    // Time series chart
    const labels = timeseries.map(p => p.period);
    const reqData = timeseries.map(p => p.requests);
    const revData = timeseries.map(p => p.revenue_usd);

    if (timeChart) timeChart.destroy();
    timeChart = new Chart(document.getElementById('timeChart'), {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Requests', data: reqData, borderColor: '#58a6ff', backgroundColor: 'rgba(88,166,255,0.1)', yAxisID: 'y', tension: 0.3 },
          { label: 'Revenue ($)', data: revData, borderColor: '#3fb950', backgroundColor: 'rgba(63,185,80,0.1)', yAxisID: 'y1', tension: 0.3 },
        ]
      },
      options: {
        responsive: true,
        scales: {
          y: { position: 'left', ticks: { color: '#58a6ff' }, grid: { color: '#21262d' } },
          y1: { position: 'right', ticks: { color: '#3fb950', callback: v => '$'+v }, grid: { drawOnChartArea: false } },
          x: { ticks: { color: '#8b949e', maxTicksLimit: 10 }, grid: { color: '#21262d' } }
        },
        plugins: { legend: { labels: { color: '#c9d1d9' } } }
      }
    });

    // Endpoint chart
    const epLabels = endpoints.map(e => e.path.replace('/api/near/', ''));
    const epReqs = endpoints.map(e => e.total_requests);

    if (endpointChart) endpointChart.destroy();
    endpointChart = new Chart(document.getElementById('endpointChart'), {
      type: 'bar',
      data: {
        labels: epLabels,
        datasets: [{ label: 'Requests', data: epReqs, backgroundColor: '#58a6ff' }]
      },
      options: {
        responsive: true,
        indexAxis: 'y',
        scales: {
          x: { ticks: { color: '#8b949e' }, grid: { color: '#21262d' } },
          y: { ticks: { color: '#c9d1d9' }, grid: { color: '#21262d' } }
        },
        plugins: { legend: { display: false } }
      }
    });

    // Top payers table
    const pb = document.getElementById('payersBody');
    pb.innerHTML = payers.length === 0
      ? '<tr><td colspan="4" style="color:#484f58;text-align:center">No payments yet</td></tr>'
      : payers.map(p => '<tr>'
        + '<td class="mono"><a href="'+solscanUrl(p.payer)+'" target="_blank" class="truncate">'+truncate(p.payer,16)+'</a></td>'
        + '<td>'+p.total_payments+'</td>'
        + '<td class="green">'+fmt$(p.total_usd)+'</td>'
        + '<td>'+p.last_payment+'</td>'
        + '</tr>').join('');

    // Recent payments table
    const rpb = document.getElementById('paymentsBody');
    rpb.innerHTML = payments.length === 0
      ? '<tr><td colspan="5" style="color:#484f58;text-align:center">No payments yet</td></tr>'
      : payments.map(p => '<tr>'
        + '<td class="mono">'+p.timestamp+'</td>'
        + '<td class="mono"><a href="'+solscanUrl(p.payer)+'" target="_blank" class="truncate">'+truncate(p.payer,12)+'</a></td>'
        + '<td class="green">'+fmt$(p.amount_usd)+'</td>'
        + '<td class="mono">'+p.endpoint+'</td>'
        + '<td class="mono"><a href="'+solscanTx(p.tx_hash)+'" target="_blank" class="truncate">'+truncate(p.tx_hash,12)+'</a></td>'
        + '</tr>').join('');

    document.getElementById('lastUpdate').textContent = 'Updated ' + new Date().toLocaleTimeString();
  } catch (e) {
    console.error('Dashboard refresh error:', e);
    document.getElementById('lastUpdate').textContent = 'Error: ' + e.message;
  }
}

// Show loading state immediately
document.getElementById('lastUpdate').textContent = 'Loading...';
refresh();
setInterval(refresh, 30000);
</script>
</body>
</html>`;
