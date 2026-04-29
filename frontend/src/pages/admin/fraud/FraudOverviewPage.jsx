import React, { useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import RiskCards from './components/RiskCards';

const SEV_DOT = { Critical: '#7f1d1d', High: '#dc2626', Medium: '#d97706', Low: '#2563eb' };

const AlertRow = ({ flag }) => (
  <div style={{
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    padding: '10px 0', borderBottom: '1px solid #f1f5f9',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: SEV_DOT[flag.severity] || '#64748b',
          boxShadow: `0 0 4px ${SEV_DOT[flag.severity] || '#64748b'}`,
        }} />
        <strong style={{ fontSize: 13, color: '#1e293b' }}>{flag.title}</strong>
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, paddingLeft: 16 }}>
        {flag.explanation}
      </div>
    </div>
    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: SEV_DOT[flag.severity] }}>
        {flag.severity}
      </div>
      <div style={{ fontSize: 11, color: '#94a3b8' }}>
        Score: {Math.round(Number(flag.risk_score || 0))}
      </div>
    </div>
  </div>
);

const ServicePill = ({ label, active }) => (
  <span style={{
    fontSize: 11, padding: '2px 10px', borderRadius: 20, fontWeight: 600,
    background: active ? '#f0fdf4' : '#f8fafc',
    color:      active ? '#16a34a' : '#94a3b8',
    border:    `1px solid ${active ? '#86efac' : '#e2e8f0'}`,
  }}>
    {active ? '✓' : '○'} {label}
  </span>
);

const FraudOverviewPage = () => {
  const navigate = useNavigate();
  const { data, summary, loading, running } = useOutletContext();
  const [downloading, setDownloading] = useState(false);

  const highAlerts = data.flags
    .filter((f) => ['Critical', 'High'].includes(f.severity))
    .sort((a, b) => (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0))
    .slice(0, 8);

  // Download plain-text report from GET /fraud/report
  const downloadReport = async () => {
    setDownloading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/fraud/report`, {
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

  const mlActive     = summary?.external_services?.graph_invoked || summary?.external_services?.anomaly_invoked;
  const truncated    = summary?.evidence_truncated;
  const runId        = data.latestRun?.id;
  const runTime      = data.latestRun?.completed_at
    ? new Date(data.latestRun.completed_at).toLocaleString()
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Status bar */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: '14px 20px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', flexWrap: 'wrap', gap: 10,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: running ? '#d97706' : '#16a34a' }}>
            {running ? '⏳ Detection running…' : loading ? '⏳ Loading…' : '✓ Ready'}
          </span>
          <ServicePill label="ML Graph"   active={Boolean(summary?.external_services?.graph_invoked)} />
          <ServicePill label="ML Anomaly" active={Boolean(summary?.external_services?.anomaly_invoked)} />
          {runTime && <span style={{ fontSize: 11, color: '#94a3b8' }}>Last run: {runTime}</span>}
          {truncated && (
            <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>
              ⚠ Evidence list truncated (100+ findings)
            </span>
          )}
        </div>
        <button
          onClick={downloadReport}
          disabled={downloading || !data.latestRun}
          style={{
            fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8,
            background: downloading ? '#f1f5f9' : '#1e293b', color: downloading ? '#94a3b8' : '#fff',
            border: 'none', cursor: downloading ? 'not-allowed' : 'pointer',
          }}
        >
          {downloading ? 'Downloading…' : '⬇ Download Auditor Report'}
        </button>
      </div>

      {/* KPI cards + breakdown */}
      <RiskCards summary={summary} flags={data.flags} />

      {/* High-priority alerts */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b' }}>
            🚨 High-Priority Alerts
            {highAlerts.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 8px',
                borderRadius: 20, background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5',
              }}>
                {highAlerts.length}
              </span>
            )}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className='btn btn-secondary' onClick={() => navigate('/admin/fraud/findings')}>All Findings →</button>
            <button className='btn btn-secondary' onClick={() => navigate('/admin/fraud/network')}>Network Graph →</button>
          </div>
        </div>

        {highAlerts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#94a3b8', fontSize: 14 }}>
            ✅ No high-priority alerts found.
          </div>
        ) : highAlerts.map((a) => (
          <AlertRow key={a.id || a.finding_key} flag={a} />
        ))}
      </div>

      {/* Detection modules status */}
      <div style={{
        background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12,
        padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 15, color: '#1e293b' }}>🛡️ Active Detection Modules</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {[
            { icon: '🏗️', label: 'Contractor Dominance (Value + Count)',  key: 'contractor_risk' },
            { icon: '✂️', label: 'Bid Splitting (30-day window)',         key: 'contractor_risk' },
            { icon: '🪪', label: 'Duplicate Aadhaar Detection',           key: 'duplicate_aadhaar' },
            { icon: '🏠', label: 'Same-Address Cluster',                  key: 'shared_address' },
            { icon: '⚰️', label: 'Post-Death Disbursement',               key: 'deceased_active' },
            { icon: '💀', label: 'Deceased / Inactive Beneficiary',       key: 'inactive_claims' },
            { icon: '📈', label: 'Regional Disbursement Spike (2.5×)',    key: 'regional_spike' },
            { icon: '🔄', label: 'Approver–Contractor Conflict',          key: 'circular_identity' },
            { icon: '👤', label: 'Similar Name (Fuzzy Ghost)',             key: 'identity_similarity' },
            { icon: '📱', label: 'Shared Phone Across Claims',            key: 'phone_reuse' },
            { icon: '🏦', label: 'Shared Bank Account',                   key: 'bank_reuse' },
            { icon: '🕸️', label: 'Graph Cycle Detection (ML)',            key: null, ml: true },
          ].map((mod) => {
            const hasFindings = mod.key ? data.flags.some((f) => f.finding_type === mod.key) : mlActive;
            return (
              <div key={mod.label} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 8,
                background: hasFindings ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${hasFindings ? '#fca5a5' : '#86efac'}`,
              }}>
                <span style={{ fontSize: 18 }}>{mod.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{mod.label}</div>
                  {mod.ml && <div style={{ fontSize: 10, color: '#94a3b8' }}>Requires ML service</div>}
                </div>
                <span style={{
                  marginLeft: 'auto', fontSize: 11, fontWeight: 700,
                  color: hasFindings ? '#dc2626' : '#16a34a',
                }}>
                  {hasFindings ? '⚠ Flagged' : '✓ Clear'}
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
