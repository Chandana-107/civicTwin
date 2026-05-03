/**
 * SimulationLayout.jsx
 *
 * Shared page wrapper for the simulation module.
 * Follows the same pattern as FraudModule.jsx:
 *   - Header bar with page title, subtitle, and "← Dashboard" button
 *     styled as btn btn-secondary (inline, not fixed/floating)
 *   - Max-width container via .sim-page
 *
 * Props:
 *   title     string  — page heading
 *   subtitle  string  — optional sub-heading
 *   children  node    — page content
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import './simulation.css';

const DASHBOARD_ROUTE = '/admin/dashboard';

const SimulationLayout = ({ title, subtitle, children }) => {
  const navigate = useNavigate();

  return (
    <div className="sim-page">
      {/* ── Header — matches fraud-page-header pattern ─────────────── */}
      <div className="sim-page-header">
        <div>
          <h2 className="sim-header-title">{title}</h2>
          {subtitle && (
            <p className="sim-header-subtitle">{subtitle}</p>
          )}
        </div>
        <div>
          <button
            className="btn btn-secondary"
            onClick={() => navigate(DASHBOARD_ROUTE)}
            aria-label="Back to admin dashboard"
          >
            ← Dashboard
          </button>
        </div>
      </div>

      {/* ── Page content ───────────────────────────────────────────── */}
      {children}
    </div>
  );
};

export default SimulationLayout;
