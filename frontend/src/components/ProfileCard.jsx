import React from 'react';
import { motion } from 'framer-motion';
import ProfileCardHeader from './ProfileCardHeader';
import ProfileCardActions from './ProfileCardActions';

// Composes the profile card: header (opens edit modal on click) + action row.
const ProfileCard = ({
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
}) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 0.95 }}
    className="glass card"
    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
  >
    <ProfileCardHeader
      profile={profile}
      isSelected={isSelected}
      onToggleSelected={onToggleSelected}
      onDelete={onDelete}
      onUpdateName={onUpdateName}
      editingId={editingId}
      setEditingId={setEditingId}
      editingValue={editingValue}
      setEditingValue={setEditingValue}
      onEdit={onEdit}
    />

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
  </motion.div>
);

export default ProfileCard;
