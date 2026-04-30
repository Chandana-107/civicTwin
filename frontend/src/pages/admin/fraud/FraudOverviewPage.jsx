import React, { useMemo, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import { humanTitle } from './components/FindingsTable';
import { TYPE_ICON, TYPE_LABEL, SEV_COLOR } from './fraudConstants';

// ── RiskCards (merged — was only used here) ───────────────────────────────────

const MetricCard = ({ icon, value, label, sub, valueColor }) => (
  <div className='fraud-metric-card'>
    <div className='fraud-metric-icon'>{icon}</div>
    <div className='fraud-metric-value' style={{ color: valueColor || 'var(--primary-color)' }}>
      {value ?? '—'}
    </div>
    <div className='fraud-metric-label'>{label}</div>
    <div className='fraud-metric-sub'>{sub || '\u00A0'}</div>
  </div>
);

const RiskCards = ({ summary, flags }) => {
  const totalFlags  = summary.flags_detected ?? flags.length;
  const highRisk    = summary.high_risk_cases ?? flags.filter(f => ['High', 'Critical'].includes(f.severity)).length;
  const contractors = summary.suspicious_contractors?.length ?? flags.filter(f => f.finding_type === 'contractor_risk').length;
  const ghostBenes  = summary.ghost_beneficiaries?.length ?? flags.filter(f => f.entity_type === 'beneficiary').length;
  const clusters    = summary.collusion_clusters?.length ?? 0;
  const deceased    = flags.filter(f => ['deceased_active', 'inactive_claims'].includes(f.finding_type)).length;
  const spikes      = flags.filter(f => f.finding_type === 'regional_spike').length;
  const circular    = flags.filter(f => f.finding_type === 'circular_identity').length;
  const dupAadhaar  = flags.filter(f => f.finding_type === 'duplicate_aadhaar').length;

  const breakdown = useMemo(() => {
    const m = {};
    flags.forEach(f => { m[f.finding_type] = (m[f.finding_type] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 9);
  }, [flags]);

  const maxVal = breakdown[0]?.[1] || 1;

  return (
    <>
      <div className='fraud-metric-grid'>
        <MetricCard icon='🚩' value={totalFlags}  label='Total Flags'         valueColor={totalFlags  > 0 ? 'var(--danger-color)'   : 'var(--success-color)'} />
        <MetricCard icon='⚠️' value={highRisk}    label='High / Critical'     valueColor={highRisk    > 0 ? '#7F1D1D'               : 'var(--success-color)'} sub='Immediate action' />
        <MetricCard icon='🏗️' value={contractors} label='Risky Contractors'   valueColor={contractors > 0 ? 'var(--warning-color)'  : 'var(--success-color)'} />
        <MetricCard icon='👻' value={ghostBenes}  label='Ghost Beneficiaries' valueColor={ghostBenes  > 0 ? '#7C3AED'               : 'var(--success-color)'} />
        <MetricCard icon='🕸️' value={clusters}    label='Collusion Clusters'  valueColor={clusters    > 0 ? '#0F766E'               : 'var(--success-color)'} />
        <MetricCard icon='⚰️' value={deceased}    label='Deceased Claims'     valueColor={deceased    > 0 ? '#1E293B'               : 'var(--success-color)'} />
        <MetricCard icon='📈' value={spikes}      label='Regional Spikes'     valueColor={spikes      > 0 ? '#0369A1'               : 'var(--success-color)'} />
        <MetricCard icon='🔄' value={circular}    label='Circular Conflicts'  valueColor={circular    > 0 ? '#7F1D1D'               : 'var(--success-color)'} sub='Approver = Contractor' />
        <MetricCard icon='🪪' value={dupAadhaar}  label='Duplicate Aadhaar'   valueColor={dupAadhaar  > 0 ? '#6D28D9'               : 'var(--success-color)'} />
      </div>

      {breakdown.length > 0 && (
        <div className='fraud-breakdown-card'>
          <div className='fraud-breakdown-title'>Detection Breakdown</div>
          {breakdown.map(([type, count]) => (
            <div key={type} className='fraud-breakdown-row'>
              <div className='fraud-breakdown-label'>
                <span>{TYPE_ICON[type] || '🔍'}</span>
                <span>{TYPE_LABEL[type] || type}</span>
              </div>
              <div className='fraud-breakdown-track'>
                <div className='fraud-breakdown-fill' style={{ width: `${(count / maxVal) * 100}%` }} />
              </div>
              <div className='fraud-breakdown-count'>{count}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
};

// ── Detection modules list ────────────────────────────────────────────────────

const DETECTION_MODULES = [
  { icon: '🏗️', label: 'Contractor Dominance (Value + Count)', key: 'contractor_risk' },
  { icon: '✂️', label: 'Bid Splitting (30-day window)',        key: 'contractor_risk' },
  { icon: '🪪', label: 'Duplicate Aadhaar Detection',          key: 'duplicate_aadhaar' },
  { icon: '🏠', label: 'Same-Address Cluster (3+)',            key: 'shared_address' },
  { icon: '⚰️', label: 'Post-Death Disbursement',              key: 'deceased_active' },
  { icon: '💀', label: 'Deceased / Inactive Beneficiary',      key: 'inactive_claims' },
  { icon: '📈', label: 'Regional Disbursement Spike (2.5×)',   key: 'regional_spike' },
  { icon: '🔄', label: 'Approver–Contractor Conflict',         key: 'circular_identity' },
  { icon: '👤', label: 'Similar Name (Fuzzy Ghost)',            key: 'identity_similarity' },
  { icon: '📱', label: 'Shared Phone Across Claims',           key: 'phone_reuse' },
  { icon: '🏦', label: 'Shared Bank Account',                  key: 'bank_reuse' },
  { icon: '🕸️', label: 'Graph Cycle Detection (ML)',           key: null, ml: true },
];

// ── Page ──────────────────────────────────────────────────────────────────────

const FraudOverviewPage = () => {
  const navigate = useNavigate();
  const { data, summary, loading, running } = useOutletContext();
  const [downloading, setDownloading] = useState(false);

  const highAlerts = data.flags
    .filter(f => ['Critical', 'High'].includes(f.severity))
    .sort((a, b) => (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0))
    .slice(0, 8);

  const downloadReport = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res   = await fetch(`${import.meta.env.VITE_API_URL || ''}/fraud/report`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Report not available — run detection first');
      const text = await res.text();
      const blob = new Blob([text], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `fraud-report-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setDownloading(false);
    }
  };

  const mlGraph   = Boolean(summary?.external_services?.graph_invoked);
  const mlAnomaly = Boolean(summary?.external_services?.anomaly_invoked);
  const runTime   = data.latestRun?.completed_at
    ? new Date(data.latestRun.completed_at).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    : null;
  const truncated = summary?.evidence_truncated;

  if (loading) {
    return (
      <div>
        <div className='fraud-metric-grid'>
          {[...Array(9)].map((_, i) => <div key={i} className='fraud-skeleton fraud-skeleton-card' />)}
        </div>
        {[...Array(4)].map((_, i) => (
          <div key={i} className='fraud-skeleton fraud-skeleton-row' style={{ marginBottom: '0.75rem' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Status bar */}
      <div className='fraud-status-bar'>
        <div className='fraud-status-left'>
          <div className='fraud-status-indicator'>
            <div className={`fraud-status-dot ${running ? 'running' : loading ? 'loading' : 'ready'}`} />
            <span style={{ color: running ? 'var(--warning-color)' : 'var(--success-color)' }}>
              {running ? 'Detection running…' : 'Ready'}
            </span>
          </div>
          <span className={`fraud-service-pill ${mlGraph   ? 'active' : 'inactive'}`}>ML Graph</span>
          <span className={`fraud-service-pill ${mlAnomaly ? 'active' : 'inactive'}`}>ML Anomaly</span>
          {runTime  && <span className='fraud-status-timestamp'>Last run: {runTime}</span>}
          {truncated && (
            <span style={{ fontSize: '0.8rem', color: 'var(--warning-color)', fontWeight: 600 }}>
              ⚠ Results truncated (100+ findings)
            </span>
          )}
        </div>
        <button
          className='btn btn-primary'
          style={{ fontSize: '0.875rem', padding: '0.5rem 1.25rem' }}
          onClick={downloadReport}
          disabled={downloading || !data.latestRun}
        >
          {downloading ? '…' : '⬇ Download Auditor Report'}
        </button>
      </div>

      {/* KPI cards + breakdown (inline component) */}
      <RiskCards summary={summary} flags={data.flags} />

      {/* High-priority alerts */}
      <div className='fraud-card'>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className='fraud-card-title' style={{ margin: 0, borderBottom: 'none', paddingBottom: 0 }}>
            🚨 High-Priority Alerts
            {highAlerts.length > 0 && (
              <span className='fraud-sev-badge high' style={{ marginLeft: '0.75rem', verticalAlign: 'middle' }}>
                {highAlerts.length}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className='btn btn-secondary' style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
              onClick={() => navigate('/admin/fraud/findings')}>All Findings →</button>
            <button className='btn btn-secondary' style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
              onClick={() => navigate('/admin/fraud/network')}>Network →</button>
          </div>
        </div>

        {highAlerts.length === 0 ? (
          <div className='fraud-empty' style={{ padding: '2rem' }}>
            <div className='fraud-empty-icon'>✅</div>
            <p className='fraud-empty-title'>No high-priority alerts</p>
            <p className='fraud-empty-sub'>All current findings are medium or low severity.</p>
          </div>
        ) : highAlerts.map(a => (
          <div key={a.id || a.finding_key} className='fraud-alert-row'>
            <div style={{ display: 'flex', gap: '0.75rem', flex: 1, minWidth: 0 }}>
              <div
                className='fraud-alert-dot'
                style={{
                  background:  SEV_COLOR[a.severity] || '#94a3b8',
                  boxShadow: `0 0 4px ${SEV_COLOR[a.severity] || '#94a3b8'}`,
                }}
              />
              <div style={{ minWidth: 0 }}>
                <p className='fraud-alert-title'>{humanTitle(a)}</p>
                {a.explanation && a.explanation !== humanTitle(a) && (
                  <p className='fraud-alert-desc'>{a.explanation}</p>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <span className={`fraud-sev-badge ${(a.severity || '').toLowerCase()}`}>{a.severity}</span>
              <div className='fraud-finding-sub' style={{ marginTop: '0.25rem' }}>
                Risk score: {Math.round(Number(a.risk_score || 0))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detection modules status */}
      <div className='fraud-card'>
        <h3 className='fraud-card-title'>🛡️ Active Detection Modules</h3>
        <div className='fraud-module-grid'>
          {DETECTION_MODULES.map(mod => {
            const flagged = mod.key
              ? data.flags.some(f => f.finding_type === mod.key)
              : (mlGraph || mlAnomaly);
            return (
              <div key={mod.label} className={`fraud-module-item ${flagged ? 'flagged' : 'clear'}`}>
                <span className='fraud-module-icon'>{mod.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className='fraud-module-label'>{mod.label}</div>
                  {mod.ml && <div className='fraud-module-note'>Requires ML service</div>}
                </div>
                <span className={`fraud-module-state ${flagged ? 'flagged' : 'clear'}`}>
                  {flagged ? '⚠ Flagged' : '✓ Clear'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default FraudOverviewPage;
