import { AnimatePresence, motion } from 'framer-motion';
import {
  Clock,
  Fingerprint,
  FolderOpen,
  Image,
  Link,
  Music,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  Video,
  X,
  Zap
} from 'lucide-react';
import { getStatusColor } from '../status';

const EditProfileModal = ({
  isOpen,
  onClose,
  profile,
  groups,
  onUpdateGroup,
  onUpdateFolder,
  onSelectFolder,
  onUpdateProxy,
  onUpdateUseProxy,
  onUpdateChannelIds,
  onUpdateSchedule,
  onUpdateSchedules,
  onUpdateSetMusic,
  onUpdateAutoIncrementSchedule,
  onUpdateScheduleInterval,
  onUpdateUploadCount,
  onUpdateNeedsRender,
  onUpdateRenderConcatVideo,
  onUpdateRemoveTitle,
  onUpdateNeedContentCheck,
  onUpdateRenderVideoLong,
  onUpdateUseFingerprint,
  onResetFingerprint,
  onSelectAvatar,
  selectedAvatarPath,
  musicSearchTerm,
  onUpdateMusicSearchTerm
}) => {
  if (!profile) return null;

  const handleBackdropClick = (e) => {
    onClose();
  };

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop"
          onClick={handleBackdropClick}
          onKeyDown={handleKeyDown}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="glass modal-card modal-card--md"
            onClick={handleCardClick}
          >
            {/* Header */}
            <div className="modal-header">
              <div>
                <h3 className="modal-title">Edit Profile</h3>
                <p className="modal-subtitle">{profile.name}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="modal-close"
                aria-label="Close edit profile modal"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div style={{
              overflowY: 'auto',
              flex: 1,
              paddingRight: '4px'
            }}>
              {/* Group */}
              <div style={{ marginBottom: '20px' }}>
                <div className="field-title">
                  <FolderOpen size={14} />
                  Group
                </div>
                <select
                  className="input"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                  value={profile.group_id || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdateGroup(profile.id, v === '' ? null : v);
                  }}
                >
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Upload Folder */}
              <div style={{ marginBottom: '20px' }}>
                <div className="field-title">
                  <Video size={14} />
                  Upload Folder
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input"
                    style={{ fontSize: '0.75rem', padding: '8px 12px', flex: 1 }}
                    placeholder="Global Default"
                    value={profile.video_folder || ''}
                    onChange={(e) => onUpdateFolder(profile.id, e.target.value)}
                  />
                  <button
                    onClick={() => onSelectFolder(profile.id)}
                    className="btn-secondary"
                    style={{ padding: '8px', minWidth: 'auto' }}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>

              {/* Avatar Image */}
              <div style={{ marginBottom: '20px' }}>
                <div className="field-title">
                  <Image size={14} />
                  Avatar Image
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    className="input"
                    style={{ fontSize: '0.75rem', padding: '8px 12px', flex: 1 }}
                    placeholder="Select an image..."
                    value={selectedAvatarPath || ''}
                    readOnly
                  />
                  <button
                    onClick={() => onSelectAvatar(profile.id)}
                    className="btn-secondary"
                    style={{ padding: '8px', minWidth: 'auto' }}
                  >
                    <FolderOpen size={14} />
                  </button>
                </div>
              </div>

              {/* Favorite Music */}
              <div style={{ marginBottom: '20px' }}>
                <div className="field-title">
                  <Search size={14} />
                  Favorite Music (Nhập nhiều bài cách nhau bằng dấu phẩy ",")
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <textarea
                    className="input"
                    rows={3}
                    style={{ fontSize: '0.75rem', padding: '8px 12px', flex: 1, resize: 'vertical', minHeight: '64px' }}
                    placeholder="Nhập danh sách bài hát cách nhau bởi dấu phẩy (VD: Bài 1, Bài 2, Bài 3)..."
                    value={musicSearchTerm || ''}
                    onChange={(e) => onUpdateMusicSearchTerm(profile.id, e.target.value)}
                  />
                </div>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Mỗi video upload sẽ lần lượt chọn từng bài nhạc trong danh sách trên (xoay vòng: Video 1 -&gt; Bài 1, Video 2 -&gt; Bài 2,...).
                </span>
              </div>

              {/* Proxy Server & Toggle */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row" style={{ marginBottom: '10px' }}>
                  <input
                    type="checkbox"
                    checked={profile.use_proxy !== 0}
                    onChange={(e) => onUpdateUseProxy && onUpdateUseProxy(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">
                      <Link size={14} color="var(--primary)" />
                      Sử dụng Proxy
                    </span>
                    <span className="toggle-desc">
                      Bật: kết nối qua Proxy khi chạy profile. Tắt: chạy trực tiếp không qua proxy.
                    </span>
                  </div>
                </label>
                <div style={{ opacity: profile.use_proxy === 0 ? 0.6 : 1, transition: 'opacity 0.2s' }}>
                  <div className="field-title" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>
                    Proxy Server (Optional) {profile.use_proxy === 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(Đang tắt proxy)</span>}
                  </div>
                  <input
                    className="input"
                    style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                    placeholder="http://user:pass@host:port"
                    value={profile.proxy || ''}
                    onChange={(e) => onUpdateProxy(profile.id, e.target.value)}
                  />
                </div>
              </div>

              {/* Channel IDs */}
              <div style={{ marginBottom: '20px' }}>
                <div className="field-title">
                  <Users size={14} />
                  Channel IDs (comma separated)
                </div>
                <textarea
                  className="input"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                  placeholder="e.g. UC123, UC456"
                  value={profile.channel_ids || ''}
                  onChange={(e) => onUpdateChannelIds(profile.id, e.target.value)}
                  rows={2}
                />
              </div>

              {/* Schedule Public Video */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.is_scheduled === 1}
                    onChange={(e) => onUpdateSchedule(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">Schedule Public Video</span>
                    <span className="toggle-desc">Lên lịch công khai video</span>
                  </div>
                </label>

                {profile.is_scheduled === 1 && (
                  <div style={{ marginTop: '12px', paddingLeft: '38px' }}>
                    <div className="field-title">
                      <Clock size={14} />
                      Daily Times (HH:mm, HH:mm)
                    </div>
                    <input
                      className="input"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                      placeholder="e.g. 08:00, 18:00, 22:00"
                      defaultValue={profile.schedules?.join(', ') || ''}
                      onBlur={(e) => onUpdateSchedules(profile.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateSchedules(profile.id, e.target.value);
                          e.target.blur();
                        }
                      }}
                    />

                    <div style={{ marginTop: '12px' }}>
                      <div className="field-title">
                        <Video size={14} />
                        Số lượng video mỗi lần
                      </div>
                      <input
                        type="number"
                        className="input"
                        style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                        min="1"
                        placeholder="Default: 1"
                        value={profile.upload_count || 1}
                        onChange={(e) => onUpdateUploadCount(profile.id, parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Auto Increment Schedule */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  padding: '10px',
                  borderRadius: '12px',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.auto_increment_schedule === 1}
                      onChange={(e) => onUpdateAutoIncrementSchedule(profile.id, e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div className="toggle-body">
                      <span className="toggle-title">Lên lịch nối tiếp</span>
                      <span className="toggle-desc">V1: Public, V2: Mặc định, V3+: +{(profile.schedule_interval || 5)} phút</span>
                    </div>
                  </label>
                </div>

                {profile.auto_increment_schedule === 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--divider)', paddingLeft: '28px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Khoảng cách:</span>
                    {[5, 10, 15, 20].map((mins) => (
                      <label key={mins} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.75rem', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name={`schedule_interval_${profile.id}`}
                          value={mins}
                          checked={(profile.schedule_interval || 5) === mins}
                          onChange={() => onUpdateScheduleInterval && onUpdateScheduleInterval(profile.id, mins)}
                          style={{ accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        {mins} phút
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Render bypass */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.needs_render !== 0}
                    onChange={(e) => onUpdateNeedsRender(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">
                      <Zap size={14} color="var(--primary)" />
                      Render video bypass
                    </span>
                    <span className="toggle-desc">
                      Bật: xử lý lách bản quyền qua render.py. Tắt: giữ nguyên video gốc.
                    </span>
                  </div>
                </label>
              </div>

              {/* Render concat video */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.render_concat_video !== 0 && profile.render_concat_video !== undefined}
                    onChange={(e) => onUpdateRenderConcatVideo(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">
                      <Link size={14} color="var(--primary)" />
                      Render concat video
                    </span>
                    <span className="toggle-desc">
                      Bật: nối video tải về với 1 video bất kỳ trong thư mục concat_videos.
                    </span>
                  </div>
                </label>
              </div>

              {/* Render video long */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.render_video_long !== 0}
                    onChange={(e) => onUpdateRenderVideoLong(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">
                      <Video size={14} color="var(--primary)" />
                      Render video dài {'>'}3p cắt nhỏ, up tất cả ngay)
                    </span>
                    <span className="toggle-desc">
                      Bật: tự động cắt video dài thành nhiều phần, zoom 1.8x, làm nền mờ và upload liên tục toàn bộ.
                    </span>
                  </div>
                </label>
              </div>

              {/* Remove title */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.remove_title !== 0}
                    onChange={(e) => onUpdateRemoveTitle(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">
                      <Trash2 size={14} color="var(--error)" />
                      Xóa tiêu đề khi upload
                    </span>
                    <span className="toggle-desc">
                      Bật: tự động xóa tiêu đề mặc định khi đăng. Tắt: giữ tiêu đề gốc.
                    </span>
                  </div>
                </label>
              </div>

              {/* Set music */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.set_music === 1}
                    onChange={(e) => onUpdateSetMusic(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">
                      <Music size={14} color="var(--accent)" />
                      Set nhạc khi upload
                    </span>
                    <span className="toggle-desc">
                      Bật: mở Edit video, chọn nhạc từ Favorites rồi Save.
                    </span>
                  </div>
                </label>
              </div>

              {/* Content Check */}
              <div style={{ marginBottom: '20px' }}>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={profile.need_content_check !== 0}
                    onChange={(e) => onUpdateNeedContentCheck(profile.id, e.target.checked)}
                  />
                  <div className="toggle-body">
                    <span className="toggle-title">
                      <ShieldCheck size={14} color="var(--success)" />
                      Kiểm tra nội dung (Content Check)
                    </span>
                    <span className="toggle-desc">
                      Bật: tự động kiểm tra bản quyền / nội dung bằng Content Check Lite. Tắt: bỏ qua kiểm tra.
                    </span>
                  </div>
                </label>
              </div>

              {/* Browser Fingerprint */}
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={profile.use_fingerprint !== 0}
                      onChange={(e) => onUpdateUseFingerprint && onUpdateUseFingerprint(profile.id, e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '700' }}>
                        <Fingerprint size={14} color="#3b82f6" style={{ flexShrink: 0 }} />
                        Giả lập Vân tay Trình duyệt (Browser Fingerprint)
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Bật: tự động gán & duy trì vân tay trình duyệt cố định cho profile. Tắt: chạy Chrome mặc định.
                      </span>
                    </div>
                  </label>
                  {profile.use_fingerprint !== 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {profile.fingerprint ? 'Đã có vân tay cố định trong DB' : 'Chưa có vân tay (Sẽ tự tạo khi mở Chrome)'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onResetFingerprint && onResetFingerprint(profile.id)}
                        style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <RefreshCw size={12} />
                        Tạo Vân Tay Mới
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer with status */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(profile.status)
                }} />
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: '700',
                  color: getStatusColor(profile.status),
                  textTransform: 'uppercase'
                }}>
                  {profile.status}
                </span>
              </div>
              <button
                className="btn btn-secondary"
                onClick={onClose}
                style={{ padding: '8px 20px' }}
              >
                Close
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EditProfileModal;
