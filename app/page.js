'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api';
const FAILURE_CHOICES = [
  ['payment_db', 'Payment DB failure'],
  ['payment_latency', 'Payment latency'],
  ['inventory_crash', 'Inventory crash'],
  ['order_failure', 'Order service failure'],
  ['redis_hotspot', 'Redis hotspot'],
  ['auth_timeout', 'Auth timeout'],
  ['shipping_delay', 'Shipping delay'],
  ['notification_backlog', 'Notification backlog'],
];

const FAILURE_DESCRIPTIONS = {
  payment_db: { root: 'payment_db', label: 'Payment DB failure', note: 'The database is saturating under slow queries and connection pressure.' },
  payment_latency: { root: 'payment', label: 'Payment latency', note: 'The payment service is slow even when the database stays healthy.' },
  inventory_crash: { root: 'inventory', label: 'Inventory crash', note: 'Inventory retries and caches are failing under a worker outage.' },
  order_failure: { root: 'order', label: 'Order service failure', note: 'Order requests are failing before downstream systems can complete them.' },
  redis_hotspot: { root: 'redis_cache', label: 'Redis hotspot', note: 'Hot keys and cache misses are causing queueing across cart and order flows.' },
  auth_timeout: { root: 'auth', label: 'Auth timeout', note: 'Token validation and session checks are timing out for all protected requests.' },
  shipping_delay: { root: 'shipping', label: 'Shipping delay', note: 'Fulfillment is stuck behind provider latency and queue buildup.' },
  notification_backlog: { root: 'notification', label: 'Notification backlog', note: 'Delivery retries are backing up and delaying user updates.' },
};

const SERVICE_FAILURE_MAP = {
  gateway: ['Routes traffic to the core dependency graph.', 'Amplifies latency when upstream services begin failing.'],
  order: ['Accepts user requests, then fans out to inventory and payment.', 'Residual retries and queue depth can worsen the incident curve.'],
  user: ['Handles session and identity checks for protected traffic.', 'User retries often surge when auth and gateway checks slow down.'],
  inventory: ['Owns stock availability and back-order decisions.', 'Inventory retries lead to queue saturation and request timeouts.'],
  payment: ['Processes the final charge and settles checkout requests.', 'Payment timeouts cascade into failed orders and higher retry loops.'],
  payment_db: ['Stores transaction data and query results for checkout.', 'Slow queries, lock contention, and connection exhaustion are the key signatures.'],
  auth: ['Issues and validates access tokens and sessions.', 'Timeouts create broad user-facing failures in protected endpoints.'],
  catalog: ['Serves product metadata and discovery queries.', 'Catalog latency changes discovery workload and page-level reliability.'],
  cart: ['Tracks shopping cart state and checkout buffers.', 'Cart queue pressure often rises during hot-key cache misses.'],
  shipping: ['Owns fulfillment coordination and dispatch latency.', 'A slow shipping provider delays order completion and updates.'],
  notification: ['Queues customer alerts and delivery retries.', 'Backlog growth delays important update events on user-facing channels.'],
  redis_cache: ['Stores hot key state and session lookups.', 'Cache eviction and memory pressure multiply tail latency across services.'],
};

const empty = {
  services: [
    { id: 'gateway', name: 'API Gateway', latency_ms: 82, error_rate: 0.2, status: 'healthy' },
    { id: 'order', name: 'Order Service', latency_ms: 118, error_rate: 0.5, status: 'healthy' },
    { id: 'user', name: 'User Service', latency_ms: 102, error_rate: 0.4, status: 'healthy' },
    { id: 'inventory', name: 'Inventory Service', latency_ms: 122, error_rate: 0.6, status: 'healthy' },
    { id: 'payment', name: 'Payment Service', latency_ms: 109, error_rate: 0.3, status: 'healthy' },
    { id: 'payment_db', name: 'Payment Database', latency_ms: 36, error_rate: 0, status: 'healthy' },
  ],
  incident: null,
  rca: null,
  timeline: [],
  series: [96, 102, 99, 104, 98, 101, 103, 100],
  selected_preset: { id: 'six', label: '6 microservices' },
  selected_example: { id: 'commerce', label: 'Commerce Flow' },
  selected_failure: null,
};

