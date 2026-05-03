/**
 * ResourceOptimizer.jsx
 *
 * Resource Allocation Optimizer — generates 6 scenario variants from a
 * budget + policy focus, simulates each via /abm/simulate, ranks by
 * user-defined priority weights, and surfaces the top pick with a
 * ReportExporter for one-click PDF/markdown export.
 *
 * Props: n (agents), steps — shared with parent Simulation.jsx
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { runABMSimulation, getABMProgress, fetchStepResults } from '../../services/simulationApi';
import ReportExporter from './ReportExporter';
import ErrorCard from './ErrorCard';

const SIM_API = import.meta.env.VITE_SIMULATION_API_URL || 'http://127.0.0.1:8003';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  primary:    '#1E3150',
  accent:     '#378ADD',
  green:      '#1D9E75',
  amber:      '#BA7517',
  red:        '#E24B4A',
  border:     '#e5e7eb',
  bg:         '#f9fafb',
  text:       '#111827',
  sub:        '#6b7280',
  card:       '#ffffff',
  recommended:'#fffbeb',
  recBorder:  '#BA7517',
};

// ─── Variant definitions ──────────────────────────────────────────────────────
// 6 allocation splits: [ infraPct, eduPct, greenPct ] always sum to 100
const SPLITS = [
  { name: 'Infrastructure-heavy',  ratio: [80, 10, 10] },
  { name: 'Infrastructure-led',    ratio: [60, 25, 15] },
  { name: 'Balanced investment',   ratio: [40, 40, 20] },
  { name: 'Education & welfare',   ratio: [20, 60, 20] },
  { name: 'Green transition',      ratio: [20, 20, 60] },
  { name: 'Equal distribution',    ratio: [33, 34, 33] },
];

const FOCUS_KEYWORDS = {
  'Infrastructure and jobs':  ['infrastructure', 'roads', 'transport', 'jobs', 'stimulus'],
  'Education and welfare':    ['education', 'training', 'welfare', 'subsidy', 'healthcare'],
  'Green development':        ['renewable', 'solar', 'green', 'sustainability', 'carbon'],
  'Balanced growth':          ['invest', 'infrastructure', 'education', 'green', 'balanced'],
};

function buildScenarioString(focus, budget, split, splitDef) {
  const [infraPct, eduPct, greenPct] = split;
  const infraCrore = Math.round(budget * infraPct / 100);
  const eduCrore   = Math.round(budget * eduPct  / 100);
  const greenCrore = Math.round(budget * greenPct / 100);
  const focusKws   = FOCUS_KEYWORDS[focus] || [];
  const baseKw     = focusKws.join(', ');
  return (
    `Government allocates ₹${budget} crore total: ₹${infraCrore} crore to infrastructure and ${baseKw}, ` +
    `₹${eduCrore} crore to education and welfare training subsidy, ` +
    `₹${greenCrore} crore to green renewable energy sustainability. ` +
    `Policy focus: ${focus.toLowerCase()}. stimulus invest spending.`
  );
}

// ─── Metric extraction ────────────────────────────────────────────────────────
function extractDeltas(mbs) {
  const unemp = mbs?.unemployment_rate || [];
  const welf  = mbs?.avg_welfare       || [];
  const infra = mbs?.infrastructure_score || [];
  const env   = mbs?.env_score         || [];
  const first = (a) => a.length ? a[0] : 0;
  const last  = (a) => a.length ? a[a.length - 1] : 0;
  return {
    empDelta:  (1 - last(unemp)) * 100 - (1 - first(unemp)) * 100,
    welDelta:  last(welf)  - first(welf),
    infDelta:  last(infra) - first(infra),
    envDelta:  last(env)   - first(env),
    empStart:  (1 - first(unemp)) * 100,
    empFinal:  (1 - last(unemp))  * 100,
    welStart:  first(welf),  welFinal: last(welf),
    infStart:  first(infra), infFinal: last(infra),
    envStart:  first(env),   envFinal: last(env),
  };
}

// ─── Composite score ──────────────────────────────────────────────────────────
// Normalisation rationale (empirical ranges, 120 agents, 20 steps):
//
//   empDelta  — already in percentage points          → typical range  10–22 pp
//   welDelta  — raw 0–1 index delta, × 200            → typical range  19–43 pp
//               (× 100 gave 9–21 pp — welfare was structurally half the scale
//                of infra/env, so × 200 corrects the imbalance)
//   infDelta  — 0–100 score delta, unscaled           → typical range -12 to +17 pp
//   envDelta  — 0–100 score delta, unscaled           → typical range  -7 to  +8 pp
//
// All four normalised values now sit in a broadly comparable range so the
// user's weight sliders (employment/welfare/infra/env %) are the primary
// determinant of variant ranking rather than raw metric scale differences.
function compositeScore(deltas, weights) {
  const empNorm = deltas.empDelta;           // pp — no rescaling needed
  const welNorm = deltas.welDelta * 200;     // 0-1 index → comparable pp scale
  const infNorm = deltas.infDelta;           // 0-100 score — comparable to emp pp
  const envNorm = deltas.envDelta;           // 0-100 score — comparable to emp pp

  const w = weights;
  return (
    (empNorm * w.employment +
     welNorm * w.welfare    +
     infNorm * w.infrastructure +
     envNorm * w.environment) / 100
  );
}

// ─── Small sub-components ─────────────────────────────────────────────────────
function WeightSlider({ label, color, value, onChange, disabled }) {
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: color }}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        disabled={disabled}
        style={{ width: '100%', accentColor: color, cursor: disabled ? 'not-allowed' : 'pointer' }}
      />
    </div>
  );
}

function DeltaTag({ label, value, unit = '', decimals = 1 }) {
  const positive = value >= 0;
  const bg    = positive ? '#E1F5EE' : '#FCEBEB';
  const color = positive ? '#085041' : '#A32D2D';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
      padding: '0.15rem 0.45rem', borderRadius: 6, fontSize: 11, fontWeight: 700,
      background: bg, color, margin: '0.15rem 0.2rem 0.15rem 0',
    }}>
      {positive ? '+' : ''}{value.toFixed(decimals)}{unit} {label}
    </span>
  );
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 4, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden', margin: '0.5rem 0' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
    </div>
  );
}

function VariantCard({ variant, rank, weights, budget, steps, n, isTop }) {
  const [exporting, setExporting] = useState(false);
  const [consResult, setConsResult] = useState(null);
  const [consLoading, setConsLoading] = useState(false);

  const handleFetchConsequence = () => {
    if (consResult || consLoading) return;
    setConsLoading(true);
    fetch(`${SIM_API}/analyse/consequences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenario:     variant.scenario,
        n_steps:      steps,
        n_agents:     n,
        mean_by_step: variant.mbs,
      }),
    })
      .then(r => r.ok ? r.json() : Promise.reject(`HTTP ${r.status}`))
      .then(d => setConsResult(d))
      .catch(() => setConsResult(null))
      .finally(() => setConsLoading(false));
  };

  const d = variant.deltas;
  const score = variant.score.toFixed(1);
  const [infraPct, eduPct, greenPct] = variant.split;
  const borderStyle = isTop
    ? '2px solid var(--success-color)'
    : `1px solid ${C.border}`;
  const bgStyle = isTop ? '#f0fdf4' : C.card;

  return (
    <div style={{
      border: borderStyle, borderRadius: 12, padding: '1rem 1.25rem',
      background: bgStyle, marginBottom: '0.85rem', position: 'relative',
      boxShadow: isTop ? '0 2px 12px rgba(5,150,105,0.12)' : '0 1px 3px rgba(0,0,0,0.06)',
      transition: 'box-shadow 200ms ease, border-color 200ms ease',
    }}>
      {/* Rank + recommended badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center',
            background: isTop ? 'var(--success-color)' : '#e5e7eb',
            color: isTop ? 'white' : '#6b7280', fontWeight: 800, fontSize: '0.8125rem',
          }}>#{rank}</span>
          <span style={{ fontWeight: 700, fontSize: '0.875rem', color: C.text }}>{variant.name}</span>
          {isTop && (
            <span className="sim-recommended-badge">★ Recommended</span>
          )}
        </div>
        <span style={{
          fontSize: '1.375rem', fontWeight: 800,
          color: isTop ? 'var(--success-color)' : C.primary,
        }}>{score}</span>
      </div>

      {/* Allocation summary */}
      <p style={{ fontSize: 12, color: C.sub, margin: '0 0 0.5rem' }}>
        ₹{budget} crore · {infraPct}% infra, {eduPct}% education, {greenPct}% green · {steps} steps · {n} agents
      </p>

      {/* Delta tags */}
      <div style={{ display: 'flex', flexWrap: 'wrap' }}>
        <DeltaTag label="Employment" value={d.empDelta} unit="pp" decimals={1} />
        <DeltaTag label="Welfare"    value={d.welDelta} decimals={3} />
        <DeltaTag label="Infra"      value={d.infDelta} decimals={1} />
        <DeltaTag label="Env"        value={d.envDelta} decimals={1} />
      </div>

      {/* Export row (top variant only, lazy-loads consequence) */}
      {isTop && (
        <div style={{ marginTop: '0.75rem' }}>
          {!consResult && !consLoading && (
            <button
              onClick={handleFetchConsequence}
              style={{
                padding: '0.35rem 0.85rem', fontSize: 12, fontWeight: 600,
                border: `1px solid ${C.recBorder}`, borderRadius: 8,
                background: 'white', color: C.recBorder, cursor: 'pointer',
              }}
            >
              🔍 Load AI analysis for export
            </button>
          )}
          {consLoading && (
            <span style={{ fontSize: 12, color: C.sub }}>⏳ Fetching AI analysis…</span>
          )}
          {consResult && (
            <ReportExporter
              scenario={variant.scenario}
              nAgents={n}
              nSteps={steps}
              meanByStep={variant.mbs}
              consequence={consResult}
              scenarioLabel={`Optimizer top pick — ${variant.name}`}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
const ResourceOptimizer = ({ n, steps }) => {
  // Input state
  const [budget,    setBudget]    = useState(500);
  const [focus,     setFocus]     = useState('Infrastructure and jobs');
  const [weights,   setWeights]   = useState({
    employment: 35, welfare: 25, infrastructure: 25, environment: 15,
  });

  // Optimizer run state
  const [running,   setRunning]   = useState(false);
  const [variants,  setVariants]  = useState([]);   // ranked results
  const [progress,  setProgress]  = useState([]);   // per-variant progress text
  const [error,     setError]     = useState('');

  const pollRefs = useRef([]);

  // Clamp all weights so they sum to 100 when one slider moves
  const handleWeightChange = (key, val) => {
    setWeights(prev => {
      const others = Object.keys(prev).filter(k => k !== key);
      const remaining = 100 - val;
      const otherSum  = others.reduce((s, k) => s + prev[k], 0);
      const scale     = otherSum > 0 ? remaining / otherSum : 1 / others.length;
      const next = { ...prev, [key]: val };
      others.forEach(k => {
        next[k] = Math.max(0, Math.round(prev[k] * scale));
      });
      // Fix rounding drift
      const total = Object.values(next).reduce((s, v) => s + v, 0);
      if (total !== 100) next[others[others.length - 1]] += 100 - total;
      return next;
    });
  };

  const weightSum = Object.values(weights).reduce((s, v) => s + v, 0);

  // ── Unmount cleanup ────────────────────────────────────────────────────────
  // Runs once on mount; the returned function fires on unmount.
  // Clears every active polling interval so navigating away mid-run
  // does not leave ghost polls continuing to hit the backend.
  useEffect(() => {
    return () => {
      pollRefs.current.forEach(id => {
        if (id != null) clearInterval(id);
      });
      pollRefs.current = [];
    };
  }, []);

  // ── Run optimizer ──────────────────────────────────────────────────────────
  const handleRun = useCallback(async () => {
    setError('');
    setVariants([]);
    setRunning(true);
    setProgress(SPLITS.map((s, i) => ({ idx: i, status: 'queued', pct: 0, name: s.name })));

    // Stop any lingering polls
    pollRefs.current.forEach(id => clearInterval(id));
    pollRefs.current = [];

    const results = await Promise.allSettled(
      SPLITS.map(async (splitDef, idx) => {
        const scenario = buildScenarioString(focus, budget, splitDef.ratio, splitDef);

        // Update progress: launching
        setProgress(prev => {
          const next = [...prev];
          next[idx] = { ...next[idx], status: 'running', pct: 0 };
          return next;
        });

        // Start ABM run
        const data = await runABMSimulation(n, scenario, steps, 1);
        const simId = data.simulation_id;

        // Poll to completion
        const mbs = await new Promise((resolve, reject) => {
          const interval = setInterval(async () => {
            try {
              const prog = await getABMProgress(simId);
              setProgress(prev => {
                const next = [...prev];
                next[idx] = { ...next[idx], status: prog.status, pct: prog.pct };
                return next;
              });
              if (prog.status === 'complete') {
                clearInterval(interval);
                // Null the slot so it doesn't accumulate across re-runs.
                pollRefs.current[idx] = null;
                const raw = await fetchStepResults(simId);
                const m   = raw?.results?.mean_by_step || raw?.mean_by_step;
                resolve(m);
              } else if (prog.status === 'error') {
                clearInterval(interval);
                // Null the slot so it doesn't accumulate across re-runs.
                pollRefs.current[idx] = null;
                reject(new Error('Simulation error'));
              }
            } catch (e) { /* transient, keep polling */ }
          }, 900);
          pollRefs.current[idx] = interval;
        });

        const deltas = extractDeltas(mbs);
        const score  = compositeScore(deltas, weights);
        return {
          idx,
          name:     splitDef.name,
          split:    splitDef.ratio,
          scenario,
          mbs,
          deltas,
          score,
        };
      })
    );

    // Collect successful variants, rank by score desc
    const ranked = results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => b.score - a.score);

    if (ranked.length === 0) {
      setError('All variant simulations failed. Check that the simulation service is running on port 8003.');
    } else {
      if (ranked.length < SPLITS.length) {
        toast(`${SPLITS.length - ranked.length} variant(s) failed — showing ${ranked.length} results.`);
      } else {
        toast.success('Optimization complete! Results ranked below.');
      }
      setVariants(ranked);
    }
    setRunning(false);
  }, [budget, focus, weights, n, steps]);

  // ── UI ─────────────────────────────────────────────────────────────────────
  const WEIGHT_META = [
    { key: 'employment',     label: 'Employment',    color: '#378ADD' },
    { key: 'welfare',        label: 'Welfare',       color: '#1D9E75' },
    { key: 'infrastructure', label: 'Infrastructure',color: '#BA7517' },
    { key: 'environment',    label: 'Environment',   color: '#639922' },
  ];

  return (
    <div>
      {/* ── Input Panel ─────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem',
        marginBottom: '1.5rem',
      }}>
        {/* Left — budget + focus */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem',
        }}>
          <p style={{ margin: '0 0 1rem', fontWeight: 700, fontSize: 14, color: C.primary }}>
            Budget &amp; Focus
          </p>

          <div className="form-group" style={{ margin: '0 0 1rem' }}>
            <label className="form-label" style={{ fontSize: 13 }}>
              Total budget (₹ crore)
            </label>
            <input
              id="opt-budget"
              type="number" min={50} max={10000} step={50}
              value={budget}
              onChange={e => setBudget(Math.max(50, Number(e.target.value) || 500))}
              className="form-input"
              disabled={running}
            />
            <small style={{ color: C.sub, fontSize: 11 }}>Distributed across 6 allocation strategies</small>
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" style={{ fontSize: 13 }}>Policy focus</label>
            <select
              id="opt-focus"
              value={focus}
              onChange={e => setFocus(e.target.value)}
              className="form-input"
              disabled={running}
              style={{ background: 'white' }}
            >
              {Object.keys(FOCUS_KEYWORDS).map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Right — priority weights */}
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: C.primary }}>
              Priority weights
            </p>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 99,
              background: weightSum === 100 ? '#E1F5EE' : '#FCEBEB',
              color:      weightSum === 100 ? '#085041' : '#A32D2D',
            }}>
              {weightSum}% {weightSum !== 100 ? '⚠ must sum to 100' : '✓'}
            </span>
          </div>
          <div className="sim-weights-grid">
            {WEIGHT_META.map(w => (
              <WeightSlider
                key={w.key}
                label={w.label}
                color={w.color}
                value={weights[w.key]}
                onChange={v => handleWeightChange(w.key, v)}
                disabled={running}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Run button ──────────────────────────────────────────────────── */}
      {error && (
        <div style={{ marginBottom: '1rem' }}>
          <ErrorCard message={error} onRetry={handleRun} />
        </div>
      )}

      <button
        id="opt-run-btn"
        onClick={handleRun}
        disabled={running || weightSum !== 100}
        className="btn btn-primary"
        style={{ width: '100%', height: 48, marginBottom: '1.5rem', fontSize: 14 }}
      >
        {running
          ? (
            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem' }}>
              <span className="spinner" style={{ width: 18, height: 18, borderTopColor: 'white' }} />
              Running {SPLITS.length} variants in parallel…
            </span>
          )
          : `⚡ Run optimizer — ${SPLITS.length} variants`}
      </button>

      {/* ── Per-variant progress during run ─────────────────────────────── */}
      {running && progress.length > 0 && (
        <div style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '1rem 1.25rem', marginBottom: '1.5rem',
        }}>
          <p style={{ margin: '0 0 0.75rem', fontWeight: 700, fontSize: 13, color: C.primary }}>
            Variant progress
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem' }}>
            {progress.map((p, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.sub }}>
                  <span style={{ fontWeight: 500 }}>{p.name}</span>
                  <span style={{ fontWeight: 700, color: p.status === 'complete' ? C.green : C.accent }}>
                    {p.status === 'complete' ? '✓ done' : p.status === 'running' ? `${p.pct.toFixed(0)}%` : 'queued'}
                  </span>
                </div>
                <ProgressBar pct={p.pct} color={p.status === 'complete' ? C.green : C.accent} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Ranked results ──────────────────────────────────────────────── */}
      {variants.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.primary }}>
              Ranked variants
            </h3>
            <span style={{ fontSize: 12, color: C.sub }}>
              Composite score = weighted sum of metric deltas using your priority weights
            </span>
          </div>

          {variants.map((v, rank) => (
            <VariantCard
              key={v.idx}
              variant={v}
              rank={rank + 1}
              weights={weights}
              budget={budget}
              steps={steps}
              n={n}
              isTop={rank === 0}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ResourceOptimizer;
