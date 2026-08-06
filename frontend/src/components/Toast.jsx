import React from 'react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

// Transient success/error/warning/info banner rendered above the active view.
// Props:
//   message – { type: 'success' | 'error' | 'warning' | 'info', text: string } | null
const Toast = ({ message }) => {
  if (!message) return null;
  const type = message.type || 'success';

  const palette = {
    error: { bg: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: 'rgba(239, 68, 68, 0.2)', icon: AlertCircle },
    warning: { bg: 'rgba(251, 191, 36, 0.1)', color: '#FBBF24', border: 'rgba(251, 191, 36, 0.2)', icon: AlertCircle },
    info: { bg: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', border: 'rgba(59, 130, 246, 0.2)', icon: CheckCircle2 },
    success: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10B981', border: 'rgba(16, 185, 129, 0.2)', icon: CheckCircle2 }
  };

  const p = palette[type] || palette.success;
  const Icon = p.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass toast"
      style={{
        background: p.bg,
        color: p.color,
        border: `1px solid ${p.border}`
      }}
    >
      <Icon size={20} />
      <strong>{message.text}</strong>
    </motion.div>
  );
};

export default Toast;
