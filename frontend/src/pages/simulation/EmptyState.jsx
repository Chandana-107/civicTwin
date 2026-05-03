/**
 * EmptyState.jsx
 *
 * Centred empty-state panel shown when no simulation has been run yet.
 * Uses light-mode design tokens and .sim-empty-state classes from simulation.css.
 *
 * Props:
 *   title    string  — heading text
 *   message  string  — supporting copy
 */
import React from 'react';

/* City-chart SVG — represents policy data visualisation */
const CityChartIcon = () => (
  <svg
    className="sim-empty-icon"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    {/* Buildings */}
    <rect x="4"  y="28" width="10" height="28" rx="1" fill="currentColor" opacity="0.18" />
    <rect x="16" y="18" width="10" height="38" rx="1" fill="currentColor" opacity="0.28" />
    <rect x="28" y="10" width="10" height="46" rx="1" fill="currentColor" opacity="0.38" />
    <rect x="40" y="20" width="10" height="36" rx="1" fill="currentColor" opacity="0.28" />
    <rect x="52" y="32" width="8"  height="24" rx="1" fill="currentColor" opacity="0.18" />
    {/* Trend line */}
    <polyline
      points="4,48 16,38 28,28 40,32 60,18"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
      opacity="0.8"
    />
    {/* Data points */}
    <circle cx="4"  cy="48" r="2.5" fill="currentColor" />
    <circle cx="16" cy="38" r="2.5" fill="currentColor" />
    <circle cx="28" cy="28" r="2.5" fill="currentColor" />
    <circle cx="40" cy="32" r="2.5" fill="currentColor" />
    <circle cx="60" cy="18" r="2.5" fill="currentColor" />
  </svg>
);

const EmptyState = ({
  title = 'No simulation run yet',
  message = 'Set your parameters above and run the simulation to see results.',
}) => (
  <div className="sim-empty-state">
    <CityChartIcon />
    <p className="sim-empty-title">{title}</p>
    <p className="sim-empty-message">{message}</p>
  </div>
);

export default EmptyState;
