import React, { useMemo, useState } from 'react';
import InvestigationPanel from './InvestigationPanel';
import { TYPE_ICON, TYPE_LABEL, SEV_COLOR, SEV_BG, SEV_BORDER } from './RiskCards';

const DETECTION_TYPES_ORDER = [
  'contractor_risk', 'duplicate_aadhaar', 'duplicate_beneficiary',
  'inactive_claims', 'deceased_active', 'phone_reuse', 'bank_reuse',
  'shared_address', 'identity_similarity', 'regional_spike', 'circular_identity',
];

const SeverityBadge = ({ severity }) => {
  const color  = SEV_COLOR[severity] || '#64748b';
  const bg     = SEV_BG[severity]    || '#f8fafc';
  const border = SEV_BORDER[severity]|| '#e2e8f0';
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
      background: bg, color, border: `1px solid ${border}`,
      textTransform: 'uppercase', letterSpacing: 0.5,
    }}>
      {severity}
    </span>
  );
};

const StatusBadge = ({ status }) => {
  const palette = {
    open:          { bg: '#f0fdf4', color: '#16a34a', border: '#86efac' },
    investigating: { bg: '#fefce8', color: '#ca8a04', border: '#fde047' },
    escalated:     { bg: '#fff7ed', color: '#c2410c', border: '#fdba74' },
    dismissed:     { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0' },
    confirmed:     { bg: '#fef2f2', color: '#dc2626', border: '#fca5a5' },
  };
  const p = palette[status] || palette.open;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: p.bg, color: p.color, border: `1px solid ${p.border}`,
    }}>
      {status}
    </span>
  );
};

