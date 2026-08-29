import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Sliders,
  FolderOpen,
  Link,
  Music,
  Trash2,
  ShieldCheck,
  Clock,
  Video,
  Film,
  Layers,
  Fingerprint,
  Save
} from 'lucide-react';

const BulkEditModal = ({
  isOpen,
  onClose,
  selectedCount,
  groups = [],
  onSave
}) => {
  const [fields, setFields] = useState({
    group_id: { active: false, value: '' },
    use_proxy: { active: false, value: 1 },
    proxy: { active: false, value: '' },
    set_music: { active: false, value: 1 },
    remove_title: { active: false, value: 1 },
    need_content_check: { active: false, value: 0 },
    auto_increment_schedule: { active: false, value: 1 },
    schedule_interval: { active: false, value: 10 },
    upload_count: { active: false, value: 1 },
    needs_render: { active: false, value: 1 },
    render_video_long: { active: false, value: 0 },
    render_concat_video: { active: false, value: 0 },
    use_fingerprint: { active: false, value: 1 }
  });

  const toggleFieldActive = (key) => {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], active: !prev[key].active }
    }));
  };

  const updateFieldValue = (key, value) => {
    setFields((prev) => ({
      ...prev,
      [key]: { ...prev[key], value }
    }));
  };

  const handleSave = () => {
    const updates = {};
    Object.keys(fields).forEach((key) => {
      if (fields[key].active) {
        updates[key] = fields[key].value;
      }
    });

    if (Object.keys(updates).length === 0) {
      alert('Vui lòng tích chọn ít nhất một trường thông tin để cập nhật.');
      return;
    }

    onSave(updates);
  };

  const activeCount = Object.values(fields).filter((f) => f.active).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="modal-backdrop"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="glass modal-card modal-card--md"
            style={{ maxWidth: '620px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
              <div>
                <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={18} color="var(--primary)" />
                  Cập nhật đồng loạt ({selectedCount} profile)
                </h3>
                <p className="modal-subtitle">
                  Tích chọn các trường cần cập nhật. Các trường không chọn sẽ giữ nguyên giá trị cũ.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="modal-close"
                aria-label="Đóng modal cập nhật đồng loạt"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '6px', display: 'flex', flexDirection: 'column', gap: '12px', margin: '12px 0' }}>

              {/* Group */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.group_id.active}
                    onChange={() => toggleFieldActive('group_id')}
                    style={{ cursor: 'pointer' }}
                  />
                  <FolderOpen size={14} color="var(--accent)" />
                  Nhóm (Group)
                </label>
                <select
                  disabled={!fields.group_id.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.group_id.active ? 1 : 0.4 }}
                  value={fields.group_id.value}
                  onChange={(e) => updateFieldValue('group_id', e.target.value === '' ? null : e.target.value)}
                >
                  <option value="">Chưa phân nhóm (Ungrouped)</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              {/* Use Proxy */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.use_proxy.active}
                    onChange={() => toggleFieldActive('use_proxy')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Link size={14} color="#3b82f6" />
                  Sử dụng Proxy
                </label>
                <select
                  disabled={!fields.use_proxy.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.use_proxy.active ? 1 : 0.4 }}
                  value={fields.use_proxy.value}
                  onChange={(e) => updateFieldValue('use_proxy', Number(e.target.value))}
                >
                  <option value={1}>Bật (dùng proxy khi chạy)</option>
                  <option value={0}>Tắt (không dùng proxy)</option>
                </select>
              </div>

              {/* Proxy String */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.proxy.active}
                    onChange={() => toggleFieldActive('proxy')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Link size={14} color="#60a5fa" />
                  Proxy Server
                </label>
                <input
                  type="text"
                  disabled={!fields.proxy.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.proxy.active ? 1 : 0.4 }}
                  placeholder="http://user:pass@host:port"
                  value={fields.proxy.value}
                  onChange={(e) => updateFieldValue('proxy', e.target.value)}
                />
              </div>

              {/* Set Music */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.set_music.active}
                    onChange={() => toggleFieldActive('set_music')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Music size={14} color="var(--accent)" />
                  Set nhạc khi upload
                </label>
                <select
                  disabled={!fields.set_music.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.set_music.active ? 1 : 0.4 }}
                  value={fields.set_music.value}
                  onChange={(e) => updateFieldValue('set_music', Number(e.target.value))}
                >
                  <option value={1}>Bật (Mở Edit video chọn nhạc Favorites)</option>
                  <option value={0}>Tắt</option>
                </select>
              </div>

              {/* Remove Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.remove_title.active}
                    onChange={() => toggleFieldActive('remove_title')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Trash2 size={14} color="var(--error)" />
                  Xóa tiêu đề khi upload
                </label>
                <select
                  disabled={!fields.remove_title.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.remove_title.active ? 1 : 0.4 }}
                  value={fields.remove_title.value}
                  onChange={(e) => updateFieldValue('remove_title', Number(e.target.value))}
                >
                  <option value={1}>Bật (Tự động xóa tiêu đề mặc định)</option>
                  <option value={0}>Tắt (Giữ tiêu đề gốc)</option>
                </select>
              </div>

              {/* Content Check */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.need_content_check.active}
                    onChange={() => toggleFieldActive('need_content_check')}
                    style={{ cursor: 'pointer' }}
                  />
                  <ShieldCheck size={14} color="var(--success)" />
                  Kiểm tra nội dung (Content Check)
                </label>
                <select
                  disabled={!fields.need_content_check.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.need_content_check.active ? 1 : 0.4 }}
                  value={fields.need_content_check.value}
                  onChange={(e) => updateFieldValue('need_content_check', Number(e.target.value))}
                >
                  <option value={1}>Bật (Kiểm tra bản quyền / vi phạm)</option>
                  <option value={0}>Tắt (Bỏ qua kiểm tra)</option>
                </select>
              </div>

              {/* Auto Increment Schedule */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.auto_increment_schedule.active}
                    onChange={() => toggleFieldActive('auto_increment_schedule')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Clock size={14} color="var(--warning)" />
                  Lên nick nối tiếp
                </label>
                <select
                  disabled={!fields.auto_increment_schedule.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.auto_increment_schedule.active ? 1 : 0.4 }}
                  value={fields.auto_increment_schedule.value}
                  onChange={(e) => updateFieldValue('auto_increment_schedule', Number(e.target.value))}
                >
                  <option value={1}>Bật (Lên lịch nối tiếp)</option>
                  <option value={0}>Tắt</option>
                </select>
              </div>

              {/* Schedule Interval */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.schedule_interval.active}
                    onChange={() => toggleFieldActive('schedule_interval')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Clock size={14} color="#8b5cf6" />
                  Khoảng cách thời gian
                </label>
                <select
                  disabled={!fields.schedule_interval.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.schedule_interval.active ? 1 : 0.4 }}
                  value={fields.schedule_interval.value}
                  onChange={(e) => updateFieldValue('schedule_interval', Number(e.target.value))}
                >
                  <option value={5}>5 phút</option>
                  <option value={10}>10 phút</option>
                  <option value={15}>15 phút</option>
                  <option value={20}>20 phút</option>
                </select>
              </div>

              {/* Upload Count */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.upload_count.active}
                    onChange={() => toggleFieldActive('upload_count')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Video size={14} color="var(--primary)" />
                  Số video upload mỗi lần
                </label>
                <input
                  type="number"
                  min="1"
                  disabled={!fields.upload_count.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.upload_count.active ? 1 : 0.4 }}
                  value={fields.upload_count.value}
                  onChange={(e) => updateFieldValue('upload_count', parseInt(e.target.value) || 1)}
                />
              </div>

              {/* Needs Render */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.needs_render.active}
                    onChange={() => toggleFieldActive('needs_render')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Film size={14} color="var(--accent)" />
                  Cần Render Video
                </label>
                <select
                  disabled={!fields.needs_render.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.needs_render.active ? 1 : 0.4 }}
                  value={fields.needs_render.value}
                  onChange={(e) => updateFieldValue('needs_render', Number(e.target.value))}
                >
                  <option value={1}>Bật (Render video trước khi đăng)</option>
                  <option value={0}>Tắt (Upload video gốc)</option>
                </select>
              </div>

              {/* Render Video Long */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.render_video_long.active}
                    onChange={() => toggleFieldActive('render_video_long')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Film size={14} color="#ec4899" />
                  Render Video dài (&gt;60s)
                </label>
                <select
                  disabled={!fields.render_video_long.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.render_video_long.active ? 1 : 0.4 }}
                  value={fields.render_video_long.value}
                  onChange={(e) => updateFieldValue('render_video_long', Number(e.target.value))}
                >
                  <option value={1}>Bật</option>
                  <option value={0}>Tắt</option>
                </select>
              </div>

              {/* Render Concat Video */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.render_concat_video.active}
                    onChange={() => toggleFieldActive('render_concat_video')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Layers size={14} color="#10b981" />
                  Render ghép video (Concat)
                </label>
                <select
                  disabled={!fields.render_concat_video.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.render_concat_video.active ? 1 : 0.4 }}
                  value={fields.render_concat_video.value}
                  onChange={(e) => updateFieldValue('render_concat_video', Number(e.target.value))}
                >
                  <option value={1}>Bật</option>
                  <option value={0}>Tắt</option>
                </select>
              </div>

              {/* Browser Fingerprint */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', minWidth: '210px', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={fields.use_fingerprint.active}
                    onChange={() => toggleFieldActive('use_fingerprint')}
                    style={{ cursor: 'pointer' }}
                  />
                  <Fingerprint size={14} color="#3b82f6" />
                  Browser Fingerprint
                </label>
                <select
                  disabled={!fields.use_fingerprint.active}
                  className="input input-compact"
                  style={{ flex: 1, opacity: fields.use_fingerprint.active ? 1 : 0.4 }}
                  value={fields.use_fingerprint.value}
                  onChange={(e) => updateFieldValue('use_fingerprint', Number(e.target.value))}
                >
                  <option value={1}>Bật (Duy trì vân tay cố định)</option>
                  <option value={0}>Tắt</option>
                </select>
              </div>

            </div>

            {/* Footer Buttons */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {activeCount > 0 ? `Đã chọn ${activeCount} trường để cập nhật` : 'Chưa chọn trường nào'}
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onClose}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={activeCount === 0}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Save size={15} />
                  Lưu đồng loạt ({selectedCount} profiles)
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BulkEditModal;
