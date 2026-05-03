/**
 * ConsequencePanel.jsx  — V8: pure display component.
 * The parent (Simulation.jsx) owns the fetch and passes:
 *   loading  bool
 *   result   { overall, risks: [{dimension, severity, finding, recommendation}] }
 *   error    string
 *   scenario string
 *
 * Typography scale (unified):
 *   section heading  16px / 600
 *   card heading     14px / 600
 *   body text        14px / 400
 *   meta label       11px / 500 uppercase
 *   badge            11px / 600
 *   recommendation   13px / 400
 */
import React from 'react';
import ErrorCard from './ErrorCard';

/* ── Typography tokens (rem units) ──────────────────────────────────────────── */
const T = {
  sectionHeading: { fontSize: '1rem',       fontWeight: 600, lineHeight: 1.3 },
  scenarioSub:    { fontSize: '0.8125rem',   fontWeight: 400, lineHeight: 1.4 },
  cardHeading:    { fontSize: '0.875rem',    fontWeight: 600, lineHeight: 1.3 },
  body:           { fontSize: '0.875rem',    fontWeight: 400, lineHeight: 1.6 },
  metaLabel:      { fontSize: '0.6875rem',   fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' },
  badge:          { fontSize: '0.6875rem',   fontWeight: 600, textTransform: 'capitalize' },
  rec:            { fontSize: '0.8125rem',   fontWeight: 400, lineHeight: 1.5 },
};

/* ── Severity colour tokens ─────────────────────────────────────────────────── */
const SEV = {
  high:   { border: '#E24B4A', bg: '#FCEBEB', text: '#A32D2D' },
  medium: { border: '#BA7517', bg: '#FAEEDA', text: '#633806' },
  low:    { border: '#1D9E75', bg: '#E1F5EE', text: '#085041' },
};

const DIM_ORDER = ['Employment', 'Welfare', 'Infrastructure', 'Environment'];

/* ── Pulsing loader ─────────────────────────────────────────────────────────── */
function PulsingDots() {
  return (
    <>
      <style>{`
        @keyframes cp-pulse {
          0%,80%,100% { opacity:0.15; transform:scale(0.8); }
          40%          { opacity:1;   transform:scale(1);   }
        }
        .cp-dot { display:inline-block; width:7px; height:7px; border-radius:50%;
                  background:var(--primary-color,#1E3150); margin:0 3px;
                  animation:cp-pulse 1.2s ease-in-out infinite; }
        .cp-dot:nth-child(2){ animation-delay:.2s }
        .cp-dot:nth-child(3){ animation-delay:.4s }
      `}</style>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', padding:'1.5rem 0' }}>
        <span className="cp-dot"/><span className="cp-dot"/><span className="cp-dot"/>
        <span style={{ ...T.body, color:'var(--color-text-secondary,#6b7280)', marginLeft:4 }}>
          Analysing policy outcomes with Gemini AI…
        </span>
      </div>
    </>
  );
}

/* ── Risk card ──────────────────────────────────────────────────────────────── */
function RiskCard({ risk }) {
  const sev = SEV[risk.severity] || SEV.low;
  return (
    <div
      className="sim-card sim-card-interactive"
      style={{
        borderLeft: `3px solid ${sev.border}`,
        borderRadius: '0 0.625rem 0.625rem 0',
        padding: '0.875rem 1rem',
      }}
    >
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ ...T.cardHeading, color:'var(--color-text-primary,#111827)' }}>
          {risk.dimension}
        </span>
        <span style={{ ...T.badge, padding:'3px 10px', borderRadius:12, background:sev.bg, color:sev.text }}>
          {risk.severity}
        </span>
      </div>
      <p style={{ ...T.body, color:'var(--color-text-secondary,#4b5563)', margin:'0 0 10px' }}>
        {risk.finding}
      </p>
      <div style={{ borderTop:'1px solid var(--color-border-tertiary,#e5e7eb)', paddingTop:10 }}>
        <div style={{ ...T.metaLabel, color:'var(--color-text-tertiary,#9ca3af)', marginBottom:4 }}>
          Recommendation
        </div>
        <div style={{ ...T.rec, color:'var(--color-text-secondary,#4b5563)' }}>
          {risk.recommendation}
        </div>
      </div>
    </div>
  );
}

/* ── Main component (pure display — no fetch) ───────────────────────────────── */
const ConsequencePanel = ({ scenario, loading, result, error, narrow = false }) => {
  const sortedRisks = result?.risks
    ? [...result.risks].sort(
        (a, b) => DIM_ORDER.indexOf(a.dimension) - DIM_ORDER.indexOf(b.dimension)
      )
    : [];

  const isRealAnalysis = result && !result.overall?.toLowerCase().includes('unavailable');

  return (
    <div style={{ marginTop: '1.5rem' }}>
      {/* Section heading */}
      <div style={{ marginBottom: '0.75rem' }}>
        <div style={{ ...T.sectionHeading, color:'var(--color-text-primary,#111827)' }}>
          Consequence analysis
        </div>
        {scenario && (
          <div style={{ ...T.scenarioSub, color:'var(--color-text-secondary,#6b7280)', marginTop:3 }}>
            {scenario.length > 70 ? scenario.slice(0, 70) + '…' : scenario}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && <PulsingDots />}

      {/* Error */}
      {!loading && error && (
        <div style={{ padding: '0.5rem 0' }}>
          <ErrorCard message={`Analysis unavailable: ${error}`} />
        </div>
      )}

      {/* Result */}
      {!loading && result && (
        <>
          {/* Overall assessment */}
          <div style={{
            background:   'var(--color-background-secondary,#f9fafb)',
            borderRadius: 10,
            padding:      '14px 16px',
            marginBottom: 12,
            border:       '1px solid var(--color-border-tertiary,#e5e7eb)',
          }}>
            <div style={{ ...T.metaLabel, color:'var(--color-text-secondary,#6b7280)', marginBottom:6 }}>
              Overall assessment
            </div>
            <div style={{ ...T.body, color:'var(--color-text-primary,#111827)' }}>
              {result.overall}
            </div>
          </div>

          {/* Risk cards */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: narrow ? '1fr' : 'repeat(2, minmax(0,1fr))',
            gap: 12,
          }}>
            {sortedRisks.map(risk => (
              <RiskCard key={risk.dimension} risk={risk} />
            ))}
          </div>

          {isRealAnalysis && (
            <div style={{ ...T.metaLabel, color:'var(--color-text-tertiary,#9ca3af)', marginTop:10, textAlign:'right' }}>
              Powered by Gemini 2.5 Flash
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ConsequencePanel;
