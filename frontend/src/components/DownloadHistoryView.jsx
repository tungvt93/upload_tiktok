import React from 'react';
import {
  Search,
  FileDown,
  Trash2,
  Video,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  History,
} from 'lucide-react';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'PENDING', label: 'Chờ' },
  { value: 'QUEUED', label: 'Trong hàng đợi' },
  { value: 'PROCESSING', label: 'Đang tải' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'FAILED', label: 'Thất bại' },
];

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Ngày tạo' },
  { value: 'downloaded_at', label: 'Ngày tải' },
  { value: 'title', label: 'Tiêu đề' },
  { value: 'author', label: 'Tác giả' },
  { value: 'duration', label: 'Thời lượng' },
  { value: 'status', label: 'Trạng thái' },
];

const DownloadHistoryView = ({
  history,
  historyQuery,
  setHistoryQuery,
  loadingHistory,
  deleteVideo,
  downloadFile,
}) => {
  const { data = [], pagination = { page: 1, pageSize: 10, total: 0, totalPages: 1 } } = history;

  const updateQuery = (patch) => {
    setHistoryQuery((prev) => ({ ...prev, ...patch, page: patch.page ?? 1 }));
  };

  const toggleSortOrder = () => {
    setHistoryQuery((prev) => ({
      ...prev,
      sortOrder: prev.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  };

  return (
    <section>
      <div className="page-header">
        <div>
          <h2 className="page-title">Download History</h2>
          <p className="page-subtitle" style={{ maxWidth: '640px', lineHeight: 1.5 }}>
            Lịch sử các video đã tải: tìm kiếm, sắp xếp và lọc theo trạng thái.
          </p>
        </div>
        <div className="toolbar">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setHistoryQuery((p) => ({ ...p }))}
            disabled={loadingHistory}
          >
            <RefreshCw size={14} className={loadingHistory ? 'animate-pulse' : ''} /> Làm mới
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass card" style={{ marginBottom: 20, padding: '16px 20px' }}>
        <div className="toolbar" style={{ flexWrap: 'wrap' }}>
          <div className="input-with-icon" style={{ flex: '1 1 260px' }}>
            <Search size={16} />
            <input
              className="input"
              placeholder="Tìm theo tiêu đề, tác giả hoặc video id..."
              value={historyQuery.search}
              onChange={(e) => updateQuery({ search: e.target.value })}
            />
          </div>
          <select
            className="input"
            style={{ width: 190 }}
            value={historyQuery.status}
            onChange={(e) => updateQuery({ status: e.target.value })}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: 170 }}
            value={historyQuery.sortBy}
            onChange={(e) => updateQuery({ sortBy: e.target.value })}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button className="btn btn-secondary btn-sm" onClick={toggleSortOrder} title="Đổi thứ tự sắp xếp">
            {historyQuery.sortOrder === 'desc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
            {historyQuery.sortOrder === 'desc' ? 'Giảm dần' : 'Tăng dần'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="glass card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Video</th>
                <th>Thời lượng</th>
                <th>Ngày đăng</th>
                <th>Ngày tải</th>
                <th>Trạng thái</th>
                <th>File</th>
                <th style={{ textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {data.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty-state empty-state--compact" style={{ marginTop: 0 }}>
                      <div className="empty-state-icon">
                        <History size={26} />
                      </div>
                      <p className="empty-state-title">Chưa có video nào</p>
                      <p>{loadingHistory ? 'Đang tải...' : 'Tải video ở trang “Video Downloads” để chúng xuất hiện ở đây.'}</p>
                    </div>
                  </td>
                </tr>
              )}

              {data.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="video-cell">
                      {v.cover_url ? (
                        <img className="thumb" src={v.cover_url} alt="" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="thumb-placeholder"><Video size={18} /></div>
                      )}
                      <div className="video-cell__info">
                        <div className="video-cell__title" title={v.title}>{v.title}</div>
                        <div className="video-cell__meta">
                          👤 {v.author} · #{v.douyin_video_id}
                          {v.creator_name ? ` · 📡 ${v.creator_name}` : ''}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>{formatDuration(v.duration)}</td>
                  <td>{formatDate(v.published_at)}</td>
                  <td>{formatDate(v.downloaded_at || v.updated_at)}</td>
                  <td>
                    <span className={`status-badge status-badge--${v.status || 'PENDING'}`}>
                      <span className="status-dot-badge" />
                      {formatStatus(v.status)}
                    </span>
                  </td>
                  <td>
                    {v.file_path ? (
                      <span className="file-path" title={v.file_path}>{v.file_path}</span>
                    ) : (
                      <span className="file-path" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      {v.status === 'COMPLETED' && (
                        <button className="btn btn-green btn-sm" onClick={() => downloadFile(v.id)} title="Tải file về máy">
                          <FileDown size={14} /> File
                        </button>
                      )}
                      <button
                        className="btn btn-danger btn-sm"
                        title="Xoá khỏi lịch sử"
                        onClick={() => {
                          if (window.confirm(`Xoá video "${v.title}" khỏi lịch sử?`)) deleteVideo(v.id);
                        }}
                      >
                        <Trash2 size={14} /> Xoá
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.length > 0 && (
          <div className="pagination">
            <div className="pagination__info">
              Trang {pagination.page} / {pagination.totalPages} — {pagination.total} video
            </div>
            <div className="pagination__controls">
              <select
                className="input"
                style={{ width: 110, padding: '8px 10px' }}
                value={historyQuery.pageSize}
                onChange={(e) => updateQuery({ pageSize: Number(e.target.value) })}
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n} / trang</option>
                ))}
              </select>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pagination.page <= 1}
                onClick={() => updateQuery({ page: pagination.page - 1 })}
              >
                <ChevronLeft size={14} /> Trước
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => updateQuery({ page: pagination.page + 1 })}
              >
                Sau <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

function formatDuration(seconds) {
  const s = Number(seconds || 0);
  if (s <= 0) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

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

export default DownloadHistoryView;
