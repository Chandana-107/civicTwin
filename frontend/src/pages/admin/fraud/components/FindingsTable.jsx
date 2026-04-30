import React, { useMemo, useState } from 'react';
import { TYPE_ICON, TYPE_LABEL } from '../fraudConstants';

const DETECTION_ORDER = [
  'contractor_risk','duplicate_aadhaar','duplicate_beneficiary',
  'inactive_claims','deceased_active','phone_reuse','bank_reuse',
  'shared_address','identity_similarity','regional_spike','circular_identity',
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const isRawId = (s) =>
  typeof s === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const toTitleCase = (s) =>
  (s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const humanTitle = (f) => {
  const exp = (f.explanation || '').trim();
  if (exp && exp.length > 10 && exp.length < 140) return exp;

  const label = TYPE_LABEL[f.finding_type] || toTitleCase(f.finding_type);
  const ev    = f.evidence || {};

  switch (f.finding_type) {
    case 'contractor_risk': {
      const pct = ev.value_share ? `${(ev.value_share * 100).toFixed(0)}% of contract value` : '';
      return pct ? `${label} — contractor holds ${pct}` : label;
    }
    case 'duplicate_aadhaar': {
      const m = ev.aadhaar_masked || '';
      const n = ev.count || ev.linked_ids?.length || '';
      return m ? `Aadhaar ${m} linked to ${n} beneficiary records` : `${label} — ${n} records share one Aadhaar`;
    }
    case 'deceased_active':
    case 'inactive_claims': {
      const n = ev.post_death_count || '';
      const d = ev.death_date || '';
      return d ? `Disbursements after death — ${n ? `${n} payments` : 'payments'} post ${d}` : 'Deceased beneficiary receiving active disbursements';
    }
    case 'circular_identity': {
      const tnum = ev.tender_number || '';
      return tnum ? `Approver matches contractor on tender ${tnum}` : 'Approver–contractor identity conflict detected';
    }
    case 'regional_spike': {
      const dept   = ev.department || f.entity_id || '';
      const factor = ev.spike_factor ? `${ev.spike_factor}×` : '';
      return factor ? `${dept} disbursements spiked ${factor} above baseline` : `${dept} regional disbursement spike`;
    }
    case 'shared_address':
      return `${ev.count || ''} beneficiary IDs share the same address`;
    case 'phone_reuse':
      return `Phone number reused across ${ev.count || 'multiple'} welfare claims`;
    case 'bank_reuse':
      return `Bank account shared by ${ev.count || 'multiple'} beneficiary records`;
    case 'duplicate_beneficiary':
      return `Beneficiary ID duplicated across ${ev.count || 'multiple'} records`;
    case 'identity_similarity':
      return `Beneficiary name is ${ev.similarity_score ? `${(ev.similarity_score * 100).toFixed(0)}%` : 'near-identical'} to another record`;
    default:
      return label;
  }
};

const formatEntityId = (entityType, entityId) => {
  if (!entityId) return null;
  if (isRawId(entityId)) return { display: `${entityId.slice(0, 8)}…`, full: entityId, isUuid: true };
  return { display: entityId, full: entityId, isUuid: false };
};

// ── InvestigationPanel (merged — was only used here) ─────────────────────────

const InvestigationPanel = ({ finding, onStatus }) => (
  <div className='fraud-action-row'>
    <button
      className='btn btn-secondary'
      style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
      onClick={() => onStatus(finding.id, 'investigating')}
    >
      🔍 Investigate
    </button>
    <button
      className='btn btn-danger'
      style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
      onClick={() => onStatus(finding.id, 'escalated')}
    >
      🚨 Escalate
    </button>
    <button
      className='btn btn-secondary'
      style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
      onClick={() => onStatus(finding.id, 'dismissed')}
    >
      ✗ Dismiss
    </button>
    <button
      className='btn btn-outline'
      style={{ fontSize: '0.8125rem', padding: '0.5rem 1rem' }}
      onClick={() => onStatus(finding.id, 'confirmed')}
    >
      ✓ Confirm Fraud
    </button>
  </div>
);

// ── Sub-components ────────────────────────────────────────────────────────────

const SeverityBadge = ({ severity }) => (
  <span className={`fraud-sev-badge ${(severity || '').toLowerCase()}`}>
    {severity}
  </span>
);

const StatusBadge = ({ status }) => (
  <span className={`fraud-status-badge ${(status || 'open').toLowerCase()}`}>
    {status || 'open'}
  </span>
);

const ScoreBar = ({ score }) => {
  const s     = Math.round(Number(score || 0));
  const level = s >= 80 ? 'high' : s >= 60 ? 'medium' : 'low';
  const color = s >= 80 ? 'var(--danger-color)' : s >= 60 ? 'var(--warning-color)' : 'var(--text-secondary)';
  return (
    <div className='fraud-score-row'>
      <div className='fraud-score-track'>
        <div className={`fraud-score-fill ${level}`} style={{ width: `${s}%` }} />
      </div>
      <span className='fraud-score-value' style={{ color }}>{s}</span>
    </div>
  );
};

const EvidencePills = ({ evidence }) => {
  if (!evidence) return null;
  const pills = [];
  if (evidence.value_share   != null) pills.push({ l: 'Value share',     v: `${(evidence.value_share * 100).toFixed(1)}%` });
  if (evidence.win_rate      != null) pills.push({ l: 'Win rate',        v: `${(evidence.win_rate * 100).toFixed(1)}%` });
  if (evidence.data_confidence)       pills.push({ l: 'Confidence',      v: evidence.data_confidence });
  if (evidence.spike_factor)          pills.push({ l: 'Spike',           v: `${evidence.spike_factor}×` });
  if (evidence.death_date)            pills.push({ l: 'Death date',      v: evidence.death_date });
  if (evidence.last_disbursement)     pills.push({ l: 'Last payout',    v: evidence.last_disbursement });
  if (evidence.post_death_count)      pills.push({ l: 'Post-death txns', v: evidence.post_death_count });
  if (evidence.matched_fields?.length)
    evidence.matched_fields.forEach(m => pills.push({ l: 'Matched', v: m }));
  if (evidence.tender_count)          pills.push({ l: 'Tenders',         v: evidence.tender_count });
  if (evidence.department)            pills.push({ l: 'Dept',            v: evidence.department });
  if (evidence.baseline_avg)          pills.push({ l: 'Baseline avg',    v: `₹${Number(evidence.baseline_avg).toLocaleString()}` });
  if (evidence.aadhaar_masked)        pills.push({ l: 'Aadhaar',         v: evidence.aadhaar_masked });
  if (evidence.count)                 pills.push({ l: 'Count',           v: evidence.count });
  if (!pills.length) return null;
  return (
    <div className='fraud-evidence-pills'>
      {pills.map((p, i) => (
        <span key={i} className='fraud-evidence-pill'><b>{p.l}:</b> {p.v}</span>
      ))}
    </div>
  );
};

// ── RelatedTenders — only shown for contractor_risk and circular_identity ──────

const TENDER_TYPES = new Set(['contractor_risk', 'circular_identity']);

const RelatedTenders = ({ finding }) => {
  if (!TENDER_TYPES.has(finding.finding_type)) return null;

  const ev = finding.evidence || {};

  // Normalise: evidence may give us a list OR a single tender
  const rows = (() => {
    if (Array.isArray(ev.related_tenders) && ev.related_tenders.length) {
      return ev.related_tenders;
    }
    // Build a single-row from flat evidence fields if no list
    const hasAny = ev.tender_number || ev.contractor || ev.amount || ev.department;
    if (!hasAny) return [];
    return [{
      tender_number: ev.tender_number || ev.tender_id || '—',
      contractor:    ev.contractor   || finding.entity_id || '—',
      department:    ev.department   || '—',
      amount:        ev.amount       ?? ev.total_amount ?? null,
      date:          ev.date         || ev.tender_date  || null,
      status:        ev.status       || null,
    }];
  })();

  // Also surface the related_tender_ids list when no richer data
  const ids = Array.isArray(ev.related_tender_ids) ? ev.related_tender_ids : [];

  if (!rows.length && !ids.length) return null;

  const fmtAmount = (v) =>
    v != null ? `₹${Number(v).toLocaleString('en-IN')}` : '—';

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return (
    <div style={{
      marginTop: '0.875rem',
      background: 'var(--light-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: '0.625rem',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '0.5rem 1rem',
        fontSize: '0.7rem',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.7px',
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--card-bg)',
        display: 'flex',
        alignItems: 'center',
        gap: '0.375rem',
      }}>
        🏗️ Implicated Tenders
        <span style={{
          background: 'var(--light-bg)',
          borderRadius: '999px',
          padding: '0.1rem 0.5rem',
          fontSize: '0.7rem',
          fontWeight: 700,
          color: 'var(--danger-color)',
        }}>
          {rows.length || ids.length}
        </span>
      </div>

      {rows.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
          <thead>
            <tr style={{ background: 'var(--card-bg)' }}>
              {['Tender Ref', 'Contractor', 'Department', 'Amount', 'Date', 'Status']
                .map(h => (
                  <th key={h} style={{
                    padding: '0.5rem 1rem',
                    textAlign: 'left',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.6px',
                    color: 'var(--text-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                <td style={{ padding: '0.625rem 1rem', fontFamily: "'Courier New', Consolas, monospace", fontSize: '0.78rem', color: 'var(--primary-color)', fontWeight: 600 }}>
                  {t.tender_number || t.tender_id || '—'}
                </td>
                <td style={{ padding: '0.625rem 1rem', color: 'var(--primary-color)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.contractor || '—'}
                </td>
                <td style={{ padding: '0.625rem 1rem', color: 'var(--text-secondary)' }}>
                  {t.department || '—'}
                </td>
                <td style={{ padding: '0.625rem 1rem', color: 'var(--primary-color)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {fmtAmount(t.amount)}
                </td>
                <td style={{ padding: '0.625rem 1rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {fmtDate(t.date)}
                </td>
                <td style={{ padding: '0.625rem 1rem' }}>
                  {t.status ? (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem',
                      borderRadius: '999px', textTransform: 'uppercase',
                      background: t.status === 'completed' ? '#D1FAE5' : t.status === 'active' ? '#DBEAFE' : 'var(--light-bg)',
                      color:      t.status === 'completed' ? '#065F46' : t.status === 'active' ? '#1E40AF' : 'var(--text-secondary)',
                    }}>
                      {t.status}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Fallback: only IDs available, no rich data */}
      {rows.length === 0 && ids.length > 0 && (
        <div style={{ padding: '0.75rem 1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {ids.slice(0, 12).map(id => (
            <span key={id} style={{
              fontFamily: "'Courier New', Consolas, monospace",
              fontSize: '0.75rem',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.375rem',
              padding: '0.2rem 0.5rem',
              color: 'var(--primary-color)',
            }}>
              {String(id).slice(0, 12)}{String(id).length > 12 ? '…' : ''}
            </span>
          ))}
          {ids.length > 12 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>
              +{ids.length - 12} more
            </span>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const FindingsTable = ({ flags, onStatus }) => {
  const [query,    setQuery]    = useState('');
  const [type,     setType]     = useState('all');
  const [severity, setSeverity] = useState('all');
  const [status,   setStatus]   = useState('all');
  const [page,     setPage]     = useState(1);
  const PAGE_SIZE = 10;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return flags
      .filter(f => {
        if (type     !== 'all' && f.finding_type !== type)     return false;
        if (severity !== 'all' && f.severity     !== severity) return false;
        if (status   !== 'all' && f.status       !== status)   return false;
        if (q && !(`${humanTitle(f)} ${f.explanation} ${f.entity_id}`.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0));
  }, [flags, query, type, severity, status]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const typeOptions = useMemo(
    () => DETECTION_ORDER.filter(t => flags.some(f => f.finding_type === t)),
    [flags],
  );

  if (!flags) {
    return (
      <div>
        {[...Array(6)].map((_, i) => <div key={i} className='fraud-skeleton fraud-skeleton-row' />)}
      </div>
    );
  }

  return (
    <div className='fraud-card'>

      {/* Filter bar */}
      <div className='fraud-filter-bar'>
        <input
          className='fraud-filter-input'
          placeholder='🔍  Search by title, description, entity…'
          value={query}
          onChange={e => { setPage(1); setQuery(e.target.value); }}
        />
        <select className='fraud-filter-select' value={type} onChange={e => { setPage(1); setType(e.target.value); }}>
          <option value='all'>All detection types</option>
          {typeOptions.map(t => (
            <option key={t} value={t}>{TYPE_ICON[t]} {TYPE_LABEL[t] || toTitleCase(t)}</option>
          ))}
        </select>
        <select className='fraud-filter-select' value={severity} onChange={e => { setPage(1); setSeverity(e.target.value); }}>
          <option value='all'>All severities</option>
          <option value='Critical'>🔴 Critical</option>
          <option value='High'>🟠 High</option>
          <option value='Medium'>🟡 Medium</option>
          <option value='Low'>🔵 Low</option>
        </select>
        <select className='fraud-filter-select' value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
          <option value='all'>All statuses</option>
          <option value='open'>Open</option>
          <option value='investigating'>Investigating</option>
          <option value='escalated'>Escalated</option>
          <option value='dismissed'>Dismissed</option>
          <option value='confirmed'>Confirmed</option>
        </select>
        <span className='fraud-result-count'>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {rows.length === 0 && (
        <div className='fraud-empty'>
          <div className='fraud-empty-icon'>🔍</div>
          <p className='fraud-empty-title'>No findings match the current filters</p>
          <p className='fraud-empty-sub'>Try clearing the search or adjusting the filters.</p>
        </div>
      )}

      {rows.map(f => {
        const title = humanTitle(f);
        const eid   = formatEntityId(f.entity_type, f.entity_id);
        const refId = (f.finding_key || f.id || '').slice(0, 8);

        return (
          <details key={f.id || f.finding_key} className='fraud-finding-item'>
            <summary className='fraud-finding-summary'>
              <div className='fraud-finding-top'>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className='fraud-finding-meta-row'>
                    <span style={{ fontSize: '1.1rem' }}>{TYPE_ICON[f.finding_type] || '🔍'}</span>
                    <SeverityBadge severity={f.severity} />
                    <StatusBadge  status={f.status || 'open'} />
                    <span className='fraud-type-chip'>
                      {TYPE_LABEL[f.finding_type] || toTitleCase(f.finding_type)}
                    </span>
                  </div>
                  <div className='fraud-finding-title'>{title}</div>
                  {eid && (
                    <div className='fraud-finding-sub'>
                      {f.entity_type && (
                        <span style={{ marginRight: '0.375rem' }}>{toTitleCase(f.entity_type)}:</span>
                      )}
                      <code
                        style={{ fontFamily: "'Courier New', Consolas, monospace", fontSize: '0.75rem' }}
                        title={eid.isUuid ? eid.full : undefined}
                      >
                        {eid.display}
                      </code>
                      {refId && (
                        <span style={{ marginLeft: '0.75rem', opacity: 0.6, fontSize: '0.72rem' }}>
                          Ref: {refId}…
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ width: 130, flexShrink: 0 }}>
                  <div className='fraud-finding-sub' style={{ marginBottom: '0.25rem' }}>Risk score</div>
                  <ScoreBar score={f.risk_score} />
                </div>
              </div>
            </summary>

            <div className='fraud-finding-body'>
              {f.explanation && f.explanation !== title && (
                <p className='fraud-finding-desc'>{f.explanation}</p>
              )}
              <EvidencePills evidence={f.evidence} />
              <RelatedTenders finding={f} />
              <InvestigationPanel finding={f} onStatus={onStatus} />
              <details className='fraud-raw-evidence'>
                <summary>Raw evidence JSON</summary>
                <pre className='fraud-raw-pre'>{JSON.stringify(f.evidence || {}, null, 2)}</pre>
              </details>
            </div>
          </details>
        );
      })}

      {filtered.length > PAGE_SIZE && (
        <div className='fraud-pagination'>
          <button className='btn btn-secondary' style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span>Page <b>{page}</b> of <b>{pages}</b></span>
          <button className='btn btn-secondary' style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}
            disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
};

export { humanTitle };
export default FindingsTable;
