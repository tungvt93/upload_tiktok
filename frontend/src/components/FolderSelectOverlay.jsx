import React from 'react';
import { FolderOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Full-screen loading overlay shown while the native folder picker dialog is open.
const FolderSelectOverlay = ({ visible }) => (
  <AnimatePresence>
    {visible && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <div className="glass" style={{ padding: '40px', borderRadius: '24px', textAlign: 'center', border: '1px solid var(--primary)' }}>
          <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto 24px' }}>
            <div style={{ position: 'absolute', inset: 0, border: '4px solid rgba(255, 63, 182, 0.1)', borderRadius: '50%' }} />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', inset: 0, border: '4px solid transparent', borderTopColor: 'var(--primary)', borderRadius: '50%' }}
            />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderOpen size={32} color="var(--primary)" />
            </div>
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Select Folder...</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Please select a folder in the native dialog that appeared.
          </p>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default FolderSelectOverlay;
