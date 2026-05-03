/**
 * SkeletonLoader.jsx
 *
 * Reusable pulsing skeleton block for loading states.
 * Uses .sim-skeleton class from simulation.css.
 *
 * Props:
 *   height        string | number  — CSS height (default '1rem')
 *   width         string | number  — CSS width  (default '100%')
 *   borderRadius  string           — override border-radius (default '0.375rem')
 *   style         object           — additional inline styles
 *   count         number           — render N skeleton rows with 0.5rem gap (default 1)
 */
import React from 'react';

const SkeletonLoader = ({
  height = '1rem',
  width = '100%',
  borderRadius = '0.375rem',
  style = {},
  count = 1,
}) => {
  const block = (
    <span
      className="sim-skeleton"
      style={{
        height,
        width,
        borderRadius,
        display: 'block',
        ...style,
      }}
    />
  );

  if (count === 1) return block;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="sim-skeleton"
          style={{
            height,
            /* Vary last row width to look natural */
            width: i === count - 1 ? '70%' : width,
            borderRadius,
            display: 'block',
            ...style,
          }}
        />
      ))}
    </div>
  );
};

export default SkeletonLoader;
