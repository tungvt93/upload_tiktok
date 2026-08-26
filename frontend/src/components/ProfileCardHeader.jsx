import React from 'react';
import { Clock, Globe, Check, X, Edit3, Trash2 } from 'lucide-react';
import { getStatusColor } from '../status';

// Header of a profile card: selection checkbox, avatar, editable name,
// last-run date, status dot and delete button. Clicking the card opens the
// edit modal via onEdit.
const ProfileCardHeader = ({
  profile,
  isSelected,
  onToggleSelected,
  onDelete,
  onUpdateName,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue,
  onEdit
}) => (
  <div className="card-header" onClick={() => onEdit(profile.id)}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <label
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelected(profile.id)}
          className="checkbox"
        />
      </label>
      <div className="card-avatar">
        <Globe size={24} color="var(--accent)" />
      </div>
      <div className="card-identity">
        {editingId === profile.id ? (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              autoFocus
              className="input"
              style={{ fontSize: '0.9rem', padding: '4px 8px', width: '140px' }}
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onUpdateName(profile.id, editingValue);
                if (e.key === 'Escape') setEditingId(null);
              }}
            />
            <button
              onClick={() => onUpdateName(profile.id, editingValue)}
              className="btn-ghost"
              style={{ color: 'var(--success)' }}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => setEditingId(null)}
              className="btn-ghost"
              style={{ color: 'var(--error)' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div className="card-name-row">
            <h3 className="card-name">{profile.name}</h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(profile.id);
                setEditingValue(profile.name);
              }}
              className="btn-ghost"
              style={{ opacity: 0.5, transition: 'opacity 0.2s' }}
              title="Rename profile"
            >
              <Edit3 size={14} />
            </button>
          </div>
        )}
        <div className="card-meta">
          <Clock size={12} />
          {profile.last_run ? new Date(profile.last_run).toLocaleDateString() : 'Never run'}
          <div className="status-dot status-dot-glow" style={{ backgroundColor: getStatusColor(profile.status), color: getStatusColor(profile.status) }} />
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(profile.id);
        }}
        className="btn-ghost"
        style={{ color: 'rgba(239, 68, 68, 0.4)', padding: '8px' }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  </div>
);

export default ProfileCardHeader;
