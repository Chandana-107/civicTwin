import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { fetchFraudBundle, runFraudDetection } from '../../../services/fraudApi';
import './Fraud.css';

const FraudModule = () => {
  const navigate = useNavigate();
  const [data, setData]       = useState({ flags: [], clusters: [], latestRun: null, runs: [], errors: {} });
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

  const summary   = useMemo(() => data.latestRun?.summary || data.latestRun || {}, [data.latestRun]);
  const errorKeys = Object.keys(data.errors || {});

  const tabCls = ({ isActive }) => `fraud-tab-btn${isActive ? ' active' : ''}`;

  return (
    <div className='fraud-page'>
      <div className='container'>

        {/* ── Header ─────────────────────────────────────────── */}
        <div className='fraud-page-header'>
          <div>
            <h2 className='fraud-page-title'>Fraud &amp; Corruption Detection</h2>
            <p className='fraud-page-subtitle'>
              AI-powered audit module — contracts, welfare fraud, collusion and run governance.
            </p>
          </div>
          <div className='fraud-header-actions'>
            <button onClick={() => navigate('/admin/dashboard')} className='btn btn-secondary'>
              ← Dashboard
            </button>
            <button onClick={runDetection} className='btn btn-primary' disabled={running}>
              {running ? '⏳ Running…' : '▶ Run AI Detection'}
            </button>
          </div>
        </div>

        {/* ── Non-critical errors ─────────────────────────────── */}
        {errorKeys.length > 0 && (
          <div style={{
            background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: '0.75rem',
            padding: '0.75rem 1.25rem', marginBottom: '1rem',
            fontSize: '0.875rem', color: '#92400E', display: 'flex', gap: '0.5rem', alignItems: 'center',
          }}>
            ⚠ Non-critical: {errorKeys.join(', ')}
          </div>
        )}

        {/* ── Tab navigation ──────────────────────────────────── */}
        <nav className='fraud-tab-nav'>
          <NavLink to='/admin/fraud'          end className={tabCls}>Overview</NavLink>
          <NavLink to='/admin/fraud/findings'     className={tabCls}>Findings</NavLink>
          <NavLink to='/admin/fraud/network'      className={tabCls}>Network</NavLink>
          <NavLink to='/admin/fraud/runs'         className={tabCls}>Runs</NavLink>
          <NavLink to='/admin/fraud/analytics'    className={tabCls}>Analytics</NavLink>
        </nav>

        {/* ── Page outlet ─────────────────────────────────────── */}
        <Outlet context={{ data, summary, loading, running, reload: load }} />

      </div>
    </div>
  );
};

export default FraudModule;
