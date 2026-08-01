import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfileCardHeader from './ProfileCardHeader';
import ProfileSettings from './ProfileSettings';
import ProfileCardActions from './ProfileCardActions';

// Composes the profile card: header, expandable settings and action bar.
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
  onUpdateName,
  onUpdateGroup,
  onUpdateFolder,
  onSelectFolder,
  onUpdateProxy,
  onUpdateChannelIds,
  onUpdateSchedule,
  onUpdateSchedules,
  onUpdateSetMusic,
  onUpdateAutoIncrementSchedule,
  onUpdateUploadCount,
  onUpdateNeedsRender,
  onUpdateRemoveTitle,
  groups,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue,
  onOpenDetail
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [vpnCountry, setVpnCountry] = useState('');

  return (
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
        editingId={editingId}
        setEditingId={setEditingId}
        editingValue={editingValue}
        setEditingValue={setEditingValue}
        onUpdateName={onUpdateName}
        onOpenDetail={onOpenDetail}
        onDelete={onDelete}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
      />

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <ProfileSettings
              profile={profile}
              groups={groups}
              onUpdateGroup={onUpdateGroup}
              onUpdateFolder={onUpdateFolder}
              onSelectFolder={onSelectFolder}
              onUpdateProxy={onUpdateProxy}
              onUpdateChannelIds={onUpdateChannelIds}
              onUpdateSchedule={onUpdateSchedule}
              onUpdateSchedules={onUpdateSchedules}
              onUpdateAutoIncrementSchedule={onUpdateAutoIncrementSchedule}
              onUpdateUploadCount={onUpdateUploadCount}
              onUpdateNeedsRender={onUpdateNeedsRender}
              onUpdateRemoveTitle={onUpdateRemoveTitle}
              onUpdateSetMusic={onUpdateSetMusic}
              vpnCountry={vpnCountry}
              setVpnCountry={setVpnCountry}
            />

            <ProfileCardActions
              profile={profile}
              isEngaging={isEngaging}
              onOpen={onOpen}
              onStart={onStart}
              onEngage={onEngage}
              onStopEngage={onStopEngage}
              vpnCountry={vpnCountry}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ProfileCard;
