import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import ClusterGraph from './components/ClusterGraph';

const FraudNetworkPage = () => {
  const { data } = useOutletContext();
  const [selected, setSelected] = useState(null);

  return (
    <>
      <div className='card' style={{ marginBottom: 16 }}>
        <h3>Collusion Network</h3>
        <p style={{ color: '#5377A2' }}>Graph combines contractor, official, beneficiary, phone, address, and bank-link signals.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        <div className='card'><ClusterGraph clusters={data.clusters} flags={data.flags} /></div>
        <div className='card'>
          <h3>Cluster Drilldown</h3>
          {data.clusters.length === 0 ? <p style={{ color: '#5377A2' }}>No collusion clusters available yet.</p> : data.clusters.slice(0, 20).map((c) => (
            <button key={c.id} className='btn btn-secondary' style={{ width: '100%', marginBottom: 8, textAlign: 'left' }} onClick={() => setSelected(c)}>
              Risk {Math.round(Number(c.suspiciousness_score || 0))} | Nodes {(Array.isArray(c.cluster_nodes) ? c.cluster_nodes.length : 0)}
            </button>
          ))}
          {selected && (
            <pre style={{ marginTop: 8, background: '#f8fafc', padding: 8, borderRadius: 6, whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(selected.evidence || {}, null, 2)}</pre>
          )}
        </div>
      </div>
    </>
  );
};

export default FraudNetworkPage;
