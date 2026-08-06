import React from 'react';

// Reusable checkbox/toggle row used in profile settings and modals.
const ToggleField = ({ checked, onChange, label, description, icon: Icon, iconColor, disabled }) => (
  <label
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      cursor: 'pointer',
      padding: '10px',
      borderRadius: '12px',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid var(--border)'
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
    />
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '700' }}>
        {Icon && <Icon size={14} color={iconColor || 'var(--text-muted)'} style={{ flexShrink: 0 }} />}
        {label}
      </span>
      {description && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{description}</span>}
    </div>
  </label>
);

export default ToggleField;
