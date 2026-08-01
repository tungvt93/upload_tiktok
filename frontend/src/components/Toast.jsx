import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Transient success/error banner rendered above the active view.
// Props:
//   message – { type: 'success' | 'error', text: string } | null
const Toast = ({ message }) => {
  if (!message) return null;
  const isError = message.type === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass"
      style={{
        padding: '16px 24px',
        borderRadius: '16px',
        background: isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
        color: isError ? '#EF4444' : '#10B981',
        border: `1px solid ${isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 100
      }}
    >
      {isError ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
      <span style={{ fontWeight: '600' }}>{message.text}</span>
    </motion.div>
  );
};

export default Toast;
