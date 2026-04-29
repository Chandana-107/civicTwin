import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { fetchFraudBundle, runFraudDetection } from '../../../services/fraudApi';
import '../Admin.css';

const FraudModule = () => {
  const navigate = useNavigate();
  const [data, setData] = useState({ flags: [], clusters: [], latestRun: null, runs: [], errors: {} });
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const bundle = await fetchFraudBundle();
      setData(bundle);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runDetection = async () => {
    setRunning(true);
    try {
      const res = await runFraudDetection();
      toast.success(`Detection complete — ${res.flags_detected ?? 0} flags found`);
      await load({ silent: true });
    } catch (err) {
      const msg = err?.response?.data?.error || 'Detection failed. Check server logs.';
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const summary = useMemo(() => data.latestRun?.summary || data.latestRun || {}, [data.latestRun]);
  const errorKeys = Object.keys(data.errors || {});

  return (
    <div className='fraud-page'>
      <div className='container'>
        <div className='page-header'>
          <div>
            <h2>Fraud & Corruption Detection</h2>
            <p>AI Auditor module for contracts, welfare fraud, collusion, and run governance.</p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate('/admin/dashboard')} className='btn btn-secondary'>Back</button>
            <button onClick={runDetection} className='btn btn-danger' disabled={running}>{running ? 'Running...' : 'Run AI Detection'}</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ color: '#5377A2', fontSize: 13 }}>
            {loading ? 'Loading fraud data...' : 'Fraud data loaded'}
          </div>
          {errorKeys.length > 0 && (
            <div style={{ color: '#D97706', fontSize: 13 }}>
              Non-critical endpoint issue: {errorKeys.join(', ')}
            </div>
          )}
        </div>

        <div className='tab-navigation'>
          <NavLink to='/admin/fraud' end className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}>Overview</NavLink>
          <NavLink to='/admin/fraud/findings' className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}>Findings</NavLink>
          <NavLink to='/admin/fraud/network' className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}>Network</NavLink>
          <NavLink to='/admin/fraud/runs' className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}>Runs</NavLink>
          <NavLink to='/admin/fraud/analytics' className={({ isActive }) => `tab-button ${isActive ? 'active' : ''}`}>Analytics</NavLink>
        </div>

        <Outlet context={{ data, summary, loading, running, reload: load }} />
      </div>
    </div>
  );
};

export default FraudModule;
