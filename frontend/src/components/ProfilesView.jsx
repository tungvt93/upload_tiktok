import React from 'react';
import { Plus, Play, RefreshCw, Layout, StopCircle, Heart } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ProfileCard from './ProfileCard';
import CreateProfileModal from './CreateProfileModal';

// The "Profiles Dashboard" tab: filters, bulk actions, profile card grid,
// empty states and the create-profile modal.
const ProfilesView = ({
  profiles,
  filteredProfiles,
  groups,
  groupFilter,
  setGroupFilter,
  allFilteredSelected,
  toggleSelectAllFiltered,
  selectedForRun,
  bulkRunMode,
  setBulkRunMode,
  isLoading,
  startAutomation,
  engagingProfiles,
  startBulkEngage,
  stopBulkEngage,
  setIsCreateProfileModalOpen,
  // per-card props
  toggleProfileSelectedForRun,
  deleteProfile,
  openProfile,
  startEngage,
  stopEngage,
  updateProfileName,
  updateProfileGroup,
  updateProfileFolder,
  handleSelectFolder,
  updateProfileProxy,
  updateProfileChannelIds,
  updateProfileSchedule,
  updateProfileSchedules,
  updateProfileSetMusic,
  updateProfileAutoIncrementSchedule,
  updateProfileUploadCount,
  updateProfileNeedsRender,
  updateProfileRemoveTitle,
  openProfileDetail,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue,
  // create modal props
  isCreateProfileModalOpen,
  newProfileName,
  setNewProfileName,
  newProfileGroupId,
  setNewProfileGroupId,
  newProfileVideoFolder,
  setNewProfileVideoFolder,
  newProfileChannelIds,
  setNewProfileChannelIds,
  newProfileNeedsRender,
  setNewProfileNeedsRender,
  newProfileRemoveTitle,
  setNewProfileRemoveTitle,
  isCreatingProfile,
  isSelectingFolder,
  closeCreateProfileModal,
  addProfile,
  handleSelectFolderForCreateProfile
}) => {
  // Bulk engage button: all selected are engaging → Stop, otherwise Start.
  const selectedEngaging = [...selectedForRun].filter((id) => engagingProfiles.has(id));
  const allSelectedEngaging = selectedForRun.size > 0 && selectedEngaging.length === selectedForRun.size;

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>Profiles Dashboard</h2>
          <p style={{ color: 'var(--text-muted)' }}>Manage and automate your TikTok accounts</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Group
              <select
                className="input"
                style={{ padding: '8px 12px', minWidth: '180px' }}
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
              >
                <option value="all">All Groups</option>
                <option value="ungrouped">Ungrouped</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
            {filteredProfiles.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                />
                Chọn tất cả (danh sách đang hiển thị)
              </label>
            )}
            {selectedForRun.size > 0 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
                Đã chọn {selectedForRun.size} profile
                {bulkRunMode === 'sequential' ? ' (chạy tuần tự)' : ' (chạy cùng lúc)'}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setIsCreateProfileModalOpen(true)}
            style={{ gap: '10px' }}
          >
            <Plus size={18} />
            Thêm mới
          </button>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '140px' }}>
            Kiểu chạy
            <select
              className="input"
              value={bulkRunMode}
              onChange={(e) => setBulkRunMode(e.target.value === 'sequential' ? 'sequential' : 'parallel')}
              style={{ padding: '10px 12px', cursor: 'pointer' }}
            >
              <option value="parallel">Chạy cùng lúc</option>
              <option value="sequential">Chạy tuần tự</option>
            </select>
          </label>
          <button
            className="btn btn-primary"
            onClick={() => startAutomation()}
            disabled={isLoading || selectedForRun.size === 0}
            title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần upload' : undefined}
            style={{ gap: '10px' }}
          >
            {isLoading ? <RefreshCw className="animate-pulse" size={18} /> : <Play fill="white" size={18} />}
            Chạy đã chọn
          </button>

          {/* Bulk Engage button */}
          <button
            className="btn"
            onClick={() => (allSelectedEngaging ? stopBulkEngage() : startBulkEngage())}
            disabled={selectedForRun.size === 0}
            title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần Engage' : (allSelectedEngaging ? 'Dừng Engage tất cả đã chọn' : 'Bật Auto Engage cho tất cả đã chọn')}
            style={{
              gap: '10px',
              background: allSelectedEngaging ? 'rgba(239,68,68,0.1)' : 'rgba(236,72,153,0.1)',
              color: allSelectedEngaging ? '#EF4444' : '#EC4899',
              border: `1px solid ${allSelectedEngaging ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.3)'}`,
              fontWeight: '700',
              opacity: selectedForRun.size === 0 ? 0.45 : 1,
              cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {allSelectedEngaging
              ? <><StopCircle size={18} className="animate-pulse" /> Stop Engage</>
              : <><Heart size={18} /> Engage đã chọn</>
            }
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
        <AnimatePresence mode="popLayout">
          {filteredProfiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isSelected={selectedForRun.has(profile.id)}
              onToggleSelected={toggleProfileSelectedForRun}
              onDelete={deleteProfile}
              onOpen={openProfile}
              onStart={startAutomation}
              onEngage={startEngage}
              onStopEngage={stopEngage}
              isEngaging={engagingProfiles.has(profile.id)}
              onUpdateName={updateProfileName}
              onUpdateGroup={updateProfileGroup}
              onUpdateFolder={updateProfileFolder}
              onSelectFolder={handleSelectFolder}
              onUpdateProxy={updateProfileProxy}
              onUpdateChannelIds={updateProfileChannelIds}
              onUpdateSchedule={updateProfileSchedule}
              onUpdateSchedules={updateProfileSchedules}
              onUpdateSetMusic={updateProfileSetMusic}
              onUpdateAutoIncrementSchedule={updateProfileAutoIncrementSchedule}
              onUpdateUploadCount={updateProfileUploadCount}
              onUpdateNeedsRender={updateProfileNeedsRender}
              onUpdateRemoveTitle={updateProfileRemoveTitle}
              groups={groups}
              editingId={editingId}
              setEditingId={setEditingId}
              editingValue={editingValue}
              setEditingValue={setEditingValue}
              onOpenDetail={openProfileDetail}
            />
          ))}
        </AnimatePresence>
      </div>

      {profiles.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '80px 40px',
          color: 'var(--text-muted)',
          border: '2px dashed var(--border)',
          borderRadius: '24px',
          marginTop: '40px'
        }}>
          <div style={{ background: 'rgba(255,255,255,0.02)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Layout size={32} opacity={0.3} />
          </div>
          <h3 style={{ color: 'white', marginBottom: '8px' }}>No profiles yet</h3>
          <p>Add your first TikTok account profile to start automation.</p>
        </div>
      )}

      {profiles.length > 0 && filteredProfiles.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--text-muted)',
            border: '2px dashed var(--border)',
            borderRadius: '24px',
            marginTop: '24px'
          }}
        >
          <p style={{ color: 'white', marginBottom: '8px', fontWeight: '600' }}>No profiles match this filter</p>
          <p style={{ fontSize: '0.9rem' }}>Change the group filter above to see profiles.</p>
        </div>
      )}

      <CreateProfileModal
        open={isCreateProfileModalOpen}
        newProfileName={newProfileName}
        setNewProfileName={setNewProfileName}
        newProfileGroupId={newProfileGroupId}
        setNewProfileGroupId={setNewProfileGroupId}
        newProfileVideoFolder={newProfileVideoFolder}
        setNewProfileVideoFolder={setNewProfileVideoFolder}
        newProfileChannelIds={newProfileChannelIds}
        setNewProfileChannelIds={setNewProfileChannelIds}
        newProfileNeedsRender={newProfileNeedsRender}
        setNewProfileNeedsRender={setNewProfileNeedsRender}
        newProfileRemoveTitle={newProfileRemoveTitle}
        setNewProfileRemoveTitle={setNewProfileRemoveTitle}
        groups={groups}
        isCreatingProfile={isCreatingProfile}
        isSelectingFolder={isSelectingFolder}
        closeCreateProfileModal={closeCreateProfileModal}
        addProfile={addProfile}
        handleSelectFolderForCreateProfile={handleSelectFolderForCreateProfile}
      />
    </section>
  );
};

export default ProfilesView;
