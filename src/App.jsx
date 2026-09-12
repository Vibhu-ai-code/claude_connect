import { useEffect, useMemo, useState } from 'react';
import './App.css';

const TODAY = '2026-05-15';

const KPIS = [
  {
    id: 'calls',
    label: 'Total Calls Handled',
    value: 4827,
    delta: +6.2,
    deltaUnit: '%',
    target: 4500,
    format: (v) => v.toLocaleString(),
    hint: 'vs. yesterday',
  },
  {
    id: 'aht',
    label: 'Avg Handle Time',
    value: 412,
    delta: +8.4,
    deltaUnit: '%',
    target: 360,
    format: (v) => `${Math.floor(v / 60)}m ${v % 60}s`,
    hint: 'target 6m 00s',
    inverse: true,
  },
  {
    id: 'fcr',
    label: 'First Call Resolution',
    value: 71.4,
    delta: -3.1,
    deltaUnit: 'pp',
    target: 78,
    format: (v) => `${v.toFixed(1)}%`,
    hint: 'target 78%',
  },
  {
    id: 'csat',
    label: 'CSAT Score',
    value: 4.1,
    delta: -0.2,
    deltaUnit: 'pts',
    target: 4.5,
    format: (v) => `${v.toFixed(1)} / 5`,
    hint: '1,204 surveys',
  },
  {
    id: 'sla',
    label: 'Service Level (20s)',
    value: 74.8,
    delta: -9.7,
    deltaUnit: 'pp',
    target: 85,
    format: (v) => `${v.toFixed(1)}%`,
    hint: 'target 85%',
  },
  {
    id: 'abandon',
    label: 'Abandonment Rate',
    value: 8.6,
    delta: +2.3,
    deltaUnit: 'pp',
    target: 4,
    format: (v) => `${v.toFixed(1)}%`,
    hint: 'target ≤ 4%',
    inverse: true,
  },
];

const HOURLY = [
  { hr: '08', calls: 132, sla: 92 },
  { hr: '09', calls: 248, sla: 88 },
  { hr: '10', calls: 372, sla: 81 },
  { hr: '11', calls: 461, sla: 73 },
  { hr: '12', calls: 538, sla: 64 },
  { hr: '13', calls: 612, sla: 58 },
  { hr: '14', calls: 547, sla: 61 },
  { hr: '15', calls: 489, sla: 70 },
  { hr: '16', calls: 421, sla: 78 },
  { hr: '17', calls: 358, sla: 84 },
  { hr: '18', calls: 274, sla: 87 },
  { hr: '19', calls: 195, sla: 90 },
  { hr: '20', calls: 120, sla: 93 },
];

const REASONS = [
  { label: 'Billing dispute', pct: 28.4, delta: +6.1 },
  { label: 'Order / delivery status', pct: 21.7, delta: +2.4 },
  { label: 'Tech support — login', pct: 14.9, delta: +9.2 },
  { label: 'Cancellation / refund', pct: 12.3, delta: +1.0 },
  { label: 'Product question', pct: 9.1, delta: -0.6 },
  { label: 'Account update', pct: 7.4, delta: -1.3 },
  { label: 'Other', pct: 6.2, delta: -0.8 },
];

const AGENTS = [
  { name: 'Priya Shah',      calls: 96, aht: 348, csat: 4.8, fcr: 86, status: 'top' },
  { name: 'Marcus Lee',      calls: 91, aht: 362, csat: 4.7, fcr: 83, status: 'top' },
  { name: 'Ana Ribeiro',     calls: 88, aht: 371, csat: 4.6, fcr: 81, status: 'top' },
  { name: 'Devon Carter',    calls: 84, aht: 402, csat: 4.4, fcr: 76, status: 'ok'  },
  { name: 'Mei Tanaka',      calls: 79, aht: 418, csat: 4.3, fcr: 73, status: 'ok'  },
  { name: 'Jordan Quinn',    calls: 72, aht: 487, csat: 3.6, fcr: 58, status: 'risk' },
  { name: 'Sasha Petrov',    calls: 68, aht: 521, csat: 3.4, fcr: 54, status: 'risk' },
];

const SENTIMENT = { positive: 52, neutral: 31, negative: 17 };

