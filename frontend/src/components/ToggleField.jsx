import React from 'react';

// Reusable checkbox/toggle row used in profile settings and modals.
const ToggleField = ({ checked, onChange, label, description, icon: Icon, iconColor, disabled }) => (
  <label className="toggle-row">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      disabled={disabled}
    />
    <div className="toggle-body">
      <span className="toggle-title">
        {Icon && <Icon size={14} color={iconColor || 'var(--text-muted)'} />}
        {label}
      </span>
      {description && <span className="toggle-desc">{description}</span>}
    </div>
  </label>
);

export default ToggleField;