const ScoreBar = ({ score }) => {
  const s = Math.round(Number(score || 0));
  const color = s >= 80 ? '#dc2626' : s >= 60 ? '#d97706' : s >= 35 ? '#2563eb' : '#64748b';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, background: '#f1f5f9', borderRadius: 4, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${s}%`, background: color, height: '100%', borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 28, textAlign: 'right' }}>{s}</span>
    </div>
  );
};

// Renders key evidence fields as readable pills, not raw JSON
const EvidencePills = ({ evidence, findingType }) => {
  if (!evidence) return null;
  const pills = [];

  if (evidence.value_share != null)
    pills.push({ label: 'Value share', value: `${(evidence.value_share * 100).toFixed(1)}%` });
  if (evidence.win_rate != null)
    pills.push({ label: 'Win rate', value: `${(evidence.win_rate * 100).toFixed(1)}%` });
  if (evidence.data_confidence)
    pills.push({ label: 'Confidence', value: evidence.data_confidence });
  if (evidence.spike_factor)
    pills.push({ label: 'Spike', value: `${evidence.spike_factor}×` });
  if (evidence.death_date)
    pills.push({ label: 'Death date', value: evidence.death_date });
  if (evidence.last_disbursement)
    pills.push({ label: 'Last payout', value: evidence.last_disbursement });
  if (evidence.post_death_count)
    pills.push({ label: 'Post-death txns', value: evidence.post_death_count });
  if (evidence.matched_fields?.length)
    evidence.matched_fields.forEach((m) => pills.push({ label: 'Matched', value: m }));
  if (evidence.tender_count)
    pills.push({ label: 'Tenders', value: evidence.tender_count });
  if (evidence.department)
    pills.push({ label: 'Dept', value: evidence.department });
  if (evidence.month)
    pills.push({ label: 'Month', value: evidence.month });
  if (evidence.baseline_avg)
    pills.push({ label: 'Baseline avg', value: `₹${Number(evidence.baseline_avg).toLocaleString()}` });

  if (pills.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {pills.map((p, i) => (
        <span key={i} style={{
          fontSize: 11, padding: '2px 8px', borderRadius: 20,
          background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0',
        }}>
          <b>{p.label}:</b> {p.value}
        </span>
      ))}
    </div>
  );
};

const FindingsTable = ({ flags, onStatus }) => {
  const [query,    setQuery]    = useState('');
  const [type,     setType]     = useState('all');
  const [severity, setSeverity] = useState('all');
  const [status,   setStatus]   = useState('all');
  const [page,     setPage]     = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flags.filter((f) => {
      if (type     !== 'all' && f.finding_type !== type)     return false;
      if (severity !== 'all' && f.severity     !== severity) return false;
      if (status   !== 'all' && f.status       !== status)   return false;
      if (q && !(`${f.title} ${f.explanation} ${f.entity_id}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0));
  }, [flags, query, type, severity, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows  = filtered.slice((page - 1) * pageSize, page * pageSize);

  const typeOptions = useMemo(() =>
    DETECTION_TYPES_ORDER.filter((t) => flags.some((f) => f.finding_type === t)),
  [flags]);

  return (
    <div className='card' style={{ padding: '20px 24px' }}>

      {/* Filter bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1fr 1fr auto', gap: 10, marginBottom: 16 }}>
        <input
          placeholder='🔍  Search by title, description, entity ID…'
          value={query}
          onChange={(e) => { setPage(1); setQuery(e.target.value); }}
          style={{ borderRadius: 8, border: '1px solid #e2e8f0', padding: '7px 12px', fontSize: 13 }}
        />
        <select value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}
          style={{ borderRadius: 8, border: '1px solid #e2e8f0', padding: '7px 12px', fontSize: 13 }}>
          <option value='all'>All detection types</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{TYPE_ICON[t]} {TYPE_LABEL[t] || t}</option>
          ))}
        </select>
        <select value={severity} onChange={(e) => { setPage(1); setSeverity(e.target.value); }}
          style={{ borderRadius: 8, border: '1px solid #e2e8f0', padding: '7px 12px', fontSize: 13 }}>
          <option value='all'>All severities</option>
          <option value='Critical'>🔴 Critical</option>
          <option value='High'>🟠 High</option>
          <option value='Medium'>🟡 Medium</option>
          <option value='Low'>🔵 Low</option>
        </select>
        <select value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}
          style={{ borderRadius: 8, border: '1px solid #e2e8f0', padding: '7px 12px', fontSize: 13 }}>
          <option value='all'>All statuses</option>
          <option value='open'>Open</option>
          <option value='investigating'>Investigating</option>
          <option value='escalated'>Escalated</option>
          <option value='dismissed'>Dismissed</option>
          <option value='confirmed'>Confirmed</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
          {filtered.length} result{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Findings */}
      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14 }}>No findings match the current filters.</div>
        </div>
      ) : rows.map((f) => (
        <details key={f.id} style={{
          marginBottom: 10, border: `1px solid ${SEV_BORDER[f.severity] || '#e2e8f0'}`,
          borderLeft: `4px solid ${SEV_COLOR[f.severity] || '#64748b'}`,
          borderRadius: 10, background: SEV_BG[f.severity] || '#fff',
          overflow: 'hidden',
        }}>
          <summary style={{ cursor: 'pointer', padding: '12px 16px', listStyle: 'none', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              {/* Left: icon + title */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16 }}>{TYPE_ICON[f.finding_type] || '🔍'}</span>
                  <strong style={{ fontSize: 14, color: '#1e293b' }}>{f.title}</strong>
                  <SeverityBadge severity={f.severity} />
                  <StatusBadge  status={f.status || 'open'} />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  {TYPE_LABEL[f.finding_type] || f.finding_type}
                  {f.entity_type && <> · {f.entity_type}: <code style={{ fontSize: 11 }}>{f.entity_id}</code></>}
                </div>
              </div>
              {/* Right: score bar */}
              <div style={{ width: 140, flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2 }}>Risk Score</div>
                <ScoreBar score={f.risk_score} />
              </div>
            </div>
          </summary>

          {/* Expanded body */}
          <div style={{ padding: '0 16px 16px' }}>
            <p style={{ fontSize: 13, color: '#374151', margin: '8px 0' }}>{f.explanation}</p>

            <EvidencePills evidence={f.evidence} findingType={f.finding_type} />

            <InvestigationPanel finding={f} onStatus={onStatus} />

            {/* Raw evidence — collapsed by default */}
            <details style={{ marginTop: 10 }}>
              <summary style={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer' }}>Raw evidence JSON</summary>
              <pre style={{
                marginTop: 6, background: '#f8fafc', padding: '10px 12px',
                borderRadius: 8, whiteSpace: 'pre-wrap', fontSize: 11,
                border: '1px solid #e2e8f0', maxHeight: 260, overflow: 'auto',
              }}>
                {JSON.stringify(f.evidence || {}, null, 2)}
              </pre>
            </details>
          </div>
        </details>
      ))}

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, fontSize: 13 }}>
        <button className='btn btn-secondary' disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
        <span style={{ color: '#64748b' }}>Page <b>{page}</b> of <b>{pages}</b></span>
        <button className='btn btn-secondary' disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next →</button>
      </div>
    </div>
  );
};

export default FindingsTable;
