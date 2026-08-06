import React from 'react';
import { X, Upload, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Modal to bulk-import profiles from a CSV file.
const ImportCsvModal = ({
  open,
  isImporting,
  importFileName,
  importResults,
  importCsvText,
  handleFileSelect,
  closeImportModal,
  handleImportCsv
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-backdrop"
        onClick={() => closeImportModal()}
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
              <h3 className="modal-title">Import CSV Profiles</h3>
              <p className="modal-subtitle">
                Tạo hàng loạt profile từ file CSV
              </p>
            </div>
            <button
              type="button"
              onClick={() => closeImportModal()}
              disabled={isImporting}
              className="modal-close"
              aria-label="Close import modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-body">
            <div style={{
              padding: '20px',
              borderRadius: '14px',
              background: 'var(--surface-2)',
              border: '2px dashed var(--border)',
              textAlign: 'center'
            }}>
              <Upload size={28} color="var(--text-muted)" style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                File CSV cần có các cột:
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'monospace', marginBottom: '16px' }}>
                profile_name, group_name, account_id, pass, email, pass_email, cookies, music_search
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                disabled={isImporting}
                className="input"
                style={{
                  width: '100%',
                  cursor: isImporting ? 'not-allowed' : 'pointer'
                }}
              />
              {importFileName && (
                <p style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '10px' }}>
                  Đã chọn: {importFileName}
                </p>
              )}
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
                    {importResults.errors.slice(0, 10).map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                    {importResults.errors.length > 10 && (
                      <div>... và {importResults.errors.length - 10} lỗi khác</div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => closeImportModal()} disabled={isImporting}>
                Đóng
              </button>
              <button
                className="btn btn-primary"
                onClick={handleImportCsv}
                disabled={isImporting || !importCsvText.trim()}
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

export default ImportCsvModal;