const ACTIONS = [
  {
    level: 'critical',
    title: 'SLA breach during 12:00–14:00 peak',
    detail:
      'Service Level dropped to 58% (target 85%). 612 calls in the 13:00 hour with only 14 agents staffed. Project shortfall of 6 agents.',
    next: 'Move 4 agents from email queue + extend 2 split-shifts to cover 11:30–14:30.',
  },
  {
    level: 'critical',
    title: 'Billing dispute volume up 6.1pp',
    detail:
      '28.4% of all calls today were billing-related — the May 14 invoice run is the likely driver. Avg handle time on this reason is 7m 12s.',
    next: 'Escalate to Billing Ops to publish a known-issue notice and prep a top-of-IVR message before tomorrow 09:00.',
  },
  {
    level: 'high',
    title: 'Tech support: login failures spiking',
    detail:
      'Login-related calls are +9.2pp DoD. Pattern correlates with the SSO release at 02:00 UTC. 38% of these escalate to Tier 2.',
    next: 'Page on-call SRE to confirm SSO health; publish KB article and add IVR self-serve reset.',
  },
  {
    level: 'high',
    title: '2 agents at coaching threshold',
    detail:
      'Jordan Quinn and Sasha Petrov are below 60% FCR and CSAT < 3.5 for the 3rd consecutive day.',
    next: 'Schedule 30-min side-by-side coaching tomorrow morning; pull 5 sample calls each for review.',
  },
  {
    level: 'medium',
    title: 'Abandonment 8.6% — above 4% target',
    detail:
      '418 abandoned calls today, 71% occurred in queue > 90 seconds. Callback offer is currently OFF after 17:00.',
    next: 'Enable callback offer 24×7 and lower the trigger threshold from 60s → 45s.',
  },
];

const FORECAST = [
  { hr: '08', calls: 145 },
  { hr: '09', calls: 270 },
  { hr: '10', calls: 395 },
  { hr: '11', calls: 480 },
  { hr: '12', calls: 560 },
  { hr: '13', calls: 640 },
  { hr: '14', calls: 575 },
  { hr: '15', calls: 510 },
  { hr: '16', calls: 440 },
  { hr: '17', calls: 370 },
  { hr: '18', calls: 285 },
  { hr: '19', calls: 205 },
  { hr: '20', calls: 130 },
];

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function Header({ now }) {
  return (
    <header className="dash-header">
      <div className="dash-header-inner">
        <div className="brand">
          <span className="brand-mark">CC</span>
          <div>
            <div className="brand-name">Call Center Insights</div>
            <div className="brand-sub">Daily operations dashboard</div>
          </div>
        </div>
        <div className="header-meta">
          <div className="meta-block">
            <span className="meta-label">Date</span>
            <span className="meta-value">{formatDate(TODAY)}</span>
          </div>
          <div className="meta-block">
            <span className="meta-label">Refreshed</span>
            <span className="meta-value">
              {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="meta-block status-block">
            <span className="status-dot" />
            <span className="meta-value">Live</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function KpiCard({ k }) {
  const inverse = !!k.inverse;
  const good = inverse ? k.delta < 0 : k.delta > 0;
  const onTarget =
    k.target == null
      ? null
      : inverse
      ? k.value <= k.target
      : k.value >= k.target;

  return (
    <div className="kpi">
      <div className="kpi-top">
        <span className="kpi-label">{k.label}</span>
        {onTarget != null && (
          <span className={`kpi-pill ${onTarget ? 'pill-good' : 'pill-bad'}`}>
            {onTarget ? 'On target' : 'Off target'}
          </span>
        )}
      </div>
      <div className="kpi-value">{k.format(k.value)}</div>
      <div className="kpi-foot">
        <span className={`kpi-delta ${good ? 'delta-good' : 'delta-bad'}`}>
          {k.delta > 0 ? '▲' : '▼'} {Math.abs(k.delta).toFixed(1)}{k.deltaUnit || '%'}
        </span>
        <span className="kpi-hint">{k.hint}</span>
      </div>
    </div>
  );
}

function ActionCard({ a }) {
  return (
    <article className={`action action-${a.level}`}>
      <div className="action-head">
        <span className={`action-badge badge-${a.level}`}>{a.level}</span>
        <h4>{a.title}</h4>
      </div>
      <p className="action-detail">{a.detail}</p>
      <div className="action-next">
        <span className="next-label">Next step</span>
        <span className="next-text">{a.next}</span>
      </div>
    </article>
  );
}

function VolumeChart() {
  const W = 640;
  const H = 240;
  const PAD = { l: 36, r: 12, t: 14, b: 28 };
  const max = Math.max(...HOURLY.map((d) => d.calls), ...FORECAST.map((d) => d.calls));
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const bw = innerW / HOURLY.length;

  const forecastPath = FORECAST.map((d, i) => {
    const x = PAD.l + i * bw + bw / 2;
    const y = PAD.t + innerH - (d.calls / max) * innerH;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => Math.round(p * max));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Hourly call volume">
      {yTicks.map((t, i) => {
        const y = PAD.t + innerH - (t / max) * innerH;
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="grid-line" />
            <text x={PAD.l - 6} y={y + 4} className="axis-text" textAnchor="end">
              {t}
            </text>
          </g>
        );
      })}
      {HOURLY.map((d, i) => {
        const x = PAD.l + i * bw + 4;
        const h = (d.calls / max) * innerH;
        const y = PAD.t + innerH - h;
        const breached = d.sla < 80;
        return (
          <g key={d.hr}>
            <rect
              x={x}
              y={y}
              width={bw - 8}
              height={h}
              rx={3}
              className={breached ? 'bar bar-bad' : 'bar bar-ok'}
            />
            <text
              x={x + (bw - 8) / 2}
              y={H - PAD.b + 16}
              className="axis-text"
              textAnchor="middle"
            >
              {d.hr}
            </text>
          </g>
        );
      })}
      <path d={forecastPath} className="forecast-line" />
      {FORECAST.map((d, i) => {
        const x = PAD.l + i * bw + bw / 2;
        const y = PAD.t + innerH - (d.calls / max) * innerH;
        return <circle key={i} cx={x} cy={y} r={2.5} className="forecast-dot" />;
      })}
    </svg>
  );
}

function SlaTrendChart() {
  const W = 640;
  const H = 200;
  const PAD = { l: 36, r: 12, t: 14, b: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const max = 100;
  const step = innerW / (HOURLY.length - 1);
  const points = HOURLY.map((d, i) => {
    const x = PAD.l + i * step;
    const y = PAD.t + innerH - (d.sla / max) * innerH;
    return [x, y];
  });
  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ');
  const area =
    `M ${PAD.l} ${PAD.t + innerH} ` +
    points.map(([x, y]) => `L ${x} ${y}`).join(' ') +
    ` L ${PAD.l + (HOURLY.length - 1) * step} ${PAD.t + innerH} Z`;

  const targetY = PAD.t + innerH - (85 / max) * innerH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Service level trend">
      {[0, 25, 50, 75, 100].map((t) => {
        const y = PAD.t + innerH - (t / max) * innerH;
        return (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} className="grid-line" />
            <text x={PAD.l - 6} y={y + 4} className="axis-text" textAnchor="end">
              {t}%
            </text>
          </g>
        );
      })}
      <line
        x1={PAD.l}
        x2={W - PAD.r}
        y1={targetY}
        y2={targetY}
        className="target-line"
      />
      <text x={W - PAD.r} y={targetY - 4} className="target-text" textAnchor="end">
        Target 85%
      </text>
      <path d={area} className="sla-area" />
      <path d={path} className="sla-line" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} className="sla-dot" />
      ))}
      {HOURLY.map((d, i) => (
        <text
          key={d.hr}
          x={PAD.l + i * step}
          y={H - PAD.b + 16}
          className="axis-text"
          textAnchor="middle"
        >
          {d.hr}
        </text>
      ))}
    </svg>
  );
}

