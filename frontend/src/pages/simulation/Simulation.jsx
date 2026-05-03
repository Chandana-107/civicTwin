import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  runABMSimulation, getABMProgress, fetchStepResults,
  getSimulationHistory,
} from '../../services/simulationApi';
import SimulationCompare from './SimulationCompare';
import ConsequencePanel from './ConsequencePanel';
import ReportExporter from './ReportExporter';
import ResourceOptimizer from './ResourceOptimizer';
import SimulationLayout from './SimulationLayout';
import EmptyState      from './EmptyState';
import ErrorCard       from './ErrorCard';


// Simulation service base URL — reads from .env, fallback to 8003
const SIM_API = import.meta.env.VITE_SIMULATION_API_URL || 'http://127.0.0.1:8003';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Filler);

// Fix 5: Kill ALL Chart.js animation at the module level, before any instance is created.
// Must set all three — animation alone is not enough in Chart.js 4.x.
ChartJS.defaults.animation   = false;
ChartJS.defaults.animations  = {};
ChartJS.defaults.transitions = {};

// ── Constants ──────────────────────────────────────────────────────────────────
const METRICS = [
  {
    key: 'employment_rate',
    label: 'Employment Rate',
    color: '#378ADD',
    format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—',
    derive: (mbs, i) => (mbs.unemployment_rate?.[i] != null ? 1 - mbs.unemployment_rate[i] : null),
    higherIsBetter: true,
  },
  {
    key: 'welfare_index',
    label: 'Welfare Index',
    color: '#1D9E75',
    format: (v) => v != null ? v.toFixed(3) : '—',
    derive: (mbs, i) => mbs.avg_welfare?.[i] ?? null,
    higherIsBetter: true,
  },
  {
    key: 'infrastructure',
    label: 'Infrastructure',
    color: '#BA7517',
    format: (v) => v != null ? v.toFixed(1) : '—',
    derive: (mbs, i) => mbs.infrastructure_score?.[i] ?? null,
    higherIsBetter: true,
  },
  {
    key: 'environment',
    label: 'Environment Score',
    color: '#639922',
    format: (v) => v != null ? v.toFixed(1) : '—',
    derive: (mbs, i) => mbs.env_score?.[i] ?? null,
    higherIsBetter: true,
  },
];

// Fix 5: Per-instance options also disable animation/animations/transitions
function makeChartOptions(color) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation:   false,
    animations:  {},
    transitions: {},
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: {
        display: true,
        border: { display: false },
        grid: { color: '#f0f0f0', drawTicks: false },
        ticks: { maxTicksLimit: 4, color: '#9ca3af', font: { size: 10 }, padding: 4 },
      },
    },
    elements: {
      line:  { tension: 0.35, borderWidth: 2 },
      point: { radius: 2, borderWidth: 0 },
    },
  };
}

function makeEmptyData(color) {
  return {
    labels: [],
    datasets: [{
      data: [],
      borderColor: color,
      backgroundColor: color + '18',
      fill: true,
      tension: 0.35,
      pointRadius: 2,
      pointBackgroundColor: color,
    }],
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function MetricCard({ metric, value, prevValue, isLive }) {
  const delta = prevValue != null && value != null ? value - prevValue : null;
  const isUp  = delta != null && delta > 0.0001;
  const isDn  = delta != null && delta < -0.0001;
  const improved = metric.higherIsBetter ? isUp : isDn;
  const declined = metric.higherIsBetter ? isDn : isUp;

  return (
    <div style={{
      background: 'white',
      border: '1px solid #e5e7eb',
      borderTop: `3px solid ${metric.color}`,
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
      display: 'flex', flexDirection: 'column', gap: '0.2rem',
      position: 'relative', overflow: 'hidden',
    }}>
      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {metric.label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '1.75rem', fontWeight: 800, color: metric.color, lineHeight: 1.1 }}>
          {metric.format(value)}
        </span>
        {delta != null && Math.abs(delta) > 0.0001 && (
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: improved ? '#059669' : declined ? '#dc2626' : '#6b7280' }}>
            {improved ? '↑' : declined ? '↓' : '→'}
            {metric.key === 'employment_rate'
              ? ` ${(Math.abs(delta) * 100).toFixed(2)}pp`
              : ` ${Math.abs(delta).toFixed(metric.key === 'infrastructure' || metric.key === 'environment' ? 2 : 4)}`}
          </span>
        )}
      </div>
      {isLive && (
        <span style={{
          position: 'absolute', top: '0.5rem', right: '0.6rem',
          width: '7px', height: '7px', borderRadius: '50%',
          background: '#10b981', boxShadow: '0 0 0 2px #d1fae5',
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }} />
      )}
    </div>
  );
}

