import React from 'react';
import { Check, X, Edit3, Globe } from 'lucide-react';

// Identity cell of a profile row: selection checkbox, avatar, editable name.
const ProfileCardHeader = ({
  profile,
  isSelected,
  onToggleSelected,
  onUpdateName,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue,
  onEdit
}) => (
  <>
    <label className="table-check" onClick={(e) => e.stopPropagation()}>
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelected(profile.id)}
        className="checkbox checkbox--sm"
      />
    </label>

    <div className="table-identity" onClick={() => onEdit(profile.id)}>
      <div className="table-avatar">
        <Globe size={15} color="var(--accent)" />
      </div>
      {editingId === profile.id ? (
        <div className="table-name-edit" onClick={(e) => e.stopPropagation()}>
          <input
            autoFocus
            className="input input-compact"
            style={{ width: '140px' }}
            value={editingValue}
            onChange={(e) => setEditingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onUpdateName(profile.id, editingValue);
              if (e.key === 'Escape') setEditingId(null);
            }}
          />
          <button
            type="button"
            className="icon-btn icon-btn--success"
            onClick={() => onUpdateName(profile.id, editingValue)}
            data-tooltip="Lưu tên"
            aria-label="Lưu tên profile"
          >
            <Check size={14} />
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--danger"
            onClick={() => setEditingId(null)}
            data-tooltip="Hủy"
            aria-label="Hủy sửa tên"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="table-name">
          <span className="table-name-text">{profile.name}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(profile.id);
              setEditingValue(profile.name);
            }}
            data-tooltip="Sửa tên"
            aria-label="Sửa tên profile"
            style={{ opacity: 0.5 }}
          >
            <Edit3 size={13} />
          </button>
        </div>
      )}
    </div>
  </>
);

export default ProfileCardHeader;
