import React from 'react';
import { getStatusColor } from '../status';

// Reusable status indicator: a colored dot + optional label.
// Props:
//   status     – profile status string (idle, uploading, engaging, ...)
//   withDot    – show the colored dot (default true)
//   showLabel  – show the status text (default true)
//   uppercase  – uppercase the label (default true)
//   size       – 'sm' (0.75rem) or 'md' (0.8rem)
const StatusBadge = ({ status, withDot = true, showLabel = true, uppercase = true, size = 'sm' }) => {
  const color = getStatusColor(status);
  const label = (status || 'idle').toString();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {withDot && <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: color }} />}
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