function StatusBar({ scenario, progress, simulationId }) {
  const isRunning  = progress.status === 'running';
  const isComplete = progress.status === 'complete';
  const pct = Math.min(100, progress.pct || 0);

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
          {simulationId && (
            <code style={{ fontSize: '0.7rem', color: '#9ca3af', background: '#f9fafb', padding: '0.15rem 0.4rem', borderRadius: '4px', flexShrink: 0 }}>
              {simulationId.slice(0, 8)}…
            </code>
          )}
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {scenario ? `"${scenario.slice(0, 60)}${scenario.length > 60 ? '…' : ''}"` : 'No scenario description'}
          </span>
        </div>
        <span style={{
          flexShrink: 0, marginLeft: '1rem', padding: '0.25rem 0.75rem', borderRadius: '99px',
          fontSize: '0.75rem', fontWeight: 700,
          background: isComplete ? '#d1fae5' : isRunning ? '#dbeafe' : '#f3f4f6',
          color:      isComplete ? '#065f46'  : isRunning ? '#1d4ed8'  : '#6b7280',
        }}>
          {isComplete
            ? `Complete — ${progress.total_steps} steps`
            : isRunning
            ? `Running — step ${progress.steps_done} / ${progress.total_steps}`
            : 'Ready'}
        </span>
      </div>
      <div style={{ height: '3px', background: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: '99px',
          background: isComplete ? 'linear-gradient(90deg,#059669,#10b981)' : 'linear-gradient(90deg,#1E3150,#5377A2)',
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  );
}

// Fix 3: LiveChart uses imperative chart.update('none') to push points without
// re-rendering React or re-animating the whole line.
function LiveChart({ metric, chartRef }) {
  const options = useRef(makeChartOptions(metric.color));
  const initData = useRef(makeEmptyData(metric.color));

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.5rem' }}>
        {metric.label}
      </div>
      <div style={{ height: '130px' }}>
        <Line ref={chartRef} data={initData.current} options={options.current} />
      </div>
    </div>
  );
}

