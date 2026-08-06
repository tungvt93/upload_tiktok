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
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '8px'
    }}
    onClick={() => onEdit(profile.id)}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <label
        style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelected(profile.id)}
          style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
        />
      </label>
      <div style={{
        background: 'rgba(56, 189, 248, 0.1)',
        width: '44px',
        height: '44px',
        borderRadius: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <Globe size={24} color="var(--accent)" />
      </div>
      <div style={{ minWidth: 0 }}>
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
              style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '4px' }}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => setEditingId(null)}
              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
              {profile.name}
            </h3>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(profile.id);
                setEditingValue(profile.name);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }}
            >
              <Edit3 size={14} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <Clock size={12} />
          {profile.last_run ? new Date(profile.last_run).toLocaleDateString() : 'Never run'}
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(profile.status),
            marginLeft: '6px'
          }} />
        </div>
      </div>
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(profile.id);
        }}
        style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.4)', cursor: 'pointer', padding: '8px' }}
      >
        <Trash2 size={18} />
      </button>
    </div>
  </div>
);

export default ProfileCardHeader;
