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
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="glass"
          style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '20px' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Phân Phối Video</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                {distributionProfiles.length} profile được chọn
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isDistributing}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: isDistributing ? 'not-allowed' : 'pointer',
                opacity: isDistributing ? 0.45 : 1
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {!distributeResult ? (
            <>
              <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
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

                <div style={{
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: 'rgba(99, 102, 241, 0.08)',
                  fontSize: '0.9rem',
                  color: 'var(--text-muted)'
                }}>
                  <strong>{distributionProfiles.length}</strong> profile × <strong>{videosPerProfile}</strong> video = <strong style={{ color: 'var(--accent)' }}>{distributionProfiles.length * videosPerProfile} video</strong> cần phân phối
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
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
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: 'rgba(239, 68, 68, 0.08)',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--error)', marginBottom: '8px' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontWeight: '600' }}>Lỗi</span>
                  </div>
                  <p style={{ color: 'var(--text-muted)', margin: 0 }}>{distributeResult.error}</p>
                </div>
              ) : (
                <div style={{
                  padding: '20px',
                  borderRadius: '16px',
                  background: distributeResult.missing > 0
                    ? 'rgba(251, 191, 36, 0.08)'
                    : 'rgba(34, 197, 94, 0.08)',
                  marginBottom: '20px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: distributeResult.missing > 0 ? '#FBBF24' : 'var(--success)',
                    marginBottom: '12px'
                  }}>
                    {distributeResult.missing > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                    <span style={{ fontWeight: '600' }}>
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
                      <div key={p.profileId} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.04)',
                        fontSize: '0.85rem'
                      }}>
                        <span style={{ fontWeight: '500' }}>{p.profileName}</span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          {p.count} video → <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{p.folder}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
