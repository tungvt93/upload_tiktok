import React from 'react';
import { X, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const ProfileDetailModal = ({ profile, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  const copyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(profile, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fields = [
    { label: 'ID', value: profile.id },
    { label: 'Name', value: profile.name },
    { label: 'Status', value: profile.status },
    { label: 'Group ID', value: profile.group_id || 'None' },
    { label: 'Video Folder', value: profile.video_folder || 'Global default' },
    { label: 'Proxy', value: profile.proxy || 'None' },
    { label: 'Channel IDs', value: profile.channel_ids || 'None' },
    { label: 'Is Scheduled', value: profile.is_scheduled ? 'Yes' : 'No' },
    { label: 'Auto Increment Schedule', value: profile.auto_increment_schedule ? 'Yes' : 'No' },
    { label: 'Upload Count', value: profile.upload_count || 1 },
    { label: 'Needs Render', value: profile.needs_render ? 'Yes' : 'No' },
    { label: 'Remove Title', value: profile.remove_title ? 'Yes' : 'No' },
    { label: 'Set Music', value: profile.set_music ? 'Yes' : 'No' },
    { label: 'Last Run', value: profile.last_run ? new Date(profile.last_run).toLocaleString() : 'Never' },
    { label: 'Schedules', value: profile.schedules?.length ? profile.schedules.join(', ') : 'None' },
  ];

  return (
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
        padding: '24px',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        className="glass"
        style={{
          width: '100%',
          maxWidth: '600px',
          padding: '24px',
          borderRadius: '20px',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Profile Details</h3>
            <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>{profile.name}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={copyJson}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px 12px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
              }}
            >
              {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
              {copied ? 'Copied' : 'Copy JSON'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '8px',
              }}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {fields.map((field) => (
            <div
              key={field.label}
              style={{
                padding: '12px',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--border)',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                {field.label}
              </div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', wordBreak: 'break-word' }}>
                {field.value}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ProfileDetailModal;
