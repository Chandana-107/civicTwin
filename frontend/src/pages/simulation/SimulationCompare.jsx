/**
 * SimulationCompare.jsx
 * Side-by-side scenario comparison mode.
 * Fires two independent ABM runs, streams both onto the same 4 charts.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  runABMSimulation, getABMProgress, fetchStepResults,
} from '../../services/simulationApi';
import ConsequencePanel from './ConsequencePanel';
import ReportExporter from './ReportExporter';
import ErrorCard from './ErrorCard';


// Simulation service base URL — reads from .env, fallback to 8003
const SIM_API = import.meta.env.VITE_SIMULATION_API_URL || 'http://127.0.0.1:8003';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Filler);
ChartJS.defaults.animation   = false;
ChartJS.defaults.animations  = {};
ChartJS.defaults.transitions = {};

// ── Palette ────────────────────────────────────────────────────────────────────
const COLOR_A = '#378ADD';
const COLOR_B = '#D85A30';

// ── Metrics ───────────────────────────────────────────────────────────────────
const METRICS = [
  { key: 'employment_rate', label: 'Employment Rate',  color: '#378ADD', fmt: v => v != null ? `${(v*100).toFixed(1)}%`  : '—', derive: (m,i) => m.unemployment_rate?.[i] != null ? 1 - m.unemployment_rate[i] : null, threshold: 0.03,  unit: 'pp', scaleY: v => v != null ? v * 100 : null },
  { key: 'welfare_index',   label: 'Welfare Index',    color: '#1D9E75', fmt: v => v != null ? v.toFixed(3)               : '—', derive: (m,i) => m.avg_welfare?.[i]          ?? null,                                    threshold: 0.05,  unit: '',   scaleY: v => v },
  { key: 'infrastructure',  label: 'Infrastructure',   color: '#BA7517', fmt: v => v != null ? v.toFixed(1)               : '—', derive: (m,i) => m.infrastructure_score?.[i] ?? null,                                    threshold: 5,     unit: '',   scaleY: v => v },
  { key: 'environment',     label: 'Env Score',        color: '#639922', fmt: v => v != null ? v.toFixed(1)               : '—', derive: (m,i) => m.env_score?.[i]            ?? null,                                    threshold: 5,     unit: '',   scaleY: v => v },
];

function makeCompareOptions() {
  return {
    responsive: true, maintainAspectRatio: false,
    animation: false, animations: {}, transitions: {},
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: {
      x: { display: false },
      y: { display: true, border: { display: false }, grid: { color: '#f0f0f0', drawTicks: false },
           ticks: { maxTicksLimit: 4, color: '#9ca3af', font: { size: 10 }, padding: 4 } },
    },
  };
}

function makeCompareData() {
  return {
    labels: [],
    datasets: [
      { label: 'A', data: [], borderColor: COLOR_A, backgroundColor: COLOR_A + '10', fill: false,
        borderWidth: 1.5, borderDash: [], pointRadius: 0, tension: 0.35 },
      { label: 'B', data: [], borderColor: COLOR_B, backgroundColor: COLOR_B + '10', fill: false,
        borderWidth: 1.5, borderDash: [4, 3], pointRadius: 0, tension: 0.35 },
    ],
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScenarioCard({ label, color, value, onChange, disabled }) {
  return (
    <div className="sim-card sim-card-interactive" style={{ borderLeft: `3px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '1.25rem 1.25rem 0' }}>
        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#374151' }}>{label}</span>
      </div>
      <div style={{ padding: '0 1.25rem 1.25rem' }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          disabled={disabled}
          className="form-input"
          placeholder="Describe your policy scenario…"
          rows={4}
          style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
        />
      </div>
    </div>
  );
}

function SimBadge({ label, color, prog }) {
  const isComplete = prog?.status === 'complete';
  const isRunning  = prog?.status === 'running';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
      padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.75rem', fontWeight: 700,
      background: isComplete ? '#d1fae5' : isRunning ? '#dbeafe' : '#f3f4f6',
      color:      isComplete ? '#065f46'  : isRunning ? '#1d4ed8'  : '#6b7280',
      border: `1px solid ${color}30`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {label}: {isComplete ? 'Done' : isRunning ? `step ${prog.steps_done}/${prog.total_steps}` : '—'}
    </span>
  );
}

function CompareChart({ metric, chartRef }) {
  const opts    = useRef(makeCompareOptions());
  const initDat = useRef(makeCompareData());
  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {metric.label}
        </span>
        {/* Inline legend */}
        <span style={{ display: 'flex', gap: '0.75rem', fontSize: '0.7rem', color: '#6b7280' }}>
          <span style={{ color: COLOR_A, fontWeight: 600 }}>● A</span>
          <span style={{ color: COLOR_B, fontWeight: 600, fontStyle: 'italic' }}>– – B</span>
        </span>
      </div>
      <div style={{ height: '130px' }}>
        <Line ref={chartRef} data={initDat.current} options={opts.current} />
      </div>
    </div>
  );
}

