import React, { useState } from 'react';
import {
  UserPlus,
  Rss,
  UserCheck,
  Trash2,
  X,
  Loader2,
  RefreshCw,
  Play,
  Clock,
  CheckCircle2,
  Video,
} from 'lucide-react';

const emptyForm = {
  nickname: '',
  unique_id: '',
  url: '',
  signature: '',
  is_active: true,
};

const CreatorsView = ({
  creators,
  loadingCreators,
  checkingCreatorId,
  checkingAll,
  registerCreator,
  updateCreator,
  deleteCreator,
  checkCreator,
  checkAllCreators,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [formError, setFormError] = useState(null);

  const openCreate = () => {
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.nickname.trim()) {
      setFormError('Nickname / tên creator là bắt buộc');
      return;
    }
    setSaving(true);
    setFormError(null);
    const payload = {
      nickname: form.nickname.trim(),
      unique_id: form.unique_id.trim() || undefined,
      url: form.url.trim() || undefined,
      signature: form.signature.trim() || undefined,
      is_active: form.is_active ? 1 : 0,
    };
    const result = await registerCreator(payload);
    setSaving(false);
    if (result) {
      setShowModal(false);
    }
  };

  const handleToggleActive = async (creator) => {
    await updateCreator(creator.id, { is_active: creator.is_active ? 0 : 1 });
  };

  const handleCheck = async (creator) => {
    const result = await checkCreator(creator.id);
    if (result) setLastResult({ name: creator.nickname, ...result });
  };

  const handleCheckAll = async () => {
    const result = await checkAllCreators();
    if (result) setLastResult({ name: 'All creators', ...result });
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h2 className="page-title">Creator Monitoring</h2>
          <p className="page-subtitle" style={{ maxWidth: '660px', lineHeight: 1.5 }}>
            Đăng ký creator Douyin để hệ thống tự kiểm tra video mới và tự động tạo job tải
            — lịch chạy mỗi <strong>30 phút</strong>.
          </p>
        </div>
        <div className="toolbar">
          <button
            className="btn btn-purple"
            onClick={handleCheckAll}
            disabled={checkingAll || creators.length === 0}
          >
            {checkingAll ? <Loader2 size={16} className="animate-pulse" /> : <RefreshCw size={16} />}
            Check tất cả
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            <UserPlus size={16} /> Thêm Creator
          </button>
        </div>
      </div>

      <div className="notice notice--info" style={{ marginBottom: 24 }}>
        <Clock size={16} />
        <span>
          Scheduler tự động quét các creator đang bật (<strong>is_active</strong>) mỗi 30 phút.
          Có thể bấm “Check tất cả” để chạy kiểm tra ngay lập tức.
        </span>
      </div>

      {/* Check result */}
      {lastResult && (
        <div
          className="result-panel"
          style={{
            background: lastResult.error ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)',
          }}
        >
          <div className="result-panel-title">
            <CheckCircle2 size={18} color={lastResult.error ? '#EF4444' : '#22C55E'} />
            <span>Kết quả kiểm tra: {lastResult.name}</span>
            <button className="icon-btn" onClick={() => setLastResult(null)}>
              <X size={16} />
            </button>
          </div>
          {lastResult.error ? (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{lastResult.error}</p>
          ) : (
            <div className="summary-row">
              <span>Tìm thấy: <strong>{lastResult.found ?? 0}</strong> video mới · Đã tạo job: <strong>{lastResult.created ?? 0}</strong> · Bỏ qua: <strong>{lastResult.skipped ?? 0}</strong></span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Creators grid */}
      {loadingCreators && creators.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <Loader2 size={26} className="animate-pulse" style={{ margin: '0 auto 20px' }} />
          <p>Đang tải danh sách creator...</p>
        </div>
      ) : creators.length === 0 ? (
        <div className="empty-state empty-state--compact">
          <div className="empty-state-icon">
            <Rss size={26} />
          </div>
          <p className="empty-state-title">Chưa có creator nào</p>
          <p>Bấm “Thêm Creator” để đăng ký một hồ sơ Douyin và bắt đầu theo dõi video mới.</p>
        </div>
      ) : (
        <div className="info-grid">
          {creators.map((creator) => {
            const checking = checkingCreatorId === creator.id;
            return (
              <div key={creator.id} className="glass card creator-card">
                <div className="creator-card__head">
                  {creator.avatar_url ? (
                    <img
                      className="creator-avatar"
                      style={{ borderRadius: '14px' }}
                      src={creator.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="creator-avatar">
                      {(creator.nickname || '?').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="creator-card__identity">
                    <div className="creator-card__name">
                      {creator.nickname}
                      <span className={`status-badge status-badge--${creator.is_active ? 'PROCESSING' : 'CANCELLED'}`}>
                        <span className="status-dot-badge" />
                        {creator.is_active ? 'Đang theo dõi' : 'Đã tắt'}
                      </span>
                    </div>
                    <div className="creator-card__handle">
                      {creator.unique_id ? `@${creator.unique_id}` : '—'}
                      {creator.douyin_id ? ` · ${creator.douyin_id}` : ''}
                    </div>
                  </div>
                </div>

                {creator.signature && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {creator.signature}
                  </p>
                )}

                <div className="meta-chips">
                  <span className="meta-chip"><Video size={12} /> {creator.video_count || 0} video</span>
                  <span className="meta-chip">
                    <CheckCircle2 size={12} /> {creator.downloaded_count || 0} đã tải
                  </span>
                  {creator.url && (
                    <span className="meta-chip" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {creator.url}
                    </span>
                  )}
                </div>

                <div className="creator-card__footer">
                  <div className="creator-stats">
                    <span>
                      Kiểm tra: <strong>{creator.last_checked_at ? new Date(creator.last_checked_at).toLocaleTimeString() : 'chưa'}</strong>
                    </span>
                  </div>
                  <div className="toolbar-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleToggleActive(creator)}
                      title={creator.is_active ? 'Tạm ngừng theo dõi' : 'Bật theo dõi'}
                    >
                      <UserCheck size={14} /> {creator.is_active ? 'Tắt' : 'Bật'}
                    </button>
                    <button
                      className="btn btn-purple btn-sm"
                      onClick={() => handleCheck(creator)}
                      disabled={checking}
                    >
                      {checking ? <Loader2 size={14} className="animate-pulse" /> : <Play size={14} />}
                      {checking ? 'Đang check...' : 'Check'}
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        if (window.confirm(`Xoá creator "${creator.nickname}"?`)) deleteCreator(creator.id);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-card glass" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="modal-title">Thêm Creator Douyin</div>
                <div className="modal-subtitle">Đăng ký hồ sơ creator để hệ thống theo dõi video mới.</div>
              </div>
              <button className="modal-close" onClick={() => setShowModal(false)} disabled={saving}>
                <X size={20} />
              </button>
            </div>

            <form className="modal-body" onSubmit={handleSave}>
              <div className="input-group">
                <label>Tên creator / nickname *</label>
                <input
                  className="input"
                  placeholder="VD: 美食小分队"
                  value={form.nickname}
                  onChange={(e) => setForm({ ...form, nickname: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="input-group">
                <label>Unique ID (tùy chọn)</label>
                <input
                  className="input"
                  placeholder="@unique_id"
                  value={form.unique_id}
                  onChange={(e) => setForm({ ...form, unique_id: e.target.value })}
                  disabled={saving}
                />
              </div>

              <div className="input-group">
                <label>URL trang creator (bắt buộc để check video mới)</label>
                <input
                  className="input"
                  placeholder="https://www.douyin.com/user/xxxx hoặc link rút gọn"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  disabled={saving}
                />
                <p className="input-hint">Dùng link rút gọn hoặc link đầy đủ tới trang cá nhân Douyin.</p>
              </div>

              <div className="input-group">
                <label>Giới thiệu / signature (tùy chọn)</label>
                <textarea
                  className="input"
                  rows={2}
                  style={{ width: '100%', resize: 'vertical' }}
                  placeholder="Mô tả ngắn về creator..."
                  value={form.signature}
                  onChange={(e) => setForm({ ...form, signature: e.target.value })}
                  disabled={saving}
                />
              </div>

              <label className="toggle-row" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  disabled={saving}
                />
                <div className="toggle-body">
                  <div className="toggle-title">Bật theo dõi tự động</div>
                  <div className="toggle-desc">Tự động check video mới mỗi 30 phút</div>
                </div>
              </label>

              {formError && (
                <div className="result-panel result-panel--error" style={{ marginBottom: 0 }}>
                  <p style={{ fontSize: '0.85rem' }}>{formError}</p>
                </div>
              )}

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                  Huỷ
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-pulse" /> : <UserPlus size={16} />}
                  {saving ? 'Đang lưu...' : 'Lưu creator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

export default CreatorsView;