const latency = (n) => (n >= 1000 ? `${(n / 1000).toFixed(2)}s` : `${n}ms`);

function Node({ service, root, select, failureMeta }) {
  const kind = service.id === root ? 'root' : service.status === 'healthy' ? '' : 'affected';
  const relatedFailure = failureMeta?.root === service.id ? failureMeta.label : 'Observed impact';
  const bullets = SERVICE_FAILURE_MAP[service.id] ?? ['This service carries dependency pressure from upstream flow.', 'Any latency here accelerates downstream user-visible errors.'];

  return (
    <button className={`service-node ${kind}`} onClick={() => select(`${service.name}: ${latency(service.latency_ms)}, ${service.error_rate}% errors`)}>
      <span className="service-node-header">
        <span className="node-name">{service.name}</span>
        <span className="failure-tag">{relatedFailure}</span>
      </span>
      <span className="node-status"><i />{service.id === root ? 'Root cause' : service.status === 'healthy' ? 'Healthy' : 'Degraded'}</span>
      <span className="node-metrics"><span>{latency(service.latency_ms)}</span><span>{service.error_rate}% errors</span></span>
      <ul className="service-failure-bullets">
        {bullets.map((bullet) => (
          <li key={`${service.id}-${bullet}`}>{bullet}</li>
        ))}
      </ul>
    </button>
  );
}

function Chart({ data, metric }) {
  const values = metric === 'errors'
    ? data.map((x) => Math.max(1, Math.round(x / 65)))
    : metric === 'cpu'
      ? data.map((x) => Math.min(98, Math.round(28 + x / 38)))
      : data;
  const max = Math.max(...values) * 1.1;
  const points = values.map((v, i) => `${44 + i * 63},${137 - (v / max) * 112}`).join(' ');

  return (
    <svg className="chart" viewBox="0 0 500 170" role="img" aria-label={`${metric} trajectory`}>
      <line x1="43" y1="25" x2="486" y2="25" />
      <line x1="43" y1="81" x2="486" y2="81" />
      <line x1="43" y1="137" x2="486" y2="137" />
      <text x="4" y="28">{Math.round(max)}{metric === 'latency' ? 'ms' : '%'}</text>
      <text x="14" y="84">{Math.round(max / 2)}</text>
      <text x="24" y="140">0</text>
      <polyline points={points} />
      <circle cx={422} cy={137 - values[6] / max * 112} r="4" />
      <text x="43" y="160">12:40:56</text>
      <text x="220" y="160">12:41:02</text>
      <text x="410" y="160">12:41:10</text>
    </svg>
  );
}

