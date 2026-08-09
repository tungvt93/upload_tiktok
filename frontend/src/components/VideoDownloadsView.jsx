import React from 'react';
import {
  Link as LinkIcon,
  Download,
  Video,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileDown,
  Loader2,
  Layers,
} from 'lucide-react';

// "Video Downloads" view — the main Douyin Downloader page.
// Supports:
//   - Single video download from a URL
//   - Batch download (paste many URLs, one per line)
//   - Live job progress streamed via SSE (jobs prop is kept fresh by useDouyin)
const VideoDownloadsView = ({
  url,
  setUrl,
  batchText,
  setBatchText,
  mode,
  setMode,
  isSubmitting,
  error,
  message,
  jobs,
  stats,
  downloadSingle,
  downloadBatch,
  retryJob,
  downloadFile,
}) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === 'single') downloadSingle();
    else downloadBatch();
  };

  const activeJobs = (jobs || []).filter((j) =>
    ['PENDING', 'QUEUED', 'PROCESSING'].includes(j.status)
  );
  const completedJobs = (jobs || []).filter((j) => j.status === 'COMPLETED');
  const failedJobs = (jobs || []).filter((j) => j.status === 'FAILED');

  return (
    <section>
      <div className="page-header">
        <div>
          <h2 className="page-title">Video Downloads</h2>
          <p className="page-subtitle" style={{ maxWidth: '660px', lineHeight: 1.5 }}>
            Tải video từ Douyin (抖音) về máy — hỗ trợ link rút gọn <code>v.douyin.com/xxxx</code>.
            Nhập URL để tải từng video, hoặc dán nhiều URL để tải hàng loạt.
          </p>
        </div>
        <div className="toolbar">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              if (window.confirm('Refresh live jobs?')) window.location.reload();
            }}
          >
            <Loader2 size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Live status summary */}
      {(stats || activeJobs.length > 0) && (
        <div className="stat-grid" style={{ marginBottom: 24 }}>
          <div className="glass stat-card">
            <div className="stat-card__icon" style={{ background: 'rgba(56,189,248,.12)', color: '#38bdf8' }}>
              <Download size={18} />
            </div>
            <div className="stat-card__value">{activeJobs.length}</div>
            <div className="stat-card__label">Đang tải / chờ</div>
          </div>
          <div className="glass stat-card">
            <div className="stat-card__icon" style={{ background: 'rgba(16,185,129,.12)', color: '#10b981' }}>
              <CheckCircle2 size={18} />
            </div>
            <div className="stat-card__value">{completedJobs.length}</div>
            <div className="stat-card__label">Hoàn thành (gần đây)</div>
          </div>
          <div className="glass stat-card">
            <div className="stat-card__icon" style={{ background: 'rgba(239,68,68,.12)', color: '#ef4444' }}>
              <AlertTriangle size={18} />
            </div>
            <div className="stat-card__value">{failedJobs.length}</div>
            <div className="stat-card__label">Thất bại (gần đây)</div>
          </div>
          {stats && (
            <div className="glass stat-card">
              <div className="stat-card__icon" style={{ background: 'rgba(255,63,182,.12)', color: '#ff3fb6' }}>
                <Video size={18} />
              </div>
              <div className="stat-card__value">{stats.totalVideos}</div>
              <div className="stat-card__label">Tổng video đã lưu</div>
            </div>
          )}
        </div>
      )}

      {/* Download form */}
      <form className="glass card" style={{ marginBottom: 24 }} onSubmit={handleSubmit}>
        <div className="toolbar" style={{ marginBottom: 16, justifyContent: 'space-between' }}>
          <div className="segmented" role="tablist">
            <button
              type="button"
              className={mode === 'single' ? 'active' : ''}
              onClick={() => setMode('single')}
            >
              <LinkIcon size={15} /> Single URL
            </button>
            <button
              type="button"
              className={mode === 'batch' ? 'active' : ''}
              onClick={() => setMode('batch')}
            >
              <Layers size={15} /> Batch
            </button>
          </div>
          {mode === 'batch' && batchText.trim() && (
            <span className="selection-count">
              {batchText.split(/\r?\n/).filter((s) => s.trim()).length} URL(s)
            </span>
          )}
        </div>

        {mode === 'single' ? (
          <div className="input-with-icon" style={{ marginBottom: 14 }}>
            <LinkIcon size={18} />
            <input
              className="input"
              placeholder="https://v.douyin.com/xxxx  hoặc https://www.douyin.com/video/xxxx"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={isSubmitting}
            />
          </div>
        ) : (
          <textarea
            className="input"
            rows={6}
            style={{ width: '100%', resize: 'vertical', fontFamily: 'ui-monospace, monospace' }}
            placeholder={'https://v.douyin.com/1\nhttps://v.douyin.com/2\nhttps://v.douyin.com/3'}
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            disabled={isSubmitting}
          />
        )}

        <div className="toolbar" style={{ marginTop: 4 }}>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-pulse" /> Đang tạo job...
              </>
            ) : mode === 'single' ? (
              <>
                <Download size={16} /> Tải video
              </>
            ) : (
              <>
                <Download size={16} /> Tải tất cả ({batchText.split(/\r?\n/).filter((s) => s.trim()).length || 0})
              </>
            )}
          </button>
        </div>

        <p className="input-hint">
          Douyin quét bot khá gắt — nếu tải thất bại, hãy thử thêm biến môi trường{' '}
          <code>DOUYIN_COOKIES</code>, <code>HTTP_PROXY</code>, hoặc chạy ở chế độ demo{' '}
          <code>DOUYIN_MOCK=1</code>.
        </p>
      </form>

      {/* Error / success notices */}
      {error && (
        <div className="result-panel result-panel--error">
          <div className="result-panel-title">
            <AlertTriangle size={18} color="#EF4444" />
            <span>Lỗi</span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{error}</p>
        </div>
      )}
      {message && (
        <div className="result-panel result-panel--success">
          <div className="result-panel-title">
            <CheckCircle2 size={18} color="#22C55E" />
            <span>{message}</span>
          </div>
        </div>
      )}

      {/* Live jobs */}
      <div className="glass card">
        <div className="field-title" style={{ marginBottom: 14 }}>
          <Layers size={16} /> Jobs gần đây ({jobs?.length || 0})
        </div>

        {jobs && jobs.length > 0 ? (
          <div>
            {jobs.slice(0, 15).map((job) => {
              const isWorking = ['PENDING', 'QUEUED', 'PROCESSING'].includes(job.status);
              return (
                <div key={job.id} className="job-row glass" style={{ boxShadow: 'none' }}>
                  {job.cover_url ? (
                    <img className="thumb" src={job.cover_url} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="thumb-placeholder">
                      <Video size={18} />
                    </div>
                  )}
                  <div className="job-row__main">
                    <div className="job-row__title" title={job.title || job.source_url}>
                      {job.title || job.source_url || 'Untitled video'}
                    </div>
                    <div className="job-row__meta">
                      <span>👤 {job.author || 'Unknown'}</span>
                      <span>#{job.douyin_video_id || job.video_id?.slice(0, 8)}</span>
                      {job.file_path && <span className="file-path" style={{ maxWidth: 200 }}>{job.file_path}</span>}
                    </div>
                    {isWorking && (
                      <div className="progress" style={{ marginTop: 8 }}>
                        <div className="progress-bar" style={{ width: `${job.progress || 0}%` }} />
                      </div>
                    )}
                    {job.status === 'FAILED' && job.error && (
                      <div style={{ fontSize: '0.76rem', color: '#EF4444', marginTop: 4 }}>{job.error}</div>
                    )}
                  </div>
                  <div className="job-row__actions">
                    <span className={`status-badge status-badge--${job.status || 'PENDING'}`}>
                      <span className="status-dot-badge" />
                      {formatStatus(job.status)}
                      {isWorking ? ` ${job.progress || 0}%` : ''}
                    </span>
                    {job.status === 'COMPLETED' && (
                      <button className="btn btn-green btn-sm" onClick={() => downloadFile(job.video_id)}>
                        <FileDown size={14} /> File
                      </button>
                    )}
                    {job.status === 'FAILED' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => retryJob(job.id)}>
                        <RotateCcw size={14} /> Retry
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state empty-state--compact">
            <div className="empty-state-icon">
              <Video size={26} />
            </div>
            <p className="empty-state-title">Chưa có job tải nào</p>
            <p>Nhập URL ở trên và bấm “Tải video” để bắt đầu. Tiến độ sẽ hiện ra đây theo thời gian thực.</p>
          </div>
        )}
      </div>
    </section>
  );
};

function formatStatus(status) {
  const map = {
    PENDING: 'Chờ',
    QUEUED: 'Trong hàng đợi',
    PROCESSING: 'Đang tải',
    COMPLETED: 'Hoàn thành',
    FAILED: 'Thất bại',
    CANCELLED: 'Đã huỷ',
  };
  return map[status] || status;
}

export default VideoDownloadsView;