function SentimentDonut() {
  const W = 200;
  const H = 200;
  const cx = W / 2;
  const cy = H / 2;
  const r = 78;
  const total = SENTIMENT.positive + SENTIMENT.neutral + SENTIMENT.negative;
  const segs = [
    { label: 'Positive', value: SENTIMENT.positive, cls: 'seg-pos' },
    { label: 'Neutral',  value: SENTIMENT.neutral,  cls: 'seg-neu' },
    { label: 'Negative', value: SENTIMENT.negative, cls: 'seg-neg' },
  ];
  let acc = -Math.PI / 2;
  return (
    <div className="donut-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="donut" role="img" aria-label="Sentiment breakdown">
        {segs.map((s) => {
          const angle = (s.value / total) * Math.PI * 2;
          const x1 = cx + r * Math.cos(acc);
          const y1 = cy + r * Math.sin(acc);
          const x2 = cx + r * Math.cos(acc + angle);
          const y2 = cy + r * Math.sin(acc + angle);
          const large = angle > Math.PI ? 1 : 0;
          const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
          acc += angle;
          return <path key={s.label} d={d} className={`donut-seg ${s.cls}`} />;
        })}
        <circle cx={cx} cy={cy} r={48} className="donut-hole" />
        <text x={cx} y={cy - 2} textAnchor="middle" className="donut-big">
          {SENTIMENT.positive}%
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="donut-small">
          positive
        </text>
      </svg>
      <ul className="donut-legend">
        {segs.map((s) => (
          <li key={s.label}>
            <span className={`legend-dot ${s.cls}`} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-value">{s.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReasonsList() {
  const max = Math.max(...REASONS.map((r) => r.pct));
  return (
    <ul className="reasons">
      {REASONS.map((r) => (
        <li key={r.label}>
          <div className="reason-row">
            <span className="reason-label">{r.label}</span>
            <span className="reason-value">{r.pct.toFixed(1)}%</span>
          </div>
          <div className="reason-bar">
            <span
              className="reason-fill"
              style={{ width: `${(r.pct / max) * 100}%` }}
            />
          </div>
          <span className={`reason-delta ${r.delta >= 0 ? 'delta-up' : 'delta-down'}`}>
            {r.delta >= 0 ? '▲' : '▼'} {Math.abs(r.delta).toFixed(1)} pp DoD
          </span>
        </li>
      ))}
    </ul>
  );
}

function AgentTable() {
  return (
    <table className="agents">
      <thead>
        <tr>
          <th>Agent</th>
          <th>Calls</th>
          <th>AHT</th>
          <th>FCR</th>
          <th>CSAT</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {AGENTS.map((a) => (
          <tr key={a.name}>
            <td className="agent-name">{a.name}</td>
            <td>{a.calls}</td>
            <td>{Math.floor(a.aht / 60)}m {a.aht % 60}s</td>
            <td>{a.fcr}%</td>
            <td>{a.csat.toFixed(1)}</td>
            <td>
              <span className={`agent-pill pill-${a.status}`}>
                {a.status === 'top' ? 'Top performer' : a.status === 'risk' ? 'Needs coaching' : 'On track'}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function QueueStrip() {
  const items = [
    { label: 'In queue now', value: '38', tone: 'warn' },
    { label: 'Longest wait', value: '3m 12s', tone: 'warn' },
    { label: 'Agents available', value: '6 / 42', tone: 'bad' },
    { label: 'Callbacks pending', value: '127', tone: 'warn' },
    { label: 'Abandoned today', value: '418', tone: 'bad' },
    { label: 'Repeat callers', value: '11.2%', tone: 'warn' },
  ];
  return (
    <div className="queue-strip">
      {items.map((it) => (
        <div key={it.label} className={`queue-tile tone-${it.tone}`}>
          <span className="queue-label">{it.label}</span>
          <span className="queue-value">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const criticalCount = useMemo(
    () => ACTIONS.filter((a) => a.level === 'critical').length,
    [],
  );

  return (
    <div className="dash">
      <Header now={now} />
      <main className="dash-main">
        <section className="kpis">
          {KPIS.map((k) => (
            <KpiCard key={k.id} k={k} />
          ))}
        </section>

        <section className="actions-section">
          <div className="section-head">
            <h2>Critical action pointers</h2>
            <span className="section-meta">
              {criticalCount} critical · {ACTIONS.length - criticalCount} other
            </span>
          </div>
          <div className="actions-grid">
            {ACTIONS.map((a) => (
              <ActionCard key={a.title} a={a} />
            ))}
          </div>
        </section>

        <section className="queue-section">
          <div className="section-head">
            <h2>Live queue snapshot</h2>
            <span className="section-meta">As of {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <QueueStrip />
        </section>

        <section className="row row-2">
          <div className="panel">
            <div className="panel-head">
              <h3>Hourly call volume</h3>
              <div className="legend-row">
                <span className="legend-chip chip-ok">SLA ≥ 80%</span>
                <span className="legend-chip chip-bad">SLA &lt; 80%</span>
                <span className="legend-chip chip-line">Forecast</span>
              </div>
            </div>
            <VolumeChart />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Service Level by hour</h3>
              <span className="panel-sub">Target 85% answered in 20s</span>
            </div>
            <SlaTrendChart />
          </div>
        </section>

        <section className="row row-3">
          <div className="panel">
            <div className="panel-head">
              <h3>Top call reasons</h3>
              <span className="panel-sub">Day-over-day shift</span>
            </div>
            <ReasonsList />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Customer sentiment</h3>
              <span className="panel-sub">From 1,204 surveys & transcripts</span>
            </div>
            <SentimentDonut />
          </div>
          <div className="panel">
            <div className="panel-head">
              <h3>Agent leaderboard</h3>
              <span className="panel-sub">Today, by calls handled</span>
            </div>
            <AgentTable />
          </div>
        </section>

        <footer className="dash-footer">
          <span>Daily Call Center Insights · Dashboard v1.0</span>
          <span>Data source: simulated dataset for {formatDate(TODAY)}</span>
        </footer>
      </main>
    </div>
  );
}
