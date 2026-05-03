/**
 * ErrorCard.jsx
 *
 * Consistent error state card with:
 *   - Red left border (4px)
 *   - Warning icon
 *   - Message text
 *   - Optional "Retry" button
 *
 * Uses .sim-error-card classes from simulation.css.
 *
 * Props:
 *   message   string    — error description to display
 *   onRetry   function  — if provided, renders a "Retry" button
 */
import React from 'react';

const ErrorCard = ({ message, onRetry }) => (
  <div className="sim-error-card" role="alert">
    <span className="sim-error-icon" aria-hidden="true">⚠️</span>
    <span className="sim-error-message">{message}</span>
    {onRetry && (
      <button
        className="sim-error-retry"
        onClick={onRetry}
        type="button"
      >
        Retry
      </button>
    )}
  </div>
);

export default ErrorCard;
