import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Trash2 } from 'lucide-react';
import ProfileCardHeader from './ProfileCardHeader';
import ProfileCardActions from './ProfileCardActions';
import { getStatusColor, STATUS_LABELS } from '../status';

// Compact table row for a profile: checkbox, name, status, icon actions, delete.
const ProfileCard = React.forwardRef(({
  profile,
  isSelected,
  onToggleSelected,
  onDelete,
  onOpen,
  onStart,
  onEngage,
  onStopEngage,
  isEngaging,
  onLoginTikTok,
  onStopLoginTikTok,
  isLoggingIn,
  onUpdateName,
  onChangeAvatar,
  isChangingAvatar,
  selectedAvatarPath,
  onAddFavoriteMusic,
  isAddingFavoriteMusic,
  musicSearchTerm,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue,
  onEdit
}, ref) => {
  const statusColor = getStatusColor(profile.status);
  const statusLabel = STATUS_LABELS[profile.status] || STATUS_LABELS.idle;

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={`table-row${isSelected ? ' table-row-selected' : ''}`}
    >
      <ProfileCardHeader
        profile={profile}
        isSelected={isSelected}
        onToggleSelected={onToggleSelected}
        onUpdateName={onUpdateName}
        editingId={editingId}
        setEditingId={setEditingId}
        editingValue={editingValue}
        setEditingValue={setEditingValue}
        onEdit={onEdit}
      />

      <div className="table-status">
        <div className="table-status-label" style={{ color: statusColor }}>
          <span
            className="status-dot-glow"
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: statusColor,
              color: statusColor,
              boxShadow: `0 0 6px ${statusColor}`,
              flexShrink: 0
            }}
          />
          {statusLabel}
        </div>
        <div className="table-status-meta">
          <Clock size={10} />
          {profile.last_run ? new Date(profile.last_run).toLocaleDateString() : 'Never run'}
        </div>
      </div>

      <ProfileCardActions
        profile={profile}
        onOpen={onOpen}
        onStart={onStart}
        isEngaging={isEngaging}
        onEngage={onEngage}
        onStopEngage={onStopEngage}
        isLoggingIn={isLoggingIn}
        onLoginTikTok={onLoginTikTok}
        onStopLoginTikTok={onStopLoginTikTok}
        onChangeAvatar={onChangeAvatar}
        isChangingAvatar={isChangingAvatar}
        selectedAvatarPath={selectedAvatarPath}
        onAddFavoriteMusic={onAddFavoriteMusic}
        isAddingFavoriteMusic={isAddingFavoriteMusic}
        musicSearchTerm={musicSearchTerm}
      />

      <button
        type="button"
        className="icon-btn icon-btn--danger"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(profile.id);
        }}
        data-tooltip="Xóa profile"
        aria-label="Xóa profile"
        style={{ justifySelf: 'center' }}
      >
        <Trash2 size={16} />
      </button>
    </motion.div>
  );
});

export default ProfileCard;
