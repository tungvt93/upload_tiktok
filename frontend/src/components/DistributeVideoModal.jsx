import React from 'react';
import { X, RefreshCw, Play, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Modal to distribute videos from a source folder to the selected profiles.
const DistributeVideoModal = ({
  open,
  distributionProfiles,
  sourceFolder,
  setSourceFolder,
  videosPerProfile,
  setVideosPerProfile,
  isDistributing,
  distributeResult,
  setDistributeResult,
  handleDistribute,
  onClose
}) => (
  <AnimatePresence>
    {open && (
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
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <h3 className="modal-title">Phân Phối Video</h3>
              <p className="modal-subtitle">
                {distributionProfiles.length} profile được chọn
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isDistributing}
              className="modal-close"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {!distributeResult ? (
            <>
              <div className="modal-body" style={{ marginBottom: '20px' }}>
                <div className="input-group">
                  <label>Folder Nguồn</label>
                  <input
                    className="input"
                    placeholder="/path/to/videos"
                    value={sourceFolder}
                    onChange={(e) => setSourceFolder(e.target.value)}
                    disabled={isDistributing}
                    autoFocus
                  />
                </div>

                <div className="input-group">
                  <label>Số lượng video mỗi profile</label>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={videosPerProfile}
                    onChange={(e) => setVideosPerProfile(Math.max(1, parseInt(e.target.value) || 1))}
                    disabled={isDistributing}
                  />
                </div>

                <div className="dist-panel">
                  <strong>{distributionProfiles.length}</strong> profile × <strong>{videosPerProfile}</strong> video = <strong style={{ color: 'var(--accent)' }}>{distributionProfiles.length * videosPerProfile} video</strong> cần phân phối
                </div>
              </div>

              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={onClose}
                  disabled={isDistributing}
                >
                  Huỷ
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleDistribute}
                  disabled={isDistributing || !sourceFolder.trim()}
                >
                  {isDistributing ? (
                    <>
                      <RefreshCw size={18} className="animate-pulse" />
                      Đang phân phối...
                    </>
                  ) : (
                    <>
                      <Play size={18} />
                      Phân Phối
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Result display */}
              {distributeResult.error ? (
                <div className="result-panel result-panel--error">
                  <div className="result-panel-title" style={{ color: 'var(--error)' }}>
                    <AlertCircle size={20} />
                    <span>Lỗi</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>{distributeResult.error}</p>
                </div>
              ) : (
                <div className={`result-panel ${distributeResult.missing > 0 ? 'result-panel--warning' : 'result-panel--success'}`}>
                  <div
                    className="result-panel-title"
                    style={{ color: distributeResult.missing > 0 ? '#FBBF24' : 'var(--success)' }}
                  >
                    {distributeResult.missing > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    <span>
                      {distributeResult.missing > 0
                        ? `Đã phân phối ${distributeResult.totalDistributed}/${distributeResult.totalExpected} video`
                        : `Đã phân phối thành công ${distributeResult.totalDistributed} video!`
                      }
                    </span>
                  </div>
                  {distributeResult.missing > 0 && (
                    <p style={{ color: 'var(--text-muted)', margin: '0 0 12px 0', fontSize: '0.9rem' }}>
                      Thiếu {distributeResult.missing} video (folder nguồn không đủ)
                    </p>
                  )}
                  {/* Per-profile breakdown */}
                  <div style={{ display: 'grid', gap: '6px' }}>
                    {distributeResult.profiles.map(p => (
                      <div key={p.profileId} className="summary-row">
                        <span style={{ fontWeight: '500' }}>{p.profileName}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {p.count} video → <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{p.folder}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="modal-footer">
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setDistributeResult(null);
                    onClose();
                    setSourceFolder('');
                  }}
                >
                  Đóng
                </button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default DistributeVideoModal;
