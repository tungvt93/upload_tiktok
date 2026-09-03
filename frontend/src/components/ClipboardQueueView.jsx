import React, { useState } from 'react';
import { Clipboard, Copy, Eye, EyeOff, RefreshCw, RotateCcw, Trash2, XCircle } from 'lucide-react';

const STATUS_META = {
  pending: { label: 'Đang chờ', color: 'var(--text-muted)' },
  downloading: { label: 'Đang tải', color: 'var(--accent)' },
  done: { label: 'Hoàn tất', color: 'var(--success)' },
  failed: { label: 'Lỗi', color: 'var(--error)' }
};

const formatTime = (value) => {
  if (!value) return '—';
  return new Date(value.replace(' ', 'T') + 'Z').toLocaleString('vi-VN');
};

// The "Clipboard Queue" tab: shows the mobile-app API key/endpoint to configure
// on the phone, plus the live list of clipboard-triggered download jobs.
const ClipboardQueueView = ({
  config,
  clipboardQueue,
  retryClipboardJob,
  deleteClipboardJob,
  clearClipboardQueue,
  regenerateClipboardApiKey
}) => {
  const [showKey, setShowKey] = useState(false);
  const apiKey = config.clipboardApiKey || '';
  const endpoint = `${window.location.protocol}//${window.location.hostname}:3010/api/clipboard/enqueue`;

  const copyToClipboard = (text) => {
    navigator.clipboard?.writeText(text);
  };

  const counts = clipboardQueue.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <section>
      <div className="page-header">
        <div>
          <h2 className="page-title">Clipboard Queue</h2>
          <p className="page-subtitle" style={{ maxWidth: '640px', lineHeight: 1.5 }}>
            Điện thoại copy link video → gọi API bên dưới → backend xếp hàng và tự tải về{' '}
            <code>uploads/_inbox</code>.
          </p>
        </div>
      </div>

      <div className="glass settings-card" style={{ marginBottom: '28px' }}>
        <div className="settings-stack">
          <div>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.95rem', fontWeight: '600' }}>
              Endpoint cho app mobile
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="input-with-icon" style={{ flex: 1 }}>
                <Clipboard size={18} />
                <input className="input" value={`POST ${endpoint}`} readOnly />
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => copyToClipboard(endpoint)}
                aria-label="Copy endpoint"
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="input-hint">
              Header: <code>x-api-key: &lt;key bên dưới&gt;</code>, Content-Type: <code>application/json</code>.
              Body: <code>{'{ "url": "<link vừa copy>", "device_id": "<tên máy, optional>" }'}</code>.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.95rem', fontWeight: '600' }}>
              x-api-key
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div className="input-with-icon" style={{ flex: 1 }}>
                <Clipboard size={18} />
                <input
                  className="input"
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  readOnly
                />
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setShowKey((v) => !v)}
                aria-label={showKey ? 'Ẩn key' : 'Hiện key'}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                type="button"
                className="icon-btn"
                onClick={() => copyToClipboard(apiKey)}
                aria-label="Copy key"
              >
                <Copy size={16} />
              </button>
            </div>
            <p className="input-hint">
              Dán key này vào app/automation trên điện thoại. Tạo key mới sẽ làm key cũ hết hạn ngay lập tức —
              cần cập nhật lại mọi thiết bị.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => {
              if (window.confirm('Tạo API key mới? Key cũ sẽ ngừng hoạt động ngay.')) {
                regenerateClipboardApiKey();
              }
            }}
          >
            <RefreshCw size={16} />
            Tạo API key mới
          </button>
        </div>
      </div>

      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <span
              key={key}
              className="badge"
              style={{ color: meta.color, border: `1px solid ${meta.color}` }}
            >
              {meta.label}: {counts[key] || 0}
            </span>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => clearClipboardQueue()}
          disabled={!(counts.done || counts.failed)}
        >
          <Trash2 size={16} />
          Dọn video hoàn tất/lỗi
        </button>
      </div>

      {clipboardQueue.length === 0 ? (
        <div
          className="glass"
          style={{
            textAlign: 'center',
            padding: '56px 32px',
            borderRadius: '24px',
            color: 'var(--text-muted)',
            border: '2px dashed var(--border)'
          }}
        >
          <Clipboard size={40} style={{ margin: '0 auto 16px', opacity: 0.35 }} />
          <p style={{ color: 'var(--text)', fontWeight: '600', marginBottom: '8px' }}>Chưa có video nào trong hàng chờ</p>
          <p style={{ fontSize: '0.9rem' }}>Copy một link video trên điện thoại để bắt đầu.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {clipboardQueue.map((job) => {
            const meta = STATUS_META[job.status] || STATUS_META.pending;
            return (
              <div key={job.id} className="glass group-row" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                  <a
                    href={job.source_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'block',
                      color: 'var(--text)',
                      fontWeight: '600',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {job.source_url}
                  </a>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                    {job.device_id ? `Thiết bị: ${job.device_id} · ` : ''}
                    {formatTime(job.created_at)}
                  </p>
                  {job.status === 'failed' && job.error && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--error)', margin: '4px 0 0' }}>
                      <XCircle size={13} style={{ verticalAlign: '-2px', marginRight: '4px' }} />
                      {job.error}
                    </p>
                  )}
                  {job.status === 'done' && job.file_path && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0', wordBreak: 'break-all' }}>
                      {job.file_path}
                    </p>
                  )}
                </div>

                <span
                  className="badge"
                  style={{ color: meta.color, border: `1px solid ${meta.color}`, whiteSpace: 'nowrap' }}
                >
                  {meta.label}
                </span>

                {job.status === 'failed' && (
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => retryClipboardJob(job.id)}
                    aria-label="Thử lại"
                    title="Thử lại"
                  >
                    <RotateCcw size={18} />
                  </button>
                )}

                {job.status !== 'downloading' && (
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    onClick={() => deleteClipboardJob(job.id)}
                    aria-label="Xóa"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default ClipboardQueueView;
