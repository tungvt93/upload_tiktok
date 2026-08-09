import React from 'react';
import { X, FolderArchive, Download, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Modal to export selected profiles into a TikTok_Export folder / ZIP.
const ExportFolderModal = ({
  open,
  isExporting,
  selectedCount,
  exportFolderPath,
  setExportFolderPath,
  exportResults,
  closeExportFolderModal,
  handleExportFolder
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="modal-backdrop"
        onClick={() => closeExportFolderModal()}
      >
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          className="glass modal-card modal-card--lg"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <div>
              <h3 className="modal-title">Export Folder (Cookie Login)</h3>
              <p className="modal-subtitle">
                Xuất {selectedCount} profile đã chọn thành thư mục chuẩn format TikTok_Export
              </p>
            </div>
            <button
              type="button"
              onClick={() => closeExportFolderModal()}
              disabled={isExporting}
              className="modal-close"
              aria-label="Close export folder modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-body">
            <div style={{ display: 'grid', gap: '8px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Đường dẫn thư mục xuất tuyệt đối (Tùy chọn, để trống sẽ tự tạo thư mục mới):
              </label>
              <input
                type="text"
                placeholder={`D:\\TIKTOK\\upload_tiktok\\TikTok_Export_selected_${selectedCount}TK`}
                value={exportFolderPath}
                onChange={(e) => setExportFolderPath(e.target.value)}
                disabled={isExporting}
                className="input"
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                * Kết quả xuất bao gồm file <code>config.json</code>, <code>archive.json</code> và thư mục <code>cookies/</code> chứa cookie JSON từng tài khoản.<br/>
                * Thư mục này dùng để import trực tiếp sang máy khác thông qua nút <b>Import Folder</b>.
              </p>
            </div>

            {exportResults && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="result-panel result-panel--success"
                style={{ fontSize: '0.85rem' }}
              >
                <div style={{ fontWeight: '700', color: '#4ADE80', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={16} />
                  Export hoàn tất!
                </div>
                <div style={{ display: 'grid', gap: '4px', color: 'var(--text-muted)' }}>
                  <div>• Tổng profile đã chọn: <b>{exportResults.total}</b></div>
                  <div>• Cookie đã ghi ra file JSON: <b>{exportResults.exportedCookies}</b></div>
                  {exportResults.missingCookies > 0 && (
                    <div style={{ color: '#FBBF24' }}>
                      • Profile chưa có cookie trong DB: <b>{exportResults.missingCookies}</b>
                    </div>
                  )}
                  <div style={{ marginTop: '6px', wordBreak: 'break-all' }}>
                    • Thư mục: <code style={{ color: '#60A5FA' }}>{exportResults.exportPath}</code>
                  </div>
                </div>
              </motion.div>
            )}

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => closeExportFolderModal()}
                disabled={isExporting}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleExportFolder(false)}
                disabled={isExporting || selectedCount === 0}
              >
                <FolderArchive size={16} />
                {isExporting ? 'Đang export...' : 'Xuất ra Thư mục'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-blue-gradient"
                onClick={() => handleExportFolder(true)}
                disabled={isExporting || selectedCount === 0}
              >
                <Download size={16} />
                {isExporting ? 'Đang export...' : 'Xuất & Tải .ZIP'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ExportFolderModal;
