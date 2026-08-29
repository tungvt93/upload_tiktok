import React from 'react';
import { Share2, FolderOpen, Play, RefreshCw, AlertCircle, CheckCircle2, Folder, Layers, UserCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const DistributionView = ({
  groups = [],
  distGroupId,
  setDistGroupId,
  distGroupProfiles = [],
  sourceFolder,
  setSourceFolder,
  videosPerProfile,
  setVideosPerProfile,
  isDistributing,
  distributeResult,
  setDistributeResult,
  handleSelectDistSourceFolder,
  handleDistribute
}) => {
  const selectedGroupObj = groups.find(g => g.id === distGroupId);
  const selectedGroupName = distGroupId === 'all'
    ? 'Tất Cả Profile'
    : distGroupId === 'ungrouped'
      ? 'Chưa Phân Nhóm'
      : (selectedGroupObj?.name || 'Nhóm Đã Chọn');

  return (
    <section>
      <div className="page-header">
        <div>
          <h2 className="page-title">Phân Phối Video</h2>
          <p className="page-subtitle">Chọn nhóm profile và chia đều video từ folder nguồn</p>
        </div>
      </div>

      {/* Top Controls: Group Selector & Distribution Form */}
      <div className="glass card" style={{ padding: '24px', marginBottom: '24px', borderRadius: '16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          
          {/* Group Selector */}
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
              <Layers size={16} color="var(--accent)" />
              <span>Chọn Nhóm Profile</span>
            </label>
            <select
              className="input"
              value={distGroupId}
              onChange={(e) => setDistGroupId(e.target.value)}
              disabled={isDistributing}
            >
              <option value="all">Tất cả profile ({distGroupProfiles.length})</option>
              <option value="ungrouped">Chưa phân nhóm</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {/* Source Folder Input with Select Button */}
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
              <Folder size={16} color="var(--accent)" />
              <span>Folder Nguồn</span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                className="input"
                placeholder="/path/to/videos"
                value={sourceFolder}
                onChange={(e) => setSourceFolder(e.target.value)}
                disabled={isDistributing}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSelectDistSourceFolder}
                disabled={isDistributing}
                title="Chọn thư mục"
              >
                <FolderOpen size={16} /> Chọn
              </button>
            </div>
          </div>

          {/* Videos Per Profile */}
          <div className="input-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
              <Share2 size={16} color="var(--accent)" />
              <span>Số video / profile</span>
            </label>
            <input
              className="input"
              type="number"
              min={1}
              value={videosPerProfile}
              onChange={(e) => setVideosPerProfile(Math.max(1, parseInt(e.target.value) || 1))}
              disabled={isDistributing}
            />
          </div>
        </div>

        {/* Calculation summary bar */}
        <div
          className="dist-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            justify: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '16px 20px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <div style={{ fontSize: '0.95rem' }}>
            Nhóm <strong>{selectedGroupName}</strong>: <strong>{distGroupProfiles.length}</strong> profile × <strong>{videosPerProfile}</strong> video = <strong style={{ color: 'var(--accent)', fontSize: '1.05rem' }}>{distGroupProfiles.length * videosPerProfile} video</strong> cần phân phối
          </div>
          <button
            className="btn btn-primary"
            onClick={handleDistribute}
            disabled={isDistributing || !sourceFolder.trim() || distGroupProfiles.length === 0}
            style={{ padding: '10px 24px' }}
          >
            {isDistributing ? (
              <>
                <RefreshCw size={18} className="animate-pulse" />
                Đang phân phối...
              </>
            ) : (
              <>
                <Play size={18} />
                Bắt Đầu Phân Phối
              </>
            )}
          </button>
        </div>
      </div>

      {/* Distribution Results Display */}
      {distributeResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: '24px' }}
        >
          {distributeResult.error ? (
            <div className="result-panel result-panel--error" style={{ padding: '20px', borderRadius: '16px' }}>
              <div className="result-panel-title" style={{ color: 'var(--error)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem', fontWeight: '600' }}>
                <AlertCircle size={22} />
                <span>Lỗi Phân Phối Video</span>
              </div>
              <p style={{ color: 'var(--text-muted)', margin: 0 }}>{distributeResult.error}</p>
            </div>
          ) : (
            <div className={`result-panel ${distributeResult.missing > 0 ? 'result-panel--warning' : 'result-panel--success'}`} style={{ padding: '20px', borderRadius: '16px' }}>
              <div
                className="result-panel-title"
                style={{
                  color: distributeResult.missing > 0 ? '#FBBF24' : 'var(--success)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '1.1rem',
                  fontWeight: '600'
                }}
              >
                {distributeResult.missing > 0 ? <AlertCircle size={22} /> : <CheckCircle2 size={22} />}
                <span>
                  {distributeResult.missing > 0
                    ? `Đã phân phối ${distributeResult.totalDistributed}/${distributeResult.totalExpected} video`
                    : `Phân phối thành công ${distributeResult.totalDistributed} video vào ${distributeResult.profiles.length} profile!`
                  }
                </span>
              </div>
              {distributeResult.missing > 0 && (
                <p style={{ color: 'var(--text-muted)', margin: '0 0 16px 0', fontSize: '0.9rem' }}>
                  Thiếu {distributeResult.missing} video do folder nguồn không có đủ số lượng file.
                </p>
              )}
              {/* Breakdown breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px', marginTop: '12px' }}>
                {distributeResult.profiles.map(p => (
                  <div key={p.profileId} className="glass" style={{ padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem' }}>
                    <div style={{ fontWeight: '600', marginBottom: '4px' }}>{p.profileName}</div>
                    <div style={{ color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Đã nhận: <strong style={{ color: 'var(--accent)' }}>{p.count} video</strong></span>
                      <span style={{ fontSize: '0.75rem', opacity: 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '140px' }} title={p.folder}>{p.folder}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '16px', textAlign: 'right' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setDistributeResult(null)}
                >
                  Ẩn Kết Quả
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Group Profiles List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserCheck size={18} color="var(--accent)" />
            Danh Sách Profile Thuộc Nhóm ({distGroupProfiles.length})
          </h3>
        </div>

        {distGroupProfiles.length === 0 ? (
          <div className="glass" style={{ padding: '48px 24px', borderRadius: '20px', textAlign: 'center' }}>
            <Layers size={40} color="var(--text-muted)" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
            <h3 style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-muted)' }}>Không có profile nào trong nhóm này</h3>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Vui lòng chọn nhóm khác hoặc gán profile vào nhóm trong trang Profiles.</p>
          </div>
        ) : (
          <div className="profile-grid">
            {distGroupProfiles.map(p => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass card profile-card"
              >
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '4px' }}>{p.name}</div>
                      {p.group_name && (
                        <span className="badge" style={{ fontSize: '0.75rem' }}>{p.group_name}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderOpen size={14} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{p.video_folder || `(uploads/${p.name})`}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default DistributionView;
