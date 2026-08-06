import React from 'react';
import { X, Upload, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Modal to import profiles (with cookies) from an exported folder.
const ImportFolderModal = ({
  open,
  isImporting,
  importFolderPath,
  setImportFolderPath,
  importResults,
  closeImportFolderModal,
  handleImportFolder
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-backdrop"
        onClick={() => closeImportFolderModal()}
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
              <h3 className="modal-title">Import Export Folder</h3>
              <p className="modal-subtitle">
                Import danh sách tài khoản kèm cookie từ thư mục export
              </p>
            </div>
            <button
              type="button"
              onClick={() => closeImportFolderModal()}
              disabled={isImporting}
              className="modal-close"
              aria-label="Close import folder modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-body">
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Đường dẫn thư mục tuyệt đối trên server:
              </label>
              <input
                type="text"
                placeholder="Ví dụ: D:\TIKTOK\upload_tiktok\TikTok_Export_checked_1TK_20260724"
                value={importFolderPath}
                onChange={(e) => setImportFolderPath(e.target.value)}
                disabled={isImporting}
                className="input"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                * Thư mục này phải chứa file <code>config.json</code> và thư mục con <code>cookies/</code> chứa các file <code>.json</code> cookie.<br/>
                * Tài khoản nào không có cookie tương ứng sẽ bị tự động bỏ qua.
              </p>
            </div>

            {importResults && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: importResults.errors.length > 0
                    ? 'rgba(234, 179, 8, 0.08)'
                    : 'rgba(16, 185, 129, 0.08)',
                  border: `1px solid ${importResults.errors.length > 0
                    ? 'rgba(234, 179, 8, 0.25)'
                    : 'rgba(16, 185, 129, 0.25)'}`
                }}
              >
                <div style={{ display: 'flex', gap: '20px', marginBottom: importResults.errors.length > 0 ? '12px' : 0 }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                    Đã import: <strong>{importResults.imported}</strong>
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#EAB308' }}>
                    Bỏ qua: <strong>{importResults.skipped}</strong>
                  </span>
                </div>
                {importResults.errors.length > 0 && (
                  <div style={{
                    maxHeight: '120px',
                    overflowY: 'auto',
                    fontSize: '0.75rem',
                    color: '#EAB308',
                    lineHeight: 1.5
                  }}>
                    {importResults.errors.slice(0, 15).map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                    {importResults.errors.length > 15 && (
                      <div>... và {importResults.errors.length - 15} lỗi khác</div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => closeImportFolderModal()} disabled={isImporting}>
                Đóng
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImportFolder}
                disabled={isImporting || !importFolderPath.trim()}
              >
                {isImporting ? (
                  <>
                    <RefreshCw size={16} className="animate-pulse" />
                    Đang import...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Import
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ImportFolderModal;
