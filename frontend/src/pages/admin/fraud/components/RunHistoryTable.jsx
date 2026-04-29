import React from 'react';

const RunHistoryTable = ({ runs }) => {
  if (!runs.length) return <p style={{ color: '#5377A2' }}>Run history unavailable.</p>;

  return (
    <div className='card'>
      <h3>Audit Run History</h3>
      <div style={{ maxHeight: 420, overflowY: 'auto' }}>
        {runs.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1.2fr repeat(5,1fr)', borderBottom: '1px solid #edf2f7', padding: '8px 0' }}>
            <span>{new Date(r.started_at).toLocaleString()}</span>
            <span>{r.status}</span>
            <span>Flags {Number(r.summary?.flags_detected || 0)}</span>
            <span>High {Number(r.summary?.high_risk_cases || 0)}</span>
            <span>Graph {String(r.summary?.external_services?.graph_invoked ?? false)}</span>
            <span>Anom {String(r.summary?.external_services?.anomaly_invoked ?? false)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RunHistoryTable;
