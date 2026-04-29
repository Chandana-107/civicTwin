import React from 'react';
import { toast } from 'react-hot-toast';
import { useOutletContext } from 'react-router-dom';
import FindingsTable from './components/FindingsTable';
import { updateFraudFlagStatus } from '../../../services/fraudApi';

const FraudFindingsPage = () => {
  const { data, reload } = useOutletContext();

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
    <>
      <h3 style={{ marginBottom: 12 }}>Fraud Findings & Cases</h3>
      <FindingsTable flags={data.flags} onStatus={onStatus} />
    </>
  );
};

export default FraudFindingsPage;