export default function Home() {
  const [data, setData] = useState(empty);
  const [presets, setPresets] = useState([]);
  const [scenario, setScenario] = useState('payment_db');
  const [presetId, setPresetId] = useState('six');
  const [exampleId, setExampleId] = useState('commerce');
  const [metric, setMetric] = useState('latency');
  const [notice, setNotice] = useState('Connecting to the RCA engine…');
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState('overview');
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  const currentPreset = useMemo(
    () => presets.find((preset) => preset.id === presetId) ?? presets[0],
    [presets, presetId],
  );
  const currentExample = useMemo(
    () => (currentPreset?.examples ?? []).find((example) => example.id === exampleId) ?? currentPreset?.examples?.[0],
    [currentPreset, exampleId],
  );

  const load = useCallback(async () => {
    try {
      const [presetRes, dashboardRes] = await Promise.all([
        fetch(`${API}/presets`),
        fetch(`${API}/dashboard`),
      ]);

      if (!presetRes.ok || !dashboardRes.ok) throw new Error('backend unavailable');

      const presetData = await presetRes.json();
      const dashboard = await dashboardRes.json();
      const presetList = presetData.presets ?? [];

      setPresets(presetList);
      const preset = presetList.find((item) => item.id === dashboard.selected_preset?.id) ?? presetList[0];
      const example = (preset?.examples ?? []).find((item) => item.id === dashboard.selected_example?.id) ?? preset?.examples?.[0];

      setPresetId(preset?.id ?? 'six');
      setExampleId(example?.id ?? 'commerce');
      setScenario(dashboard.selected_failure ?? 'payment_db');
      setData(dashboard);
      setNotice(dashboard.incident ? `Live incident #${dashboard.incident.id} loaded from the backend` : 'Backend connected — system baseline is healthy');
    } catch {
      setNotice('Backend unavailable — start it with “npm run backend” to enable incident injection');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const mutate = async (body, message) => {
    setBusy(true);
    try {
      const r = await fetch(`${API}/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error('request failed');
      const payload = await r.json();
      setData(payload);
      setNotice(message);
    } catch {
      setNotice('Request failed. Confirm the FastAPI backend is running on port 8000.');
    } finally {
      setBusy(false);
    }
  };

  const handleApplyTopology = async () => {
    const presetLabel = currentPreset?.label ?? '6 microservices';
    const exampleLabel = currentExample?.label ?? 'Commerce Flow';
    await mutate(
      { preset: presetId, example: exampleId },
      `Applied ${presetLabel} • ${exampleLabel}`,
    );
  };

  const handleInjectFailure = async () => {
    const selectedFailure = FAILURE_CHOICES.find(([id]) => id === scenario)?.[1] ?? scenario;
    const presetLabel = currentPreset?.label ?? '6 microservices';
    const exampleLabel = currentExample?.label ?? 'Commerce Flow';
    await mutate(
      { failure: scenario, preset: presetId, example: exampleId },
      `Injected ${selectedFailure} on ${presetLabel} • ${exampleLabel}`,
    );
  };

  const services = useMemo(
    () => Object.fromEntries((data.services ?? []).map((item) => [item.id, item])),
    [data.services],
  );
  const root = data.rca?.root_cause?.id;
  const failureMeta = FAILURE_DESCRIPTIONS[scenario] ?? FAILURE_DESCRIPTIONS.payment_db;
  const errors = Math.max(...(data.services ?? []).map((x) => x.error_rate));
  const peak = Math.max(...(data.services ?? []).map((x) => x.latency_ms));
  const affected = (data.services ?? []).filter((x) => x.status !== 'healthy').length;
  const affectedNames = (data.services ?? []).filter((x) => x.status !== 'healthy').map((x) => x.name);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <strong>ROOTCAUSE AI</strong>
          <span>Distributed intelligence</span>
        </div>
        <nav>
          {['overview', 'incidents', 'topology', 'analytics'].map((item) => (
            <button key={item} className={view === item ? 'nav-active' : ''} onClick={() => setView(item)}>
              {item[0].toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>
      </aside>

      <section className="dashboard">
        <header>
          <div>
            <p className="eyebrow">{data.incident ? `INCIDENT #${data.incident.id}` : 'SYSTEM BASELINE'}</p>
            <h1>{view[0].toUpperCase() + view.slice(1)}</h1>
            <p className="muted">API-driven telemetry · Temporal analysis enabled</p>
          </div>
          <div className="top-actions">
            <span className="monitor"><i /> Monitoring {data.services.length} services</span>
            <button className="theme-toggle" type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle light and dark mode">
              {theme === 'dark' ? '☀ Light mode' : '◐ Dark mode'}
            </button>
          </div>
        </header>

        <div className="control-stack">
          <section className="control-panel">
            <div className="control-panel-header">
              <span className="eyebrow subtle">Topology</span>
              <h2>Microservice preset</h2>
            </div>
            <div className="preset-controls">
              <label>
                <span>Preset</span>
                <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
                  {(presets ?? []).map((preset) => (
                    <option key={preset.id} value={preset.id}>{preset.label}</option>
                  ))}
                </select>
              </label>

              <label>
                <span>Example</span>
                <select value={exampleId} onChange={(event) => setExampleId(event.target.value)}>
                  {(currentPreset?.examples ?? []).map((example) => (
                    <option key={example.id} value={example.id}>{example.label}</option>
                  ))}
                </select>
              </label>

              <button type="button" className="secondary" onClick={handleApplyTopology} disabled={busy}>
                {busy ? 'Applying…' : 'Apply topology'}
              </button>
            </div>
          </section>

          <section className="control-panel">
            <div className="control-panel-header">
              <span className="eyebrow subtle">Failure</span>
              <h2>Injection control</h2>
            </div>
            <div className="preset-controls failure-controls">
              <label>
                <span>Failure</span>
                <select value={scenario} onChange={(event) => setScenario(event.target.value)}>
                  {FAILURE_CHOICES.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
              </label>

              <div className="failure-summary">
                <strong>{failureMeta.label}</strong>
                <small>{failureMeta.note}</small>
              </div>

              <button type="button" className="primary" onClick={handleInjectFailure} disabled={busy}>
                {busy ? 'Injecting…' : 'Inject failure'}
              </button>
            </div>
          </section>
        </div>

        {view === 'incidents' && (
          <section className="view-panel">
            <h2>Incident records</h2>
            {data.incident ? (
              <div>
                <strong>#{data.incident.id} · {data.incident.severity}</strong>
                <span>{data.rca?.root_cause.name} · {Math.round((data.rca?.confidence ?? 0) * 100)}% confidence</span>
              </div>
            ) : (
              <p>No active incidents. Inject a failure from Overview to begin an investigation.</p>
            )}
          </section>
        )}

        {view === 'topology' && (
          <section className="view-panel">
            <h2>Service topology</h2>
            <div className="service-list">
              {(data.services ?? []).map((service) => (
                <button key={service.id} onClick={() => setNotice(`${service.name}: ${service.status}`)}>
                  <strong>{service.name}</strong>
                  <span>{service.status} · {latency(service.latency_ms)} · {service.error_rate}% errors</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {view === 'analytics' && (
          <section className="view-panel">
            <h2>RCA analytics</h2>
            <p>Temporal priority, anomaly score, dependency impact, and error propagation are recomputed whenever a scenario is injected.</p>
            <div className="analytics-values">
              <span>Peak latency <strong>{latency(peak)}</strong></span>
              <span>Peak errors <strong>{errors.toFixed(1)}%</strong></span>
              <span>Affected services <strong>{affectedNames.length || 'None'}</strong></span>
            </div>
          </section>
        )}

        <div className={view === 'overview' ? 'overview-content' : 'overview-content is-hidden'}>
          <section className="metrics">
            <article>
              <span>Services</span>
              <strong>{data.services.length}</strong>
              <small>{affected ? `${affected} impacted` : 'All systems operational'}</small>
            </article>
            <article>
              <span>Error rate</span>
              <strong>{errors.toFixed(1)}%</strong>
              <small>{data.incident ? 'Anomaly above baseline' : 'Normal range'}</small>
            </article>
            <article>
              <span>Latency</span>
              <strong>{latency(peak)}</strong>
              <small>{data.incident ? 'Peak observed' : 'Normal range'}</small>
            </article>
            <article>
              <span>Active incidents</span>
              <strong>{data.incident ? '1' : '0'}</strong>
              <small>{data.incident ? `${data.incident.severity} severity` : 'No open incidents'}</small>
            </article>
          </section>

          <section className="focus-grid">
            <section>
              <h2>Service dependency graph</h2>
              <div className="topology-grid">
                {(data.services ?? []).map((service) => (
                  <Node key={service.id} service={service} root={root} select={setNotice} failureMeta={failureMeta} />
                ))}
              </div>
            </section>

            <aside className="analysis">
              <h2>Root cause analysis</h2>
              <div className="analysis-card">
                <div className="cause-title">
                  <div>
                    <span>Most likely origin</span>
                    <strong>{data.rca?.root_cause.name ?? 'Awaiting incident'}</strong>
                  </div>
                  <b>{data.incident?.severity ?? 'NORMAL'}</b>
                </div>

                <div className="confidence">
                  <div>
                    <span>Confidence</span>
                    <strong>{data.rca ? `${Math.round(data.rca.confidence * 100)}%` : '—'}</strong>
                  </div>
                  <div><i style={{ width: `${data.rca ? data.rca.confidence * 100 : 0}%` }} /></div>
                </div>

                <ul>
                  {(data.rca?.evidence ?? ['Inject a failure to begin graph-based root cause analysis']).map((item) => (
                    <li key={item}>✓ <span>{item}</span></li>
                  ))}
                </ul>

                {data.rca && <p className="affected-services"><strong>Affected services</strong>{affectedNames.join(', ')}</p>}

                <button onClick={() => setEvidenceOpen(!evidenceOpen)} aria-expanded={evidenceOpen}>
                  {evidenceOpen ? 'Hide evidence' : 'View evidence'}
                </button>

                {evidenceOpen && (
                  <div className="evidence-drawer" aria-live="polite">
                    <strong>Investigation details</strong>
                    {data.rca ? (
                      <>
                        <div className="evidence-metrics">
                          <span><small>Origin latency</small><b>{latency(data.rca.root_cause.latency_ms)}</b></span>
                          <span><small>Error rate</small><b>{data.rca.root_cause.error_rate}%</b></span>
                          <span><small>RCA confidence</small><b>{Math.round(data.rca.confidence * 100)}%</b></span>
                        </div>
                        <div className="evidence-section">
                          <small>Propagation path</small>
                          <p>{data.rca.root_cause.name} → {affectedNames.filter((name) => name !== data.rca.root_cause.name).join(' → ')}</p>
                        </div>
                        <div className="evidence-section">
                          <small>Trace impact</small>
                          <p>{affectedNames.length} of {data.services.length} services are outside their healthy baseline; the earliest anomaly is at {data.rca.root_cause.name}.</p>
                        </div>
                        <div className="evidence-section">
                          <small>Recommended first check</small>
                          <p>{data.rca.root_cause.id === 'payment_db' ? 'Inspect connection-pool saturation, slow queries, and database resource utilization.' : data.rca.root_cause.id === 'payment' ? 'Inspect downstream timeouts and payment-provider response latency.' : data.rca.root_cause.id === 'inventory' ? 'Inspect inventory worker saturation, retries, and data-store availability.' : data.rca.root_cause.id === 'order' ? 'Inspect order queue depth, DB transaction failures, and retry storms.' : data.rca.root_cause.id === 'auth' ? 'Inspect token validation latency and dependency timeouts on the auth store.' : data.rca.root_cause.id === 'redis_cache' ? 'Inspect hot keys, memory pressure, and cache eviction churn.' : 'Check the service’s health checks, dependency timeouts, and queue pressure.'}</p>
                        </div>
                      </>
                    ) : (
                      <p>Awaiting evidence</p>
                    )}
                  </div>
                )}
              </div>
            </aside>
          </section>

          <section className="bottom-grid">
            <section>
              <h2>Metric trajectory</h2>
              <div className="tabs">
                {['latency', 'errors', 'cpu'].map((item) => (
                  <button className={metric === item ? 'selected' : ''} onClick={() => setMetric(item)} key={item}>{item}</button>
                ))}
              </div>
              <Chart data={data.series} metric={metric} />
            </section>

            <section>
              <h2>Incident timeline</h2>
              <ol className="timeline">
                {(data.timeline.length ? data.timeline : [{ time: 'now', message: 'Waiting for telemetry anomaly', is_origin: true }]).map((event) => (
                  <li key={`${event.time}-${event.message}`} className={event.is_resolution ? 'final' : ''}>
                    <time>{event.time}</time>
                    <i />
                    <div>
                      <strong>{event.message}</strong>
                      {event.is_origin && <span>{data.incident ? 'First anomaly' : 'Baseline monitoring'}</span>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          </section>
        </div>

        <p className="notice" aria-live="polite">{notice}</p>
      </section>
    </main>
  );
}
