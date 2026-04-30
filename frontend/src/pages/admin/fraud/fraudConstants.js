// fraudConstants.js
// Shared design-system constants for the Fraud Detection module.
// Kept as a separate file because TYPE_ICON, TYPE_LABEL and SEV_COLOR
// are used by FraudOverviewPage, FraudAnalyticsPage, and FindingsTable.

export const TYPE_ICON = {
  contractor_risk:       '🏗️',
  duplicate_aadhaar:     '🪪',
  duplicate_beneficiary: '👥',
  inactive_claims:       '💀',
  deceased_active:       '⚰️',
  phone_reuse:           '📱',
  bank_reuse:            '🏦',
  shared_address:        '🏠',
  identity_similarity:   '👤',
  regional_spike:        '📈',
  circular_identity:     '🔄',
};

export const TYPE_LABEL = {
  contractor_risk:       'Contractor Risk',
  duplicate_aadhaar:     'Duplicate Aadhaar',
  duplicate_beneficiary: 'Duplicate Beneficiary',
  inactive_claims:       'Deceased / Inactive',
  deceased_active:       'Post-Death Disbursement',
  phone_reuse:           'Shared Phone',
  bank_reuse:            'Shared Bank Account',
  shared_address:        'Same-Address Cluster',
  identity_similarity:   'Similar Name',
  regional_spike:        'Regional Spike',
  circular_identity:     'Approver–Contractor Link',
};

// severity → CSS class suffix (fraud-sev-badge, fraud-metric-value)
export const SEV_CLASS = {
  Critical: 'critical',
  High:     'high',
  Medium:   'medium',
  Low:      'low',
};

// severity → color value (for inline dots/bars where CSS class isn't possible)
export const SEV_COLOR = {
  Critical: '#7F1D1D',
  High:     '#DC2626',
  Medium:   '#D97706',
  Low:      '#2563EB',
  clear:    '#059669',
};