function InterpretedParamsPanel({ params }) {
  const [open, setOpen] = useState(false);
  const keys = Object.keys(params || {});
  if (!keys.length) return null;
  const fmt = (k, v) => {
    if (k.includes('pct') || k.includes('prob') || k.includes('rate')) return `${(v * 100).toFixed(1)}%`;
    if (k.includes('spend') || k.includes('budget')) return `₹${Number(v).toFixed(0)}`;
    return Number(v).toFixed(2);
  };
  return (
    <div style={{ border: '1px solid #dbeafe', borderRadius: '0.75rem', overflow: 'hidden', background: '#f0f9ff', marginBottom: '1.25rem' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.8rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, color: '#1d4ed8', fontSize: '0.85rem' }}>
        <span>🧠 What the AI set from your scenario</span>
        <span style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>
      {open && (
        <div style={{ padding: '0 1.25rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
          {keys.map(k => (
            <div key={k} style={{ background: 'white', border: '1px solid #bfdbfe', borderRadius: '99px', padding: '0.3rem 0.8rem', fontSize: '0.78rem', fontWeight: 500, color: '#1e40af', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <span style={{ color: '#6b7280' }}>{k.replace(/_/g, ' ')}</span>
              <span>→</span>
              <span style={{ fontWeight: 700 }}>{fmt(k, params[k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ history, onReload }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h4 style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>Recent Runs</h4>
        <button onClick={onReload} style={{ background: 'none', border: 'none', color: 'var(--primary-light)', cursor: 'pointer', fontSize: '0.78rem' }}>↻ Refresh</button>
      </div>
      {history.length === 0
        ? <p style={{ color: '#9ca3af', fontSize: '0.82rem' }}>No previous simulations.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {history.slice(0, 5).map(h => (
              <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.9rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.78rem' }}>
                <div>
                  <span style={{ display: 'inline-block', padding: '0.1rem 0.45rem', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, background: h.source === 'abm' ? '#dbeafe' : '#d1fae5', color: h.source === 'abm' ? '#1d4ed8' : '#065f46', marginRight: '0.5rem' }}>{h.source?.toUpperCase()}</span>
                  {h.scenario || <em style={{ color: '#9ca3af' }}>No description</em>}
                </div>
                <span style={{ color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: '1rem' }}>{h.n_steps} steps</span>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
const Simulation = () => {
  // Mode toggle
  const [mode, setMode] = useState('single'); // 'single' | 'compare'

  // Form state
  const [n, setN]           = useState(120);
  const [scenario, setScenario] = useState('');
  const [steps, setSteps]   = useState(20);

  // Run state
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [simulationId, setSimulationId] = useState(null);
  const [runScenario, setRunScenario]   = useState('');
  const [progress, setProgress]         = useState({ status: 'idle', steps_done: 0, total_steps: 0, pct: 0 });
  const [interpretedParams, setInterpretedParams] = useState({});
  const [history, setHistory]           = useState([]);

  // V5: meanByStep populated after completion, reset to null on new run
  const [meanByStep, setMeanByStep]       = useState(null);
  // V8: consequence result fetched in parent to avoid child mount/unmount race
  const [consequenceResult, setConsequenceResult] = useState(null);
  const [consequenceLoading, setConsequenceLoading] = useState(false);
  const [consequenceError,   setConsequenceError]   = useState('');

  // Metric card state (React-driven for re-renders)
  const [metricValues, setMetricValues] = useState(METRICS.map(() => null));
  const [prevValues,   setPrevValues]   = useState(METRICS.map(() => null));

  // V3: renderedSteps ref — how many steps have been pushed to the charts
  // Reset to 0 at the start of every new simulation run.
  const renderedStepsRef = useRef(0);

  // Chart refs — one per metric, used for imperative updates
  const chartRefs = useRef(METRICS.map(() => React.createRef()));

  // Polling interval ref
  const pollRef = useRef(null);

  // Abort controller ref for the in-flight consequence fetch.
  // Stored in a ref (not state) so the cleanup closure always sees the latest value.
  const consequenceAbortRef = useRef(null);

  // Stable refs so async callbacks can read current scenario/n without stale closures
  const runScenarioRef = useRef('');
  const nRef           = useRef(120);
  useEffect(() => { runScenarioRef.current = runScenario; }, [runScenario]);
  useEffect(() => { nRef.current = n; }, [n]);

  // Whether the dashboard should be shown at all
  const isActive = loading || progress.status === 'complete';

  // Inject keyframe animation once
  useEffect(() => {
    const id = 'sim-pulse-style';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id;
      s.textContent = `@keyframes pulse-dot { 0%,100%{opacity:1}50%{opacity:0.4} }`;
      document.head.appendChild(s);
    }
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try { const d = await getSimulationHistory(); setHistory(d.simulations || []); }
    catch (_) {}
  };

  // Fix 3: Push exactly the newly-arrived steps onto each chart imperatively.
  // Does NOT replace the dataset — only appends new points.
  // V3: uses renderedStepsRef to know how many steps are already on the chart.
  const pushNewSteps = useCallback((mbs, stepsNow) => {
    const from = renderedStepsRef.current;
    const to   = stepsNow;
    if (!mbs || to <= from) return;

    // Iterate over only the new steps [from .. to)
    for (let i = from; i < to; i++) {
      const label = String(i + 1);

      METRICS.forEach((metric, mi) => {
        const chart = chartRefs.current[mi]?.current;
        if (!chart) return;
        chart.data.labels.push(label);
        chart.data.datasets[0].data.push(metric.derive(mbs, i));
        // Fix 5: update('none') — no animation mode, instant point appearance
        chart.update('none');
      });
    }

    // Update React metric cards with the latest step value
    const latestIdx = to - 1;
    const prevIdx   = to - 2;
    setMetricValues(METRICS.map(m => m.derive(mbs, latestIdx)));
    setPrevValues(METRICS.map(m => prevIdx >= 0 ? m.derive(mbs, prevIdx) : null));

    // V3: advance the rendered cursor
    renderedStepsRef.current = to;
  }, []);

  // Clear all charts imperatively (for new run)
  const clearCharts = useCallback(() => {
    chartRefs.current.forEach(ref => {
      const chart = ref?.current;
      if (!chart) return;
      chart.data.labels   = [];
      chart.data.datasets[0].data = [];
      chart.update('none');
    });
    renderedStepsRef.current = 0;  // V3: reset cursor
    setMetricValues(METRICS.map(() => null));
    setPrevValues(METRICS.map(() => null));
  }, []);

  // ── Polling loop ──────────────────────────────────────────────────────────
  // Starts when simulationId is set and loading=true.
  // Polls every 800ms. On each tick:
  //   - checks steps_done > renderedSteps
  //   - fetches partial results
  //   - pushes only new points via pushNewSteps()
  useEffect(() => {
    if (!simulationId || !loading) return;
    clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const prog = await getABMProgress(simulationId);
        setProgress(prog);

        // V3: only fetch results if new steps have arrived
        if (prog.steps_done > renderedStepsRef.current) {
          const raw = await fetchStepResults(simulationId);
          // Handle both shapes: { results: { mean_by_step } } or { mean_by_step }
          const mbs = raw?.results?.mean_by_step || raw?.mean_by_step;
          if (mbs) pushNewSteps(mbs, prog.steps_done);
        }

        if (prog.status === 'complete') {
          clearInterval(pollRef.current);
          // Final sweep — ensure all steps are rendered
          const finalRaw = await fetchStepResults(simulationId);
          const mbs = finalRaw?.results?.mean_by_step || finalRaw?.mean_by_step;
          if (mbs) {
            pushNewSteps(mbs, prog.total_steps);
            setMeanByStep(mbs);

            // V8: consequence fetch — parent-owned, AbortController-guarded
            // Abort any previous in-flight request before starting a new one.
            if (consequenceAbortRef.current) consequenceAbortRef.current.abort();
            const controller = new AbortController();
            consequenceAbortRef.current = controller;

            // 25-second hard timeout: abort the fetch if Gemini hangs.
            const abortTimer = setTimeout(() => controller.abort(), 25_000);

            setConsequenceLoading(true);
            setConsequenceError('');
            fetch(`${SIM_API}/analyse/consequences`, {
              method:  'POST',
              headers: { 'Content-Type': 'application/json' },
              signal:  controller.signal,
              body: JSON.stringify({
                scenario:     runScenarioRef.current || '',
                n_steps:      prog.total_steps,
                n_agents:     nRef.current || 120,
                mean_by_step: mbs,
              }),
            })
              .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
              .then(data => {
                setConsequenceResult(data);
                setConsequenceLoading(false);
              })
              .catch(err => {
                // AbortError fires both on timeout and on unmount — show
                // a clear message only for the timeout case (controller not
                // yet nulled); unmount case is silenced as component is gone.
                if (err?.name === 'AbortError') {
                  setConsequenceError('Analysis timed out — try again');
                } else {
                  setConsequenceError(String(err));
                }
                setConsequenceLoading(false);
              })
              .finally(() => {
                // Cancel the timer so it doesn’t fire after a fast response.
                clearTimeout(abortTimer);
              });
          }
          setLoading(false);
          toast.success('Simulation complete!');
          loadHistory();
        } else if (prog.status === 'error') {
          clearInterval(pollRef.current);
          setLoading(false);
          setError(prog.error || 'Simulation encountered a server error.');
        }
      } catch (_) { /* swallow transient network errors */ }
    }, 800);

    return () => {
      clearInterval(pollRef.current);
      // Abort any in-flight consequence fetch on unmount or dep change.
      if (consequenceAbortRef.current) consequenceAbortRef.current.abort();
    };
  }, [simulationId, loading, pushNewSteps]);

  // ── Run handler ───────────────────────────────────────────────────────────
  // Fix 3: no inline result ingest. POST returns only simulation_id + status='started'.
  // The polling loop drives all data — handleRun just fires and forgets.
  const handleRun = async () => {
    setError('');
    clearCharts();              // V3: reset cursor + wipe chart data
    setProgress({ status: 'idle', steps_done: 0, total_steps: 0, pct: 0 });
    setInterpretedParams({});
    setMeanByStep(null);        // V5: unmount old ConsequencePanel
    setConsequenceResult(null);  // V8: reset consequence
    setConsequenceError('');
    setConsequenceLoading(false);
    setLoading(true);
    setRunScenario(scenario);
    setSimulationId(null);      // clear old ID so polling useEffect re-fires

    try {
      const data = await runABMSimulation(n, scenario, steps, 1);
      // Fix 3: backend now returns { simulation_id, status: 'started' } — no results key.
      // If somehow results ARE included (fast/legacy run), we ignore them here.
      // Polling always drives chart updates.
      setSimulationId(data.simulation_id);
      setInterpretedParams(data.interpreted_params || {});
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to start simulation.');
      toast.error(err.message || 'Failed to start simulation.');
    }
  };

  return (
    <SimulationLayout
      title="Policy Simulation Lab"
      subtitle="Watch 4 outcome dimensions ripple in real time as your policy runs step by step."
    >

      {/* ── Mode toggle pill ───────────── */}
      <div style={{ display: 'inline-flex', background: '#f3f4f6', borderRadius: '99px', padding: '3px', marginBottom: '1.5rem', gap: '2px' }}>
        {[['single', '◎  Single scenario'], ['compare', '⚡  Compare two scenarios'], ['optimizer', '💡  Resource optimizer']].map(([m, lbl]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '0.35rem 1.1rem', borderRadius: '99px', border: 'none', cursor: 'pointer',
              fontSize: '0.82rem', fontWeight: 600,
              background: mode === m ? 'white' : 'transparent',
              color: mode === m ? 'var(--primary-color)' : '#6b7280',
              boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
              transition: 'all 0.15s',
            }}
          >{lbl}</button>
        ))}
      </div>

      {/* ── Config card ────────────────── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        {/* Shared inputs — visible in both modes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Number of Agents (N)</label>
            <input id="sim-n-agents" type="number" min={10} max={500} value={n}
              onChange={e => setN(Math.max(10, parseInt(e.target.value, 10) || 10))}
              className="form-input" />
            <small style={{ color: '#9ca3af' }}>Worker agents in the model</small>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Simulation Steps</label>
            <input id="sim-steps" type="number" min={5} max={200} value={steps}
              onChange={e => setSteps(Math.max(5, parseInt(e.target.value, 10) || 5))}
              className="form-input" />
            <small style={{ color: '#9ca3af' }}>Each step ≈ one quarter of a year · ~300ms per step</small>
          </div>
        </div>

        {/* Single-mode-only: scenario description + run button */}
        {mode === 'single' && (
          <>
            <div className="form-group" style={{ marginBottom: 0, marginTop: '1.25rem' }}>
              <label className="form-label">Scenario Description</label>
              <textarea id="sim-scenario" value={scenario}
                onChange={e => setScenario(e.target.value)} className="form-input"
                placeholder="e.g. 'Invest heavily in infrastructure and green energy to boost jobs'"
                rows={3} style={{ resize: 'vertical' }} />
              <small style={{ color: '#9ca3af' }}>
                Keywords: <em>infrastructure</em>, <em>green</em>, <em>training</em>, <em>subsidy</em>, <em>jobs</em>
              </small>
            </div>

            {error && (
              <div style={{ marginTop: '1rem' }}>
                <ErrorCard message={error} onRetry={handleRun} />
              </div>
            )}

            <button id="sim-run-btn" onClick={handleRun}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '1.25rem', height: '48px' }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
                    <span className="spinner" style={{ width: '18px', height: '18px', borderTopColor: 'white' }} />
                    Simulating… step {progress.steps_done} / {progress.total_steps || steps}
                  </span>
                : '▶ Run Simulation'}
            </button>
          </>
        )}
      </div>

      {/* ── Compare mode ──────────────── */}
      {mode === 'compare' && (
        <SimulationCompare key="compare" n={n} steps={steps} />
      )}

      {/* ── Optimizer mode ────────────── */}
      {mode === 'optimizer' && (
        <div className="card">
          <h3 style={{ margin: '0 0 0.25rem', color: 'var(--primary-color)', fontSize: '1.1rem' }}>Resource Allocation Optimizer</h3>
          <p style={{ margin: '0 0 1.25rem', color: '#6b7280', fontSize: '0.875rem' }}>
            Auto-generate 6 budget allocation variants, simulate all in parallel, and rank by your priority weights.
          </p>
          <ResourceOptimizer n={n} steps={steps} />
        </div>
      )}

      {/* ── Single mode empty state ────── */}
      {mode === 'single' && !isActive && (
        <EmptyState
          title="No simulation run yet"
          message="Set your parameters above and run the simulation to see results."
        />
      )}

      {/* ── Single mode Live Dashboard ─── */}
      {mode === 'single' && isActive && (
        <div>
          {/* 1 — Status bar */}
          <StatusBar scenario={runScenario} progress={progress} simulationId={simulationId} />

          {/* AI params panel */}
          <InterpretedParamsPanel params={interpretedParams} />

          {/* 2 — Metric cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.9rem', marginBottom: '1rem' }}>
            {METRICS.map((m, i) => (
              <MetricCard
                key={m.key}
                metric={m}
                value={metricValues[i]}
                prevValue={prevValues[i]}
                isLive={loading}
              />
            ))}
          </div>

          {/* 3 — 2×2 chart grid — refs passed so pushNewSteps can update imperatively */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem' }}>
            {METRICS.map((m, i) => (
              <LiveChart
                key={m.key}
                metric={m}
                chartRef={chartRefs.current[i]}
              />
            ))}
          </div>

          {/* Analysis — after complete */}
          {progress.status === 'complete' && metricValues[0] != null && (
            <div style={{ marginTop: '1.25rem', background: '#f0f9ff', borderLeft: '4px solid var(--primary-color)', borderRadius: '0 0.5rem 0.5rem 0', padding: '1rem 1.25rem' }}>
              <h5 style={{ margin: '0 0 0.4rem', color: 'var(--primary-dark)' }}>Analysis</h5>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.65, color: '#374151' }}>
                {(() => {
                  const emp = metricValues[0];
                  const wel = metricValues[1];
                  const inf = metricValues[2];
                  const env = metricValues[3];
                  let msg = `After ${progress.total_steps} steps: employment is ${emp != null ? `${(emp * 100).toFixed(1)}%` : 'unknown'}`;
                  if (emp > 0.85)      msg += ' — strong labour market.';
                  else if (emp < 0.70) msg += ' — high unemployment persists.';
                  else                 msg += ' — moderate labour market.';
                  if (inf != null) msg += ` Infrastructure score: ${inf.toFixed(1)}/100.`;
                  if (env != null) msg += ` Environmental score: ${env.toFixed(1)}/100.`;
                  if (wel != null) msg += ` Welfare index: ${wel.toFixed(3)}.`;
                  return msg;
                })()}
              </p>
            </div>
          )}

          {/* V8: ConsequencePanel — result is fetched in parent, passed as props */}
          {progress.status === 'complete' && meanByStep !== null && (
            <ConsequencePanel
              scenario={runScenario}
              loading={consequenceLoading}
              result={consequenceResult}
              error={consequenceError}
            />
          )}

          {/* Report exporter — appears after consequence analysis is ready */}
          {progress.status === 'complete' && meanByStep !== null && consequenceResult !== null && (
            <ReportExporter
              scenario={runScenario}
              nAgents={n}
              nSteps={progress.total_steps}
              meanByStep={meanByStep}
              consequence={consequenceResult}
            />
          )}
        </div>
      )}

      {/* ── History ────────────────────── */}
      <div className="card" style={{ marginTop: '2rem' }}>
        <HistoryPanel history={history} onReload={loadHistory} />
      </div>
    </SimulationLayout>
  );
};

export default Simulation;
