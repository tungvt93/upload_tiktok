import React from 'react';
import {
  Plus,
  Play,
  RefreshCw,
  Layout,
  StopCircle,
  Heart,
  Upload,
  FolderOpen,
  Download,
  Trash2,
  LogIn
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ProfileCard from './ProfileCard';
import CreateProfileModal from './CreateProfileModal';
import ImportCsvModal from './ImportCsvModal';
import ImportFolderModal from './ImportFolderModal';
import ExportFolderModal from './ExportFolderModal';
import EditProfileModal from './EditProfileModal';

// The "Profiles Dashboard" tab: filters, bulk actions, profile card grid,
// empty states and all profile-related modals (create, import, export, edit).
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
  startBulkLogin,
  clearTrash,
  clearDebugFiles,
  deleteSelectedProfiles,
  limitUploads,
  setLimitUploads,
  uploadLimitCount,
  setUploadLimitCount,
  setIsCreateProfileModalOpen,
  setIsImportModalOpen,
  setIsImportFolderModalOpen,
  setIsExportFolderModalOpen,
  // per-card
  toggleProfileSelectedForRun,
  deleteProfile,
  openProfile,
  startEngage,
  stopEngage,
  startLoginTikTok,
  stopLoginTikTok,
  loggingInProfiles,
  updateProfileName,
  handleChangeAvatar,
  changingAvatarProfiles,
  avatarSelections,
  handleAddFavoriteMusic,
  addingFavoriteMusicProfiles,
  musicSearchTerms,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue,
  handleEditProfile,
  // create modal
  isCreateProfileModalOpen,
  isCreatingProfile,
  isSelectingFolder,
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
  newProfileRenderConcatVideo,
  setNewProfileRenderConcatVideo,
  newProfileRemoveTitle,
  setNewProfileRemoveTitle,
  newProfileNeedContentCheck,
  setNewProfileNeedContentCheck,
  newProfileRenderVideoLong,
  setNewProfileRenderVideoLong,
  closeCreateProfileModal,
  addProfile,
  handleSelectFolderForCreateProfile,
  // import / export
  isImportModalOpen,
  isImporting,
  isExporting,
  importFileName,
  importResults,
  importCsvText,
  handleFileSelect,
  closeImportModal,
  handleImportCsv,
  isImportFolderModalOpen,
  importFolderPath,
  setImportFolderPath,
  closeImportFolderModal,
  handleImportFolder,
  isExportFolderModalOpen,
  exportFolderPath,
  setExportFolderPath,
  exportResults,
  closeExportFolderModal,
  handleExportFolder,
  // edit modal
  editingProfileId,
  editingProfile,
  handleCloseEditProfile,
  updateProfileGroup,
  updateProfileFolder,
  handleSelectFolder,
  updateProfileProxy,
  updateProfileChannelIds,
  updateProfileSchedule,
  updateProfileSchedules,
  updateProfileSetMusic,
  updateProfileAutoIncrementSchedule,
  updateProfileScheduleInterval,
  updateProfileUploadCount,
  updateProfileNeedsRender,
  updateProfileRenderConcatVideo,
  updateProfileRenderVideoLong,
  updateProfileRemoveTitle,
  updateProfileNeedContentCheck,
  handleSelectAvatar,
  handleUpdateMusicSearchTerm
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
          <button
            className="btn btn-secondary"
            onClick={() => setIsImportModalOpen(true)}
            style={{ gap: '10px' }}
          >
            <Upload size={18} />
            Import CSV
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setIsImportFolderModalOpen(true)}
            style={{ gap: '10px' }}
          >
            <FolderOpen size={18} />
            Import Folder
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setIsExportFolderModalOpen(true)}
            disabled={selectedForRun.size === 0}
            title={selectedForRun.size === 0 ? 'Tick checkbox trên các profile cần export' : 'Export danh sách profile đã chọn thành thư mục/ZIP theo format TikTok_Export'}
            style={{
              gap: '10px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3B82F6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              fontWeight: '700',
              opacity: selectedForRun.size === 0 ? 0.45 : 1,
              cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Download size={18} />
            Export Folder ({selectedForRun.size})
          </button>
          <button
            className="btn"
            onClick={clearTrash}
            disabled={selectedForRun.size === 0}
            title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần dọn rác' : 'Xoá cache/thùng rác của các profile đã chọn để tiết kiệm dung lượng'}
            style={{
              gap: '10px',
              background: 'rgba(239, 155, 68, 0.08)',
              color: '#F59E0B',
              border: '1px solid rgba(245, 158, 11, 0.25)',
              fontWeight: '700',
              opacity: selectedForRun.size === 0 ? 0.45 : 1,
              cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Trash2 size={18} />
            Clear Trash
          </button>
          <button
            className="btn"
            onClick={clearDebugFiles}
            title="Xóa file debug PNG và dọn automation.log để giải phóng dung lượng (~300-600MB)"
            style={{
              gap: '10px',
              background: 'rgba(139, 92, 246, 0.08)',
              color: '#8B5CF6',
              border: '1px solid rgba(139, 92, 246, 0.25)',
              fontWeight: '700'
            }}
          >
            <Trash2 size={18} />
            Clear Debug
          </button>
          <button
            className="btn"
            onClick={deleteSelectedProfiles}
            disabled={selectedForRun.size === 0}
            title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần xóa' : 'Xoá các profile đã chọn và folder của chúng'}
            style={{
              gap: '10px',
              background: 'rgba(239, 68, 68, 0.08)',
              color: '#EF4444',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              fontWeight: '700',
              opacity: selectedForRun.size === 0 ? 0.45 : 1,
              cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            <Trash2 size={18} />
            Xóa Profile
          </button>
          <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Giới hạn upload
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px', padding: '0 12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={limitUploads}
                onChange={(e) => setLimitUploads(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'white' }}>Bật</span>
            </label>
          </label>
          {limitUploads && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '80px' }}>
              Số video
              <input
                type="number"
                className="input"
                style={{ padding: '10px 12px', height: '40px' }}
                min="1"
                value={uploadLimitCount}
                onChange={(e) => setUploadLimitCount(parseInt(e.target.value) || 1)}
              />
            </label>
          )}
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

          {/* Bulk Login button */}
          <button
            className="btn"
            onClick={startBulkLogin}
            disabled={selectedForRun.size === 0 || isLoading}
            title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần Login' : 'Login TikTok cho tất cả đã chọn'}
            style={{
              gap: '10px',
              background: 'rgba(16, 185, 129, 0.08)',
              color: '#10B981',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              fontWeight: '700',
              opacity: (selectedForRun.size === 0 || isLoading) ? 0.45 : 1,
              cursor: (selectedForRun.size === 0 || isLoading) ? 'not-allowed' : 'pointer'
            }}
          >
            <LogIn size={18} />
            Login đã chọn
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
              onLoginTikTok={startLoginTikTok}
              onStopLoginTikTok={stopLoginTikTok}
              isLoggingIn={loggingInProfiles.has(profile.id)}
              onUpdateName={updateProfileName}
              onChangeAvatar={handleChangeAvatar}
              isChangingAvatar={changingAvatarProfiles.has(profile.id)}
              selectedAvatarPath={avatarSelections[profile.id] || ''}
              onAddFavoriteMusic={handleAddFavoriteMusic}
              isAddingFavoriteMusic={addingFavoriteMusicProfiles.has(profile.id)}
              musicSearchTerm={musicSearchTerms[profile.id] || ''}
              editingId={editingId}
              setEditingId={setEditingId}
              editingValue={editingValue}
              setEditingValue={setEditingValue}
              onEdit={handleEditProfile}
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
        newProfileRenderConcatVideo={newProfileRenderConcatVideo}
        setNewProfileRenderConcatVideo={setNewProfileRenderConcatVideo}
        newProfileRemoveTitle={newProfileRemoveTitle}
        setNewProfileRemoveTitle={setNewProfileRemoveTitle}
        newProfileNeedContentCheck={newProfileNeedContentCheck}
        setNewProfileNeedContentCheck={setNewProfileNeedContentCheck}
        newProfileRenderVideoLong={newProfileRenderVideoLong}
        setNewProfileRenderVideoLong={setNewProfileRenderVideoLong}
        groups={groups}
        isCreatingProfile={isCreatingProfile}
        isSelectingFolder={isSelectingFolder}
        closeCreateProfileModal={closeCreateProfileModal}
        addProfile={addProfile}
        handleSelectFolderForCreateProfile={handleSelectFolderForCreateProfile}
      />

      <ImportCsvModal
        open={isImportModalOpen}
        isImporting={isImporting}
        importFileName={importFileName}
        importResults={importResults}
        importCsvText={importCsvText}
        handleFileSelect={handleFileSelect}
        closeImportModal={closeImportModal}
        handleImportCsv={handleImportCsv}
      />

      <ImportFolderModal
        open={isImportFolderModalOpen}
        isImporting={isImporting}
        importFolderPath={importFolderPath}
        setImportFolderPath={setImportFolderPath}
        importResults={importResults}
        closeImportFolderModal={closeImportFolderModal}
        handleImportFolder={handleImportFolder}
      />

      <ExportFolderModal
        open={isExportFolderModalOpen}
        isExporting={isExporting}
        selectedCount={selectedForRun.size}
        exportFolderPath={exportFolderPath}
        setExportFolderPath={setExportFolderPath}
        exportResults={exportResults}
        closeExportFolderModal={closeExportFolderModal}
        handleExportFolder={handleExportFolder}
      />

      <EditProfileModal
        isOpen={editingProfileId !== null}
        onClose={handleCloseEditProfile}
        profile={editingProfile}
        groups={groups}
        onUpdateGroup={updateProfileGroup}
        onUpdateFolder={updateProfileFolder}
        onSelectFolder={handleSelectFolder}
        onUpdateProxy={updateProfileProxy}
        onUpdateChannelIds={updateProfileChannelIds}
        onUpdateSchedule={updateProfileSchedule}
        onUpdateSchedules={updateProfileSchedules}
        onUpdateSetMusic={updateProfileSetMusic}
        onUpdateAutoIncrementSchedule={updateProfileAutoIncrementSchedule}
        onUpdateScheduleInterval={updateProfileScheduleInterval}
        onUpdateUploadCount={updateProfileUploadCount}
        onUpdateNeedsRender={updateProfileNeedsRender}
        onUpdateRenderConcatVideo={updateProfileRenderConcatVideo}
        onUpdateRenderVideoLong={updateProfileRenderVideoLong}
        onUpdateRemoveTitle={updateProfileRemoveTitle}
        onUpdateNeedContentCheck={updateProfileNeedContentCheck}
        onSelectAvatar={handleSelectAvatar}
        selectedAvatarPath={editingProfileId ? (avatarSelections[editingProfileId] || '') : ''}
        musicSearchTerm={editingProfileId ? (musicSearchTerms[editingProfileId] || '') : ''}
        onUpdateMusicSearchTerm={handleUpdateMusicSearchTerm}
      />
    </section>
  );
};

export default ProfilesView;
