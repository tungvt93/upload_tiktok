import React from 'react';
import { X, FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ToggleField from './ToggleField';

// Modal used to create a new TikTok profile.
const CreateProfileModal = ({
  open,
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
  groups,
  isCreatingProfile,
  isSelectingFolder,
  closeCreateProfileModal,
  addProfile,
  handleSelectFolderForCreateProfile
}) => {
  const busy = isCreatingProfile || isSelectingFolder;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px'
          }}
          onClick={() => closeCreateProfileModal()}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="glass"
            style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '20px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Create Profile</h3>
                <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Add a new TikTok profile and assign a group</p>
              </div>
              <button
                type="button"
                onClick={() => closeCreateProfileModal()}
                disabled={busy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  opacity: busy ? 0.45 : 1
                }}
                aria-label="Close create profile modal"
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '16px' }}>
              <div className="input-group">
                <label>Profile Name</label>
                <input
                  autoFocus
                  className="input"
                  placeholder="Nhập tên profile"
                  value={newProfileName}
                  onChange={(e) => setNewProfileName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addProfile();
                    if (e.key === 'Escape') closeCreateProfileModal();
                  }}
                  disabled={busy}
                />
              </div>

              <div className="input-group">
                <label>Group</label>
                <select
                  className="input"
                  value={newProfileGroupId}
                  onChange={(e) => setNewProfileGroupId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Source Folder</label>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input
                    className="input"
                    placeholder="/path/to/videos"
                    value={newProfileVideoFolder}
                    onChange={(e) => setNewProfileVideoFolder(e.target.value)}
                    disabled={busy}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSelectFolderForCreateProfile}
                    disabled={busy}
                    style={{ padding: '0 15px' }}
                  >
                    <FolderOpen size={18} style={{ marginRight: '8px' }} />
                    Browse
                  </button>
                </div>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                  Optional. Leave empty to use the global Video Source Folder.
                </p>
              </div>

              <div className="input-group">
                <label>Channel IDs (comma separated)</label>
                <textarea
                  className="input"
                  style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="e.g. UC123, UC456"
                  value={newProfileChannelIds}
                  onChange={(e) => setNewProfileChannelIds(e.target.value)}
                  disabled={busy}
                  rows={3}
                />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                  Optional. List of managed channel IDs, comma-separated.
                </p>
              </div>

              <div className="input-group" style={{ marginBottom: '12px' }}>
                <ToggleField
                  checked={newProfileNeedsRender}
                  onChange={setNewProfileNeedsRender}
                  disabled={busy}
                  label="Render video bypass"
                  description="Mặc định bật. Tắt đi nếu muốn giữ nguyên video gốc."
                />
              </div>

              <div className="input-group" style={{ marginBottom: '12px' }}>
                <ToggleField
                  checked={newProfileRenderConcatVideo}
                  onChange={setNewProfileRenderConcatVideo}
                  disabled={busy}
                  label="Render concat video"
                  description="Nối video tải về với 1 video ngẫu nhiên trong thư mục concat_videos."
                />
              </div>

              <div className="input-group" style={{ marginBottom: '12px' }}>
                <ToggleField
                  checked={newProfileRemoveTitle}
                  onChange={setNewProfileRemoveTitle}
                  disabled={busy}
                  label="Xóa tiêu đề khi upload"
                  description="Mặc định bật. Tắt đi nếu muốn giữ lại tiêu đề gốc làm caption."
                />
              </div>

              <div className="input-group" style={{ marginBottom: '12px' }}>
                <ToggleField
                  checked={newProfileRenderVideoLong}
                  onChange={setNewProfileRenderVideoLong}
                  disabled={busy}
                  label="Render video dài (>3p cắt nhỏ, up tất cả ngay)"
                  description="Mặc định tắt. Tự động cắt video dài thành nhiều phần, upload toàn bộ."
                />
              </div>

              <div className="input-group" style={{ marginBottom: '24px' }}>
                <ToggleField
                  checked={newProfileNeedContentCheck}
                  onChange={setNewProfileNeedContentCheck}
                  disabled={busy}
                  label="Kiểm tra nội dung (Content Check)"
                  description="Mặc định bật. Tắt đi nếu muốn bỏ qua Content Check Lite của TikTok khi upload."
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => closeCreateProfileModal()} disabled={busy}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={addProfile} disabled={busy || !newProfileName.trim()}>
                  {isCreatingProfile ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CreateProfileModal;
