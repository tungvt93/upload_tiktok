import React from 'react';
import { getStatusColor } from '../status';

// Reusable status indicator: a colored dot + optional label.
const StatusBadge = ({ status, withDot = true, showLabel = true, uppercase = true, size = 'sm' }) => {
  const color = getStatusColor(status);
  const label = (status || 'idle').toString();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {withDot && <div className="status-dot" style={{ width: '8px', height: '8px', marginLeft: 0, backgroundColor: color }} />}
      {showLabel && (
        <span
          style={{
            fontSize: size === 'md' ? '0.8rem' : '0.75rem',
            fontWeight: '700',
            color,
            textTransform: uppercase ? 'uppercase' : 'none'
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
};

export default StatusBadge;