function DivergenceBadge({ gap, step, threshold, unit }) {
  if (gap == null || gap <= threshold) return null;
  const display = unit === 'pp' ? `${(gap*100).toFixed(1)}pp` : gap.toFixed(2);
  return (
    <span style={{ display: 'inline-block', marginLeft: '0.5rem', padding: '0.1rem 0.5rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '99px', fontSize: '0.65rem', fontWeight: 700, color: '#dc2626' }}>
      +{display} gap @ step {step + 1}
    </span>
  );
}

function WinnerCard({ metric, finalA, finalB }) {
  if (finalA == null || finalB == null) {
    return (
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem' }}>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>{metric.label}</div>
        <div style={{ color: '#d1d5db', fontSize: '1.2rem', fontWeight: 700 }}>—</div>
      </div>
    );
  }
  const higher = finalA >= finalB;
  const delta  = Math.abs(finalA - finalB);
  const deltaStr = metric.key === 'employment_rate' ? `${(delta*100).toFixed(2)}pp` : delta.toFixed(metric.threshold < 1 ? 4 : 2);
  const winner = higher ? 'A' : 'B';
  const winColor = higher ? COLOR_A : COLOR_B;

  return (
    <div style={{ background: 'white', border: '1px solid #e5e7eb', borderTop: `3px solid ${winColor}`, borderRadius: '0.75rem', padding: '1rem' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>{metric.label}</div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
        <span style={{ fontWeight: 700, color: COLOR_A }}>{metric.fmt(finalA)}</span>
        <span style={{ color: '#9ca3af' }}>vs</span>
        <span style={{ fontWeight: 700, color: COLOR_B }}>{metric.fmt(finalB)}</span>
      </div>
      <div style={{ fontSize: '0.78rem', fontWeight: 600, color: winColor }}>
        Scenario {winner} leads +{deltaStr}
      </div>
    </div>
  );
}

// ── Main Compare Component ────────────────────────────────────────────────────
const SimulationCompare = ({ n, steps }) => {
  const [scenarioA, setScenarioA] = useState('');
  const [scenarioB, setScenarioB] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  // Per-sim progress
  const [progA, setProgA] = useState(null);
  const [progB, setProgB] = useState(null);

  // Final values for winner cards: [empA, welA, infA, envA]
  const [finalA, setFinalA] = useState(METRICS.map(() => null));
  const [finalB, setFinalB] = useState(METRICS.map(() => null));

  // V6: raw mean_by_step for each sim (drives ConsequencePanel)
  const [mbsA, setMbsA] = useState(null);
  const [mbsB, setMbsB] = useState(null);

  // V8: consequence results owned by parent (avoids child mount/unmount race)
  const [consResultA,  setConsResultA]  = useState(null);
  const [consResultB,  setConsResultB]  = useState(null);
  const [consLoadingA, setConsLoadingA] = useState(false);
  const [consLoadingB, setConsLoadingB] = useState(false);
  const [consErrorA,   setConsErrorA]   = useState('');
  const [consErrorB,   setConsErrorB]   = useState('');

  // Abort controllers for consequence fetches
  const consAbortRefA = useRef(null);
  const consAbortRefB = useRef(null);

  // Divergence per metric: { gap, step }
  const [diverg, setDiverg] = useState(METRICS.map(() => null));

  // V3: separate rendered-step counters (not shared)
  const renderedA = useRef(0);
  const renderedB = useRef(0);

  // Chart refs — one per metric
  const chartRefs = useRef(METRICS.map(() => React.createRef()));

  // Accumulated series for divergence calculation
  const seriesA = useRef(METRICS.map(() => []));
  const seriesB = useRef(METRICS.map(() => []));

  // Two independent interval refs — A and B never share a clearInterval call
  const pollRefA = useRef(null);
  const pollRefB = useRef(null);
  const simIdA   = useRef(null);
  const simIdB   = useRef(null);
  const doneA    = useRef(false);
  const doneB    = useRef(false);

  // Clear all chart data imperatively
  const clearCharts = useCallback(() => {
    chartRefs.current.forEach(ref => {
      const c = ref?.current;
      if (!c) return;
      c.data.labels = [];
      c.data.datasets[0].data = [];
      c.data.datasets[1].data = [];
      c.update('none');
    });
    renderedA.current = 0;
    renderedB.current = 0;
    seriesA.current = METRICS.map(() => []);
    seriesB.current = METRICS.map(() => []);
  }, []);

  // Push new steps for one sim onto dataset index (0=A, 1=B)
  const pushSteps = useCallback((mbs, stepsNow, dsIdx, renderedRef, seriesRef) => {
    const from = renderedRef.current;
    if (!mbs || stepsNow <= from) return;

    METRICS.forEach((metric, mi) => {
      const chart = chartRefs.current[mi]?.current;
      if (!chart) return;

      for (let i = from; i < stepsNow; i++) {
        const raw = metric.derive(mbs, i);
        const val = metric.scaleY(raw);
        // Only push label on dataset 0 (avoids duplicate labels)
        if (dsIdx === 0) chart.data.labels.push(String(i + 1));
        chart.data.datasets[dsIdx].data.push(val);
        // Accumulate for divergence
        if (seriesRef.current[mi].length <= i) seriesRef.current[mi][i] = val;
      }
      chart.update('none');
    });

    renderedRef.current = stepsNow;
  }, []);

  // Compute divergence after both complete
  const computeDivergence = useCallback(() => {
    const result = METRICS.map((_metric, mi) => {
      const a = seriesA.current[mi];
      const b = seriesB.current[mi];
      const len = Math.min(a.length, b.length);
      if (len === 0) return null;
      let maxGap = 0, maxStep = 0;
      for (let i = 0; i < len; i++) {
        const gap = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
        if (gap > maxGap) { maxGap = gap; maxStep = i; }
      }
      return { gap: maxGap, step: maxStep };
    });
    setDiverg(result);
  }, []);

  // ── Polling ────────────────────────────────────────────────────────────
  // Each sim gets its own independent interval stored in its own ref.
  // An error or completion in A never touches pollRefB and vice versa.

  // Helper: check if both sims are done and fire shared post-run logic once.
  const checkBothDone = useCallback(() => {
    if (doneA.current && doneB.current) {
      setLoading(false);
      computeDivergence();
      toast.success('Comparison complete!');
    }
  }, [computeDivergence]);

  const startPolling = useCallback(() => {
    // ── Sim A interval ────────────────────────────────────────────────────
    clearInterval(pollRefA.current);
    pollRefA.current = setInterval(async () => {
      try {
        if (doneA.current) return;
        const pA = await getABMProgress(simIdA.current);
        setProgA(pA);

        if (pA.steps_done > renderedA.current) {
          const raw = await fetchStepResults(simIdA.current);
          const mbs = raw?.results?.mean_by_step || raw?.mean_by_step;
          if (mbs) pushSteps(mbs, pA.steps_done, 0, renderedA, seriesA);
        }

        if (pA.status === 'complete') {
          clearInterval(pollRefA.current);
          pollRefA.current = null;
          doneA.current = true;
          const raw = await fetchStepResults(simIdA.current);
          const mbs = raw?.results?.mean_by_step || raw?.mean_by_step;
          if (mbs) {
            pushSteps(mbs, pA.total_steps, 0, renderedA, seriesA);
            setFinalA(METRICS.map(m => m.derive(mbs, pA.total_steps - 1)));
            setMbsA(mbs);
            setConsLoadingA(true); setConsErrorA('');
            
            if (consAbortRefA.current) consAbortRefA.current.abort();
            const controllerA = new AbortController();
            consAbortRefA.current = controllerA;
            const timerA = setTimeout(() => controllerA.abort(), 25_000);

            fetch(`${SIM_API}/analyse/consequences`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              signal: controllerA.signal,
              body: JSON.stringify({ scenario: scenarioA, n_steps: pA.total_steps, n_agents: n, mean_by_step: mbs }),
            })
              .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
              .then(d => { setConsResultA(d); setConsLoadingA(false); })
              .catch(e => {
                if (e?.name === 'AbortError') setConsErrorA('Analysis timed out — try again');
                else setConsErrorA(String(e));
                setConsLoadingA(false);
              })
              .finally(() => clearTimeout(timerA));
          }
          checkBothDone();
        } else if (pA.status === 'error') {
          // Stop A's interval only — B continues unaffected
          clearInterval(pollRefA.current);
          pollRefA.current = null;
          doneA.current = true;
          setProgA(prev => ({ ...prev, status: 'error' }));
          checkBothDone();
        }
      } catch (_) { /* swallow transient network error, keep polling */ }
    }, 800);

    // ── Sim B interval ────────────────────────────────────────────────────
    clearInterval(pollRefB.current);
    pollRefB.current = setInterval(async () => {
      try {
        if (doneB.current) return;
        const pB = await getABMProgress(simIdB.current);
        setProgB(pB);

        if (pB.steps_done > renderedB.current) {
          const raw = await fetchStepResults(simIdB.current);
          const mbs = raw?.results?.mean_by_step || raw?.mean_by_step;
          if (mbs) pushSteps(mbs, pB.steps_done, 1, renderedB, seriesB);
        }

        if (pB.status === 'complete') {
          clearInterval(pollRefB.current);
          pollRefB.current = null;
          doneB.current = true;
          const raw = await fetchStepResults(simIdB.current);
          const mbs = raw?.results?.mean_by_step || raw?.mean_by_step;
          if (mbs) {
            pushSteps(mbs, pB.total_steps, 1, renderedB, seriesB);
            setFinalB(METRICS.map(m => m.derive(mbs, pB.total_steps - 1)));
            setMbsB(mbs);
            setConsLoadingB(true); setConsErrorB('');
            
            if (consAbortRefB.current) consAbortRefB.current.abort();
            const controllerB = new AbortController();
            consAbortRefB.current = controllerB;
            const timerB = setTimeout(() => controllerB.abort(), 25_000);

            fetch(`${SIM_API}/analyse/consequences`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              signal: controllerB.signal,
              body: JSON.stringify({ scenario: scenarioB, n_steps: pB.total_steps, n_agents: n, mean_by_step: mbs }),
            })
              .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
              .then(d => { setConsResultB(d); setConsLoadingB(false); })
              .catch(e => {
                if (e?.name === 'AbortError') setConsErrorB('Analysis timed out — try again');
                else setConsErrorB(String(e));
                setConsLoadingB(false);
              })
              .finally(() => clearTimeout(timerB));
          }
          checkBothDone();
        } else if (pB.status === 'error') {
          // Stop B's interval only — A continues unaffected
          clearInterval(pollRefB.current);
          pollRefB.current = null;
          doneB.current = true;
          setProgB(prev => ({ ...prev, status: 'error' }));
          checkBothDone();
        }
      } catch (_) { /* swallow transient network error, keep polling */ }
    }, 800);
  }, [pushSteps, checkBothDone]);

  // Unmount-only cleanup for consequence AbortControllers
  useEffect(() => {
    return () => {
      if (consAbortRefA.current) consAbortRefA.current.abort();
      if (consAbortRefB.current) consAbortRefB.current.abort();
    };
  }, []);

  // ── Run comparison ────────────────────────────────────────────────────────
  const handleCompare = async () => {
    setError('');
    clearCharts();
    setProgA(null);
    setProgB(null);
    setFinalA(METRICS.map(() => null));
    setFinalB(METRICS.map(() => null));
    setDiverg(METRICS.map(() => null));
    setMbsA(null);
    setMbsB(null);
    setConsResultA(null);  setConsResultB(null);
    setConsLoadingA(false); setConsLoadingB(false);
    setConsErrorA('');     setConsErrorB('');
    doneA.current = false;
    doneB.current = false;
    setLoading(true);

    try {
      // V1: fire BOTH requests with Promise.all — not sequentially awaited
      const [dataA, dataB] = await Promise.all([
        runABMSimulation(n, scenarioA, steps, 1),
        runABMSimulation(n, scenarioB, steps, 1),
      ]);
      simIdA.current = dataA.simulation_id;
      simIdB.current = dataB.simulation_id;
      startPolling();
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Failed to start comparison.');
      toast.error(err.message || 'Failed to start comparison.');
    }
  };

  // Cleanup on unmount — both refs cleared independently
  useEffect(() => () => {
    clearInterval(pollRefA.current);
    clearInterval(pollRefB.current);
  }, []);

  const bothDone = doneA.current && doneB.current;

  return (
    <div>
      {/* ── Scenario cards ────────────────────────────────────────────────── */}
      <div className="sim-compare-grid">
        <ScenarioCard label="Scenario A" color={COLOR_A} value={scenarioA} onChange={setScenarioA} disabled={loading} />
        {/* Mobile-only divider between A and B */}
        <div className="sim-compare-divider" aria-hidden="true">Scenario B</div>
        <ScenarioCard label="Scenario B" color={COLOR_B} value={scenarioB} onChange={setScenarioB} disabled={loading} />
      </div>

      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <ErrorCard message={error} onRetry={handleCompare} />
        </div>
      )}

      <button
        id="sim-compare-btn"
        onClick={handleCompare}
        disabled={loading}
        className="btn btn-primary"
        style={{ width: '100%', height: '48px', marginBottom: '1.5rem' }}
      >
        {loading
          ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
              <span className="spinner" style={{ width: '18px', height: '18px', borderTopColor: 'white' }} />
              Running comparison…
            </span>
          : '⚡ Run Comparison'}
      </button>

      {/* ── Live dashboard ─────────────────────────────────────────────────── */}
      {(loading || bothDone) && (
        <div>
          {/* Status bar */}
          <div className="sim-card" style={{ padding: '0.9rem 1.25rem', marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280', marginRight: '0.25rem' }}>Progress:</span>
            <SimBadge label="A" color={COLOR_A} prog={progA} />
            <SimBadge label="B" color={COLOR_B} prog={progB} />
          </div>

          {/* 2×2 chart grid with divergence badges */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.9rem', marginBottom: '1rem' }}>
            {METRICS.map((m, i) => (
              <div key={m.key}>
                {/* Divergence badge above chart */}
                {diverg[i] && (
                  <div style={{ marginBottom: '0.25rem' }}>
                    <DivergenceBadge
                      gap={diverg[i].gap}
                      step={diverg[i].step}
                      threshold={m.threshold}
                      unit={m.key === 'employment_rate' ? 'pp' : ''}
                    />
                  </div>
                )}
                <CompareChart metric={m} chartRef={chartRefs.current[i]} />
              </div>
            ))}
          </div>

          {/* Winner summary (§6) */}
          {(loading || bothDone) && (
            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 0.75rem' }}>
                Final Comparison
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                {METRICS.map((m, i) => (
                  <WinnerCard
                    key={m.key}
                    metric={m}
                    finalA={finalA[i]}
                    finalB={finalB[i]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* V8: Two ConsequencePanels — pure display, results from parent state */}
          {(mbsA || mbsB) && (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '12px', marginTop: '1.25rem' }}>
              <ConsequencePanel
                scenario={scenarioA}
                loading={consLoadingA}
                result={consResultA}
                error={consErrorA}
                narrow
              />
              <ConsequencePanel
                scenario={scenarioB}
                loading={consLoadingB}
                result={consResultB}
                error={consErrorB}
                narrow
              />
            </div>
          )}

          {/* Report exporters — each independently gated on its own consequence result */}
          {(mbsA && consResultA) || (mbsB && consResultB) ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '12px', marginTop: '0.75rem' }}>
              <div>
                {mbsA && consResultA && (
                  <ReportExporter
                    scenario={scenarioA}
                    nAgents={n}
                    nSteps={steps}
                    meanByStep={mbsA}
                    consequence={consResultA}
                    scenarioLabel="Scenario A report"
                  />
                )}
              </div>
              <div>
                {mbsB && consResultB && (
                  <ReportExporter
                    scenario={scenarioB}
                    nAgents={n}
                    nSteps={steps}
                    meanByStep={mbsB}
                    consequence={consResultB}
                    scenarioLabel="Scenario B report"
                  />
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default SimulationCompare;
