import React from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Modal to pick profiles (not already in the distribution list) to add.
const AddDistProfileModal = ({
  open,
  groups,
  distGroupFilter,
  setDistGroupFilter,
  filteredDistAvailable,
  selectedProfileIds,
  setSelectedProfileIds,
  handleAddDistProfiles,
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
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Thêm Profile</h3>
              <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Chọn profile để thêm vào danh sách phân phối</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Group
              <select
                className="input"
                style={{ padding: '8px 12px', minWidth: '180px' }}
                value={distGroupFilter}
                onChange={(e) => setDistGroupFilter(e.target.value)}
              >
                <option value="all">Tất cả</option>
                <option value="ungrouped">Ungrouped</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ maxHeight: '360px', overflowY: 'auto', marginBottom: '20px' }}>
            {filteredDistAvailable.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                <p>Không có profile nào khả dụng</p>
              </div>
            ) : (
              filteredDistAvailable.map(p => (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    background: selectedProfileIds.has(p.id) ? 'rgba(255, 63, 182, 0.08)' : 'transparent'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedProfileIds.has(p.id)}
                    onChange={() => {
                      setSelectedProfileIds(prev => {
                        const next = new Set(prev);
                        if (next.has(p.id)) next.delete(p.id);
                        else next.add(p.id);
                        return next;
                      });
                    }}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{p.name}</div>
                    {p.group_name && (
                      <span className="badge" style={{ fontSize: '0.7rem', marginTop: '2px' }}>{p.group_name}</span>
                    )}
                  </div>
                </label>
              ))
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={onClose}>
              Huỷ
            </button>
            <button
              className="btn btn-primary"
              onClick={handleAddDistProfiles}
              disabled={selectedProfileIds.size === 0}
            >
              Thêm ({selectedProfileIds.size})
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default AddDistProfileModal;
