import React from 'react';

const InvestigationPanel = ({ finding, onStatus }) => {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className='btn btn-secondary' onClick={() => onStatus(finding.id, 'investigating')}>Investigate</button>
      <button className='btn btn-danger' onClick={() => onStatus(finding.id, 'escalated')}>Escalate</button>
      <button className='btn btn-secondary' onClick={() => onStatus(finding.id, 'dismissed')}>Dismiss</button>
      <button className='btn btn-secondary' onClick={() => onStatus(finding.id, 'confirmed')}>Confirm Fraud</button>
    </div>
  );
};

export default InvestigationPanel;
