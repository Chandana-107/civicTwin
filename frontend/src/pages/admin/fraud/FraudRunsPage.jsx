import React from 'react';
import { useOutletContext } from 'react-router-dom';
import RunHistoryTable from './components/RunHistoryTable';

const FraudRunsPage = () => {
  const { data, summary } = useOutletContext();

  return (
    <>
      <div className='card' style={{ marginBottom: 16 }}>
        <h3>Audit Runs / Detection History</h3>
        <p style={{ color: '#5377A2' }}>
          Latest run status: {summary?.status || 'unknown'} | External Graph: {String(summary?.external_services?.graph_invoked ?? false)} | External Anomaly: {String(summary?.external_services?.anomaly_invoked ?? false)}
        </p>
      </div>
      <RunHistoryTable runs={data.runs} />
    </>
  );
};

export default FraudRunsPage;
