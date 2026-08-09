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
  const hasSelection = selectedForRun.size > 0;

  return (
    <section>
      <div className="page-header">
        <div>
          <h2 className="page-title">Profiles Dashboard</h2>
          <p className="page-subtitle">Manage and automate your TikTok accounts</p>
          <div className="toolbar" style={{ marginTop: '16px' }}>
            <label className="field-label">
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
              <label className="field-label" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleSelectAllFiltered}
                  className="checkbox"
                />
                Chọn tất cả (danh sách đang hiển thị)
              </label>
            )}
            {hasSelection && (
              <span className="selection-count">
                Đã chọn {selectedForRun.size} profile
                {bulkRunMode === 'sequential' ? ' (chạy tuần tự)' : ' (chạy cùng lúc)'}
              </span>
            )}
          </div>
        </div>
        <div className="toolbar-actions">
          <button className="btn btn-secondary" onClick={() => setIsCreateProfileModalOpen(true)}>
            <Plus size={18} />
            Thêm mới
          </button>
          <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(true)}>
            <Upload size={18} />
            Import CSV
          </button>
          <button className="btn btn-secondary" onClick={() => setIsImportFolderModalOpen(true)}>
            <FolderOpen size={18} />
            Import Folder
          </button>
          <button
            className="btn btn-export"
            onClick={() => setIsExportFolderModalOpen(true)}
            disabled={!hasSelection}
            title={hasSelection ? 'Export danh sách profile đã chọn thành thư mục/ZIP theo format TikTok_Export' : 'Tick checkbox trên các profile cần export'}
          >
            <Download size={18} />
            Export Folder ({selectedForRun.size})
          </button>
          <button
            className="btn btn-trash"
            onClick={clearTrash}
            disabled={!hasSelection}
            title={hasSelection ? 'Xoá cache/thùng rác của các profile đã chọn để tiết kiệm dung lượng' : 'Tick checkbox trên từng profile cần dọn rác'}
          >
            <Trash2 size={18} />
            Clear Trash
          </button>
          <button
            className="btn btn-purple"
            onClick={clearDebugFiles}
            title="Xóa file debug PNG và dọn automation.log để giải phóng dung lượng (~300-600MB)"
          >
            <Trash2 size={18} />
            Clear Debug
          </button>
          <button
            className="btn btn-danger"
            onClick={deleteSelectedProfiles}
            disabled={!hasSelection}
            title={hasSelection ? 'Xoá các profile đã chọn và folder của chúng' : 'Tick checkbox trên từng profile cần xóa'}
          >
            <Trash2 size={18} />
            Xóa Profile
          </button>
          <label className="field-label--column">
            Giới hạn upload
            <label className="toggle-row" style={{ height: '40px', padding: '0 12px' }}>
              <input
                type="checkbox"
                checked={limitUploads}
                onChange={(e) => setLimitUploads(e.target.checked)}
              />
              <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text)' }}>Bật</span>
            </label>
          </label>
          {limitUploads && (
            <label className="field-label--column" style={{ minWidth: '80px' }}>
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
          <label className="field-label--column" style={{ minWidth: '140px' }}>
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
            disabled={isLoading || !hasSelection}
            title={hasSelection ? undefined : 'Tick checkbox trên từng profile cần upload'}
          >
            {isLoading ? <RefreshCw className="animate-pulse" size={18} /> : <Play fill="white" size={18} />}
            Chạy đã chọn
          </button>

          {/* Bulk Login button */}
          <button
            className="btn btn-green"
            onClick={startBulkLogin}
            disabled={!hasSelection || isLoading}
            title={hasSelection ? 'Login TikTok cho tất cả đã chọn' : 'Tick checkbox trên từng profile cần Login'}
          >
            <LogIn size={18} />
            Login đã chọn
          </button>

          {/* Bulk Engage button */}
          <button
            className={`btn ${allSelectedEngaging ? 'btn-pink-danger' : 'btn-pink'}`}
            onClick={() => (allSelectedEngaging ? stopBulkEngage() : startBulkEngage())}
            disabled={!hasSelection}
            title={hasSelection ? (allSelectedEngaging ? 'Dừng Engage tất cả đã chọn' : 'Bật Auto Engage cho tất cả đã chọn') : 'Tick checkbox trên từng profile cần Engage'}
          >
            {allSelectedEngaging
              ? <><StopCircle size={18} className="animate-pulse" /> Stop Engage</>
              : <><Heart size={18} /> Engage đã chọn</>
            }
          </button>
        </div>
      </div>

      <div className="profile-grid">
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
        <div className="empty-state">
          <div className="empty-state-icon">
            <Layout size={32} opacity={0.3} />
          </div>
          <h3 className="empty-state-title">No profiles yet</h3>
          <p>Add your first TikTok account profile to start automation.</p>
        </div>
      )}

      {profiles.length > 0 && filteredProfiles.length === 0 && (
        <div className="empty-state empty-state--compact">
          <p style={{ color: 'var(--text)', marginBottom: '8px', fontWeight: '600' }}>No profiles match this filter</p>
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
