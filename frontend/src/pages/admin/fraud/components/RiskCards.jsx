import React, { useMemo } from 'react';

// Icon map for each detection type (emoji-based, no extra deps)
const TYPE_ICON = {
  contractor_risk:     '🏗️',
  duplicate_aadhaar:   '🪪',
  duplicate_beneficiary:'👥',
  inactive_claims:     '💀',
  deceased_active:     '⚰️',
  phone_reuse:         '📱',
  bank_reuse:          '🏦',
  shared_address:      '🏠',
  identity_similarity: '👤',
  regional_spike:      '📈',
  circular_identity:   '🔄',
};

const TYPE_LABEL = {
  contractor_risk:     'Contractor Risk',
  duplicate_aadhaar:   'Duplicate Aadhaar',
  duplicate_beneficiary:'Duplicate Beneficiary',
  inactive_claims:     'Deceased / Inactive',
  deceased_active:     'Post-Death Disbursement',
  phone_reuse:         'Shared Phone',
  bank_reuse:          'Shared Bank Account',
  shared_address:      'Same Address Cluster',
  identity_similarity: 'Similar Name',
  regional_spike:      'Regional Spike',
  circular_identity:   'Approver–Contractor Link',
};

const SEV_COLOR = { Critical: '#7f1d1d', High: '#dc2626', Medium: '#d97706', Low: '#2563eb' };
const SEV_BG    = { Critical: '#fef2f2', High: '#fff7f7', Medium: '#fffbeb', Low: '#eff6ff' };
const SEV_BORDER= { Critical: '#fca5a5', High: '#fca5a5', Medium: '#fcd34d', Low: '#93c5fd' };

// Animated count-up
const StatCard = ({ value, label, icon, accent = '#dc2626', sub }) => (
  <div style={{
    background: '#fff',
    border: `1px solid #e2e8f0`,
    borderTop: `3px solid ${accent}`,
    borderRadius: 12,
    padding: '18px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  }}>
    <div style={{ fontSize: 24, lineHeight: 1 }}>{icon}</div>
    <div style={{ fontSize: 30, fontWeight: 800, color: accent, letterSpacing: -1 }}>{value ?? '—'}</div>
    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    {sub && <div style={{ fontSize: 11, color: '#94a3b8' }}>{sub}</div>}
  </div>
);

const RiskCards = ({ summary, flags }) => {
  const totalFlags      = summary.flags_detected ?? flags.length;
  const highRisk        = summary.high_risk_cases ?? flags.filter((f) => ['High', 'Critical'].includes(f.severity)).length;
  const contractors     = summary.suspicious_contractors?.length ?? flags.filter((f) => f.finding_type === 'contractor_risk').length;
  const ghostBenes      = summary.ghost_beneficiaries?.length ?? flags.filter((f) => f.entity_type === 'beneficiary').length;
  const clusters        = summary.collusion_clusters?.length ?? 0;
  const deceased        = flags.filter((f) => ['deceased_active', 'inactive_claims'].includes(f.finding_type)).length;
  const spikes          = flags.filter((f) => f.finding_type === 'regional_spike').length;
  const circular        = flags.filter((f) => f.finding_type === 'circular_identity').length;
  const dupAadhaar      = flags.filter((f) => f.finding_type === 'duplicate_aadhaar').length;

  // Detection type breakdown for mini bar chart
  const breakdown = useMemo(() => {
    const m = {};
    flags.forEach((f) => { m[f.finding_type] = (m[f.finding_type] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [flags]);

  const maxVal = breakdown[0]?.[1] || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        <StatCard value={totalFlags}   label="Total Flags"        icon="🚩" accent="#dc2626" />
        <StatCard value={highRisk}     label="High / Critical"    icon="⚠️" accent="#b91c1c" sub="Immediate action needed" />
        <StatCard value={contractors}  label="Risky Contractors"  icon="🏗️" accent="#d97706" />
        <StatCard value={ghostBenes}   label="Ghost Beneficiaries"icon="👻" accent="#7c3aed" />
        <StatCard value={clusters}     label="Collusion Clusters" icon="🕸️" accent="#0f766e" />
        <StatCard value={deceased}     label="Deceased Claims"    icon="⚰️" accent="#1e293b" />
        <StatCard value={spikes}       label="Regional Spikes"    icon="📈" accent="#0369a1" />
        <StatCard value={circular}     label="Circular Conflicts" icon="🔄" accent="#7f1d1d" sub="Approver = Contractor" />
        <StatCard value={dupAadhaar}   label="Duplicate Aadhaar"  icon="🪪" accent="#6d28d9" />
      </div>

      {/* Detection type breakdown bar chart */}
      {breakdown.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b', marginBottom: 12 }}>Detection Breakdown</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {breakdown.map(([type, count]) => (
              <div key={type} style={{ display: 'grid', gridTemplateColumns: '180px 1fr 36px', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 12, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>{TYPE_ICON[type] || '🔍'}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{TYPE_LABEL[type] || type}</span>
                </div>
                <div style={{ background: '#f1f5f9', borderRadius: 6, overflow: 'hidden', height: 8 }}>
                  <div style={{ width: `${(count / maxVal) * 100}%`, background: '#dc2626', height: '100%', borderRadius: 6, transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textAlign: 'right' }}>{count}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export { TYPE_ICON, TYPE_LABEL, SEV_COLOR, SEV_BG, SEV_BORDER };
export default RiskCards;
