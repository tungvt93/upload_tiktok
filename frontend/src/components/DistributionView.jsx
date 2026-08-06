import React from 'react';
import { Plus, Share2, Trash2, FolderOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import AddDistProfileModal from './AddDistProfileModal';
import DistributeVideoModal from './DistributeVideoModal';

// The "Phân Phối Video" tab: list of distribution profiles + distribute button,
// plus the add-profile and distribute modals.
const DistributionView = ({
  distributionProfiles,
  handleRemoveDistProfile,
  showAddDistProfileModal,
  setShowAddDistProfileModal,
  // add modal
  groups,
  distGroupFilter,
  setDistGroupFilter,
  filteredDistAvailable,
  selectedProfileIds,
  setSelectedProfileIds,
  handleAddDistProfiles,
  // distribute modal
  showDistributeModal,
  setShowDistributeModal,
  setSourceFolder,
  setVideosPerProfile,
  setDistributeResult,
  sourceFolder,
  videosPerProfile,
  isDistributing,
  distributeResult,
  handleDistribute
}) => {
  const closeAddModal = () => {
    setSelectedProfileIds(new Set());
    setShowAddDistProfileModal(false);
  };

  const openDistributeModal = () => {
    setSourceFolder('');
    setVideosPerProfile(1);
    setDistributeResult(null);
    setShowDistributeModal(true);
  };

  const closeDistributeModal = () => {
    if (!isDistributing) {
      setDistributeResult(null);
      setShowDistributeModal(false);
    }
  };

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>Phân Phối Video</h2>
          <p style={{ color: 'var(--text-muted)' }}>Chọn profile và phân phối video vào các folder upload</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowAddDistProfileModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          <Plus size={18} /> Thêm Profile
        </button>
      </div>

      {/* Distribution profile cards */}
      <div style={{ marginBottom: '24px' }}>
        {distributionProfiles.length === 0 ? (
          <div className="glass" style={{ padding: '48px 24px', borderRadius: '20px', textAlign: 'center' }}>
            <Share2 size={40} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
            <h3 style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-muted)' }}>Chưa có profile nào được chọn</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Thêm profile để bắt đầu phân phối video</p>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddDistProfileModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Plus size={18} /> Thêm Profile
            </button>
          </div>
        ) : (
          <div className="profile-grid">
            {distributionProfiles.map(dp => (
              <motion.div
                key={dp.profile_id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="glass card"
                style={{ overflow: 'hidden' }}
              >
                <div style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '4px' }}>{dp.profile_name}</div>
                      {dp.group_name && (
                        <span className="badge" style={{ fontSize: '0.75rem' }}>{dp.group_name}</span>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemoveDistProfile(dp.profile_id)}
                      className="btn btn-secondary"
                      style={{ padding: '6px 10px', minWidth: 'unset' }}
                      title="Xoá khỏi danh sách"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FolderOpen size={14} />
                    <span style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{dp.video_folder || '(default)'}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Distribute button */}
      {distributionProfiles.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <button
            className="btn btn-primary"
            onClick={openDistributeModal}
            disabled={isDistributing}
            style={{
              width: '100%',
              padding: '14px 20px',
              fontSize: '1.05rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}
          >
            <Share2 size={20} /> Phân Phối Video
          </button>
        </div>
      )}

      <AddDistProfileModal
        open={showAddDistProfileModal}
        groups={groups}
        distGroupFilter={distGroupFilter}
        setDistGroupFilter={setDistGroupFilter}
        filteredDistAvailable={filteredDistAvailable}
        selectedProfileIds={selectedProfileIds}
        setSelectedProfileIds={setSelectedProfileIds}
        handleAddDistProfiles={handleAddDistProfiles}
        onClose={closeAddModal}
      />

      <DistributeVideoModal
        open={showDistributeModal}
        distributionProfiles={distributionProfiles}
        sourceFolder={sourceFolder}
        setSourceFolder={setSourceFolder}
        videosPerProfile={videosPerProfile}
        setVideosPerProfile={setVideosPerProfile}
        isDistributing={isDistributing}
        distributeResult={distributeResult}
        setDistributeResult={setDistributeResult}
        handleDistribute={handleDistribute}
        onClose={closeDistributeModal}
      />
    </section>
  );
};

export default DistributionView;
