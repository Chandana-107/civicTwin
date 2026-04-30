import React from 'react';
import { toast } from 'react-hot-toast';
import { useOutletContext } from 'react-router-dom';
import FindingsTable from './components/FindingsTable';
import { updateFraudFlagStatus } from '../../../services/fraudApi';

const FraudFindingsPage = () => {
  const { data, loading, reload } = useOutletContext();

  const onStatus = async (id, status) => {
    try {
      await updateFraudFlagStatus(id, status);
      toast.success(`Finding marked ${status}`);
      await reload({ silent: true });
    } catch {
      toast.error('Status update failed');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div className='fraud-card' style={{ padding: '1rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className='fraud-card-title' style={{ margin: 0, border: 'none', padding: 0 }}>
              Fraud Findings &amp; Cases
            </h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {loading ? 'Loading…' : `${data.flags.length} total finding${data.flags.length !== 1 ? 's' : ''} — sorted by risk score`}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className='fraud-card'>
          {[...Array(6)].map((_, i) => (
            <div key={i} className='fraud-skeleton fraud-skeleton-row' />
          ))}
        </div>
      ) : (
        <FindingsTable flags={data.flags} onStatus={onStatus} />
      )}
    </div>
  );
};

export default FraudFindingsPage;
