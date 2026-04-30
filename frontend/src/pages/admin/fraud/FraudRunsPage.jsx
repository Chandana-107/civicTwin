import React from 'react';
import { useOutletContext } from 'react-router-dom';

// ── RunHistoryTable (merged — was only used here) ─────────────────────────────

const RunHistoryTable = ({ runs }) => {
  if (!runs || runs.length === 0) {
    return (
      <div className='fraud-empty'>
        <div className='fraud-empty-icon'>🗂️</div>
        <p className='fraud-empty-title'>No run history yet</p>
        <p className='fraud-empty-sub'>Click "Run AI Detection" to start your first audit run.</p>
      </div>
    );
  }

  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const duration = (r) => {
    if (!r.started_at || !r.completed_at) return '—';
    const s = Math.round((new Date(r.completed_at) - new Date(r.started_at)) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  return (
    <div className='fraud-table-wrap'>
      <table className='fraud-table'>
        <thead>
          <tr>
            <th>Started</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Flags</th>
            <th>High Risk</th>
            <th>ML Graph</th>
            <th>ML Anomaly</th>
          </tr>
        </thead>
        <tbody>
          {runs.map(r => (
            <tr key={r.id}>
              <td className='muted'>{fmtDate(r.started_at)}</td>
              <td>
                <span className={`fraud-status-badge ${r.status}`}>{r.status}</span>
              </td>
              <td className='muted'>{duration(r)}</td>
              <td><b>{Number(r.summary?.flags_detected || 0)}</b></td>
              <td style={{
                color:      Number(r.summary?.high_risk_cases || 0) > 0 ? 'var(--danger-color)' : 'var(--success-color)',
                fontWeight: 700,
              }}>
                {Number(r.summary?.high_risk_cases || 0)}
              </td>
              <td>
                <span className={`fraud-service-pill ${r.summary?.external_services?.graph_invoked ? 'active' : 'inactive'}`}>
                  {r.summary?.external_services?.graph_invoked ? '✓ Yes' : '○ No'}
                </span>
              </td>
              <td>
                <span className={`fraud-service-pill ${r.summary?.external_services?.anomaly_invoked ? 'active' : 'inactive'}`}>
                  {r.summary?.external_services?.anomaly_invoked ? '✓ Yes' : '○ No'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Page ──────────────────────────────────────────────────────────────────────

const FraudRunsPage = () => {
  const { data, summary, loading } = useOutletContext();
  const latest = data.latestRun;

  const fmtDate = (d) => d
    ? new Date(d).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : '—';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Latest run summary */}
      {latest && (
        <div className='fraud-card'>
          <h3 className='fraud-card-title'>Latest Run</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
            {[
              { label: 'Status',         value: <span className={`fraud-status-badge ${latest.status}`}>{latest.status}</span> },
              { label: 'Started',        value: fmtDate(latest.started_at) },
              { label: 'Completed',      value: fmtDate(latest.completed_at) },
              { label: 'Flags detected', value: <b style={{ color: 'var(--danger-color)' }}>{summary?.flags_detected ?? '—'}</b> },
              { label: 'High risk',      value: <b style={{ color: 'var(--danger-color)' }}>{summary?.high_risk_cases ?? '—'}</b> },
              { label: 'ML Graph',       value: <span className={`fraud-service-pill ${summary?.external_services?.graph_invoked ? 'active' : 'inactive'}`}>{summary?.external_services?.graph_invoked ? '✓ Yes' : '○ No'}</span> },
              { label: 'ML Anomaly',     value: <span className={`fraud-service-pill ${summary?.external_services?.anomaly_invoked ? 'active' : 'inactive'}`}>{summary?.external_services?.anomaly_invoked ? '✓ Yes' : '○ No'}</span> },
            ].map(({ label, value }) => (
              <div key={label} style={{ padding: '0.875rem', background: 'var(--light-bg)', borderRadius: '0.625rem' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                  {label}
                </div>
                <div style={{ fontSize: '0.9375rem', color: 'var(--primary-color)' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full run history */}
      <div className='fraud-card'>
        <h3 className='fraud-card-title'>Audit Run History</h3>
        {loading ? (
          <>
            {[...Array(5)].map((_, i) => (
              <div key={i} className='fraud-skeleton fraud-skeleton-row' />
            ))}
          </>
        ) : (
          <RunHistoryTable runs={data.runs} />
        )}
      </div>
    </div>
  );
};

export default FraudRunsPage;
