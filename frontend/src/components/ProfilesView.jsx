import React from 'react';
import {
  Plus,
  Play,
  RefreshCw,
  Layout,
  StopCircle,
  Upload,
  FolderOpen,
  Download,
  Trash2,
  Bug,
  LogIn,
  BarChart2,
  Heart,
  Zap,
  Sliders,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import ProfileCard from './ProfileCard';
import CreateProfileModal from './CreateProfileModal';
import ImportCsvModal from './ImportCsvModal';
import ImportFolderModal from './ImportFolderModal';
import ExportFolderModal from './ExportFolderModal';
import EditProfileModal from './EditProfileModal';
import BulkEditModal from './BulkEditModal';
import IconActionButton from './IconActionButton';

// The "Profiles Dashboard" tab: filters, bulk actions, profile card grid,
// empty states and all profile-related modals (create, import, export, edit).
const ProfilesView = ({
  profiles = [],
  filteredProfiles = [],
  groups = [],
  groupFilter = 'all',
  setGroupFilter,
  allFilteredSelected = false,
  toggleSelectAllFiltered,
  selectedForRun = new Set(),
  bulkRunMode = 'parallel',
  setBulkRunMode,
  isLoading = false,
  startAutomation,
  engagingProfiles = new Set(),
  startBulkEngage,
  stopBulkEngage,
  startBulkLogin,
  openStatsModal,
  clearTrash,
  clearDebugFiles,
  deleteSelectedProfiles,
  limitUploads = false,
  setLimitUploads,
  uploadLimitCount = 1,
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
  loggingInProfiles = new Set(),
  updateProfileName,
  handleChangeAvatar,
  changingAvatarProfiles = new Set(),
  avatarSelections = {},
  handleAddFavoriteMusic,
  addingFavoriteMusicProfiles = new Set(),
  musicSearchTerms = {},
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
  isBulkEditModalOpen,
  openBulkEditModal,
  closeBulkEditModal,
  updateProfilesBulk,
  // edit modal
  editingProfileId,
  editingProfile,
  handleCloseEditProfile,
  updateProfileGroup,
  updateProfileFolder,
  handleSelectFolder,
  updateProfileProxy,
  updateProfileUseProxy,
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
  const hasSelection = (selectedForRun?.size || 0) > 0;

  return (
    <section>
      <div className="page-header page-header--dash">
        <div className="dash-top">
          <div>
            <h2 className="page-title">Profiles Dashboard</h2>
            <p className="page-subtitle">Manage and automate your TikTok accounts</p>
          </div>
          <div className="dash-tools">
            <button type="button" className="btn-add" onClick={() => setIsCreateProfileModalOpen(true)}>
              <Plus size={16} aria-hidden="true" />
              Thêm mới
            </button>
            <span className="toolbar-divider" aria-hidden="true" />
            <IconActionButton
              icon={<Upload size={16} />}
              onClick={() => setIsImportModalOpen(true)}
              title="Import CSV"
              color="var(--text)"
              bg="rgba(255, 255, 255, 0.05)"
              border="var(--border)"
            />
            <IconActionButton
              icon={<FolderOpen size={16} />}
              onClick={() => setIsImportFolderModalOpen(true)}
              title="Import Folder"
              color="var(--text)"
              bg="rgba(255, 255, 255, 0.05)"
              border="var(--border)"
            />
            <span className="toolbar-divider" aria-hidden="true" />
            <IconActionButton
              icon={<Download size={16} />}
              onClick={() => setIsExportFolderModalOpen(true)}
              disabled={!hasSelection}
              title={hasSelection ? 'Export danh sách profile đã chọn thành thư mục/ZIP theo format TikTok_Export' : 'Tick checkbox trên các profile cần export'}
              color="#3B82F6"
              bg="rgba(59, 130, 246, 0.1)"
              border="rgba(59, 130, 246, 0.3)"
            />
            <IconActionButton
              icon={<Trash2 size={16} />}
              onClick={clearTrash}
              disabled={!hasSelection}
              title={hasSelection ? 'Clear Trash - dọn cache/rác của profile đã chọn' : 'Tick checkbox trên từng profile cần dọn rác'}
              color="var(--status-warn)"
              bg="rgba(245, 158, 11, 0.08)"
              border="rgba(245, 158, 11, 0.25)"
            />
            <IconActionButton
              icon={<Bug size={16} />}
              onClick={clearDebugFiles}
              title="Clear Debug - xóa file debug PNG và log (~300-600MB)"
              color="var(--status-violet)"
              bg="rgba(139, 92, 246, 0.08)"
              border="rgba(139, 92, 246, 0.25)"
            />
          </div>
        </div>

        <div className="dash-filter">
          <label className="field-label">
            Group
            <select
              className="input input-compact"
              style={{ minWidth: '180px' }}
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
              Chọn tất cả
            </label>
          )}
        </div>

        <div className={`glass bulk-bar${hasSelection ? ' is-active' : ''}`}>
          <div className={`selection-count${hasSelection ? ' is-active' : ''}`}>
            {hasSelection ? `${selectedForRun.size} đã chọn` : 'Chưa chọn profile'}
          </div>

          <span className="toolbar-divider" aria-hidden="true" />

          <button
            type="button"
            className={`bulk-chip${limitUploads ? ' is-on' : ''}`}
            onClick={() => setLimitUploads(!limitUploads)}
            data-tooltip="Giới hạn số video upload mỗi lần chạy"
          >
            <Zap size={13} aria-hidden="true" />
            Giới hạn
          </button>
          {limitUploads && (
            <input
              type="number"
              className="input input-compact input-compact--num"
              min="1"
              value={uploadLimitCount}
              onChange={(e) => setUploadLimitCount(parseInt(e.target.value) || 1)}
              aria-label="Số video tối đa mỗi lần upload"
              data-tooltip="Số video mỗi lần chạy"
            />
          )}

          <select
            className="input input-compact"
            value={bulkRunMode}
            onChange={(e) => setBulkRunMode(e.target.value === 'sequential' ? 'sequential' : 'parallel')}
            data-tooltip="Kiểu chạy hàng loạt"
            aria-label="Kiểu chạy hàng loạt"
          >
            <option value="parallel">Cùng lúc</option>
            <option value="sequential">Tuần tự</option>
          </select>

          <span className="toolbar-divider" aria-hidden="true" />

          <IconActionButton
            icon={<Trash2 size={15} />}
            onClick={deleteSelectedProfiles}
            disabled={!hasSelection}
            title={hasSelection ? 'Xóa các profile đã chọn' : 'Tick checkbox trên từng profile cần xóa'}
            color="var(--error)"
            bg="rgba(239, 68, 68, 0.08)"
            border="rgba(239, 68, 68, 0.25)"
            size="32px"
          />
          <IconActionButton
            icon={<LogIn size={15} />}
            onClick={startBulkLogin}
            disabled={!hasSelection || isLoading}
            title={hasSelection ? 'Login TikTok cho tất cả đã chọn' : 'Tick checkbox trên từng profile cần Login'}
            color="var(--success)"
            bg="rgba(16, 185, 129, 0.08)"
            border="rgba(16, 185, 129, 0.25)"
            size="32px"
          />
          {(() => {
            const selectedEngaging = [...(selectedForRun || [])].filter((id) => engagingProfiles?.has?.(id));
            const allSelectedEngaging = hasSelection && selectedEngaging.length === (selectedForRun?.size || 0);
            return (
              <IconActionButton
                icon={allSelectedEngaging ? <StopCircle size={15} className="animate-pulse" /> : <Heart size={15} />}
                onClick={() => (allSelectedEngaging ? stopBulkEngage() : startBulkEngage())}
                disabled={!hasSelection}
                title={!hasSelection ? 'Tick checkbox trên từng profile cần Engage' : (allSelectedEngaging ? 'Dừng Engage tất cả đã chọn' : 'Bật Auto Engage cho tất cả đã chọn')}
                color={allSelectedEngaging ? 'var(--error)' : 'var(--status-engage)'}
                bg={allSelectedEngaging ? 'rgba(239,68,68,0.1)' : 'rgba(236,72,153,0.1)'}
                border={allSelectedEngaging ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.3)'}
                size="32px"
              />
            );
          })()}
          <IconActionButton
            icon={<BarChart2 size={15} />}
            onClick={openStatsModal}
            disabled={!hasSelection}
            title={hasSelection ? 'Thống kê video cho các profile đã chọn' : 'Tick checkbox trên từng profile cần thống kê'}
            color="var(--accent)"
            bg="rgba(34, 211, 238, 0.1)"
            border="rgba(34, 211, 238, 0.3)"
            size="32px"
          />
          <IconActionButton
            icon={<Sliders size={15} />}
            onClick={openBulkEditModal}
            disabled={!hasSelection}
            title={hasSelection ? 'Cập nhật đồng loạt các profile đã chọn' : 'Tick checkbox trên từng profile cần cập nhật'}
            color="var(--primary)"
            bg="rgba(59, 130, 246, 0.1)"
            border="rgba(59, 130, 246, 0.3)"
            size="32px"
          />

          <button
            type="button"
            className="btn-run"
            onClick={() => startAutomation()}
            disabled={isLoading || !hasSelection}
            title={hasSelection ? undefined : 'Tick checkbox trên từng profile cần upload'}
          >
            {isLoading ? <RefreshCw className="animate-pulse" size={15} aria-hidden="true" /> : <Play fill="white" size={14} aria-hidden="true" />}
            Chạy đã chọn
          </button>
        </div>
      </div>

      {filteredProfiles.length > 0 && (
        <div className="glass profile-table">
          <div className="profile-table-head">
            <div />
            <span>Profile</span>
            <span>Status</span>
            <span>Actions</span>
            <div />
          </div>
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
      )}

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
        onUpdateUseProxy={updateProfileUseProxy}
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

      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        onClose={closeBulkEditModal}
        selectedCount={selectedForRun.size}
        groups={groups}
        onSave={updateProfilesBulk}
      />
    </section>
  );
};

export default ProfilesView;
