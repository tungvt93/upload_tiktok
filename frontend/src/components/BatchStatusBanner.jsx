import React, { useState } from 'react';
import { RefreshCw, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BatchStatusBanner = ({ batchStatus, onDismiss }) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!batchStatus || !batchStatus.status || batchStatus.status === 'idle') {
    return null;
  }

  const isRunningRound1 = batchStatus.status === 'running_round1';
  const isRetrying = batchStatus.status === 'retrying_round2';
  const isCompleted = batchStatus.status === 'completed';

  const round1CompletedCount = batchStatus.round1?.completed?.length || 0;
  const round1FailedCount = batchStatus.round1?.failed?.length || 0;
  const retryCompletedCount = batchStatus.retry?.completed?.length || 0;
  const retryFailedCount = batchStatus.retry?.failed?.length || 0;
  const totalProfiles = batchStatus.totalProfiles || 0;
  const summary = batchStatus.summary;

  const allPassed = isCompleted && round1FailedCount === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="glass"
      style={{
        marginBottom: '20px',
        padding: '16px 20px',
        borderRadius: '12px',
        border: isRunningRound1 || isRetrying
          ? '1px solid rgba(59, 130, 246, 0.4)'
          : allPassed
          ? '1px solid rgba(16, 185, 129, 0.4)'
          : '1px solid rgba(245, 158, 11, 0.4)',
        background: isRunningRound1 || isRetrying
          ? 'rgba(59, 130, 246, 0.08)'
          : allPassed
          ? 'rgba(16, 185, 129, 0.08)'
          : 'rgba(245, 158, 11, 0.08)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
          {isRunningRound1 && (
            <RefreshCw className="animate-pulse" size={24} style={{ color: '#3B82F6', flexShrink: 0 }} />
          )}
          {isRetrying && (
            <RotateCcw className="animate-pulse" size={24} style={{ color: '#F59E0B', flexShrink: 0 }} />
          )}
          {isCompleted && allPassed && (
            <CheckCircle2 size={24} style={{ color: '#10B981', flexShrink: 0 }} />
          )}
          {isCompleted && !allPassed && (
            <AlertTriangle size={24} style={{ color: '#F59E0B', flexShrink: 0 }} />
          )}

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text)' }}>
                {isRunningRound1 && `Đang chạy Lượt 1 hàng loạt (${round1CompletedCount + round1FailedCount}/${totalProfiles})`}
                {isRetrying && `Lượt 1 xong. Đang tự động chạy lại ${batchStatus.retry?.total || 0} profile lỗi...`}
                {isCompleted && allPassed && `Chạy hàng loạt thành công 100%!`}
                {isCompleted && !allPassed && `Chạy hàng loạt hoàn tất (có profile lỗi)`}
              </h4>
              <span
                style={{
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  background: isRunningRound1 ? 'rgba(59,130,246,0.2)' : isRetrying ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)',
                  color: isRunningRound1 ? '#60A5FA' : isRetrying ? '#FBBF24' : '#34D399'
                }}
              >
                {isRunningRound1 ? 'Lượt 1' : isRetrying ? 'Lượt Retry' : 'Hoàn thành'}
              </span>
            </div>

            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {batchStatus.message}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isCompleted && (
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              Chi tiết {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}

          {isCompleted && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              title="Đóng thông báo"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Expandable summary breakdown for completed batch runs */}
      <AnimatePresence>
        {isCompleted && showDetails && summary && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: '14px',
              paddingTop: '14px',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
              fontSize: '0.85rem'
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '12px' }}>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Lượt 1:</span>
                <strong style={{ color: '#10B981', marginLeft: '6px' }}>{summary.round1Completed?.length || 0} thành công</strong>,
                <strong style={{ color: summary.round1Failed?.length ? '#EF4444' : 'var(--text)', marginLeft: '4px' }}>
                  {summary.round1Failed?.length || 0} lỗi
                </strong>
              </div>

              {summary.retryCompleted !== undefined && (
                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Lượt Retry:</span>
                  <strong style={{ color: '#10B981', marginLeft: '6px' }}>{summary.retryCompleted?.length || 0} thành công</strong>,
                  <strong style={{ color: summary.retryFailed?.length ? '#EF4444' : 'var(--text)', marginLeft: '4px' }}>
                    {summary.retryFailed?.length || 0} vẫn lỗi
                  </strong>
                </div>
              )}

              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '8px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Tổng kết:</span>
                <strong style={{ color: '#10B981', marginLeft: '6px' }}>{summary.totalSucceeded}/{summary.totalProfiles} thành công</strong>
              </div>
            </div>

            {summary.finalFailed && summary.finalFailed.length > 0 && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px', borderRadius: '8px' }}>
                <strong style={{ color: '#EF4444', display: 'block', marginBottom: '4px' }}>Danh sách profile lỗi sau lượt retry:</strong>
                <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text)' }}>
                  {summary.finalFailed.map((p) => (
                    <li key={p.id || p.name}>
                      <strong>{p.name}</strong>: <span style={{ color: 'var(--text-secondary)' }}>{p.error || 'Lỗi không xác định'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default BatchStatusBanner;
