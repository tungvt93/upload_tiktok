import React from 'react';
import { Video, AlertCircle, ShieldCheck } from 'lucide-react';

// The "System Settings" tab: global video source folder + max concurrency.
const SettingsView = ({ config, setConfig, updateConfig }) => (
  <section>
    <div className="page-header">
      <div>
        <h2 className="page-title">System Configuration</h2>
        <p className="page-subtitle">Fine-tune your automation engine</p>
      </div>
    </div>

    <div className="glass settings-card">
      <div className="settings-stack">
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.95rem', fontWeight: '600' }}>
            Video Source Folder
          </label>
          <div className="input-with-icon">
            <Video size={18} />
            <input
              className="input"
              value={config.videoFolder}
              onChange={(e) => setConfig({ ...config, videoFolder: e.target.value })}
              placeholder="/Users/path/to/videos"
            />
          </div>
          <p className="input-hint">
            Specify the absolute path where your .mp4 files are located.
          </p>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.95rem', fontWeight: '600' }}>
            Maximum Parallel Uploads
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input
              type="range"
              min="1"
              max="10"
              style={{ flex: 1, accentColor: 'var(--primary)' }}
              value={config.maxConcurrency}
              onChange={(e) => setConfig({ ...config, maxConcurrency: parseInt(e.target.value) })}
            />
            <div className="glass" style={{ padding: '8px 16px', borderRadius: '8px', fontWeight: '700', color: 'var(--primary)' }}>
              {config.maxConcurrency}
            </div>
          </div>
          <p className="input-hint">
            Control how many browser instances run concurrently.
          </p>
        </div>

        <button
          className="btn btn-primary btn-block"
          style={{ marginTop: '12px' }}
          onClick={updateConfig}
        >
          Save Changes
        </button>
      </div>
    </div>

    <div className="info-grid" style={{ marginTop: '32px', maxWidth: '600px' }}>
      <div className="glass tip-card">
        <AlertCircle size={20} color="var(--accent)" style={{ marginBottom: '12px' }} />
        <h4 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Quick Tip</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Each profile uses a separate browser context. Make sure you have enough RAM for parallel runs.
        </p>
      </div>
      <div className="glass tip-card">
        <ShieldCheck size={20} color="var(--success)" style={{ marginBottom: '12px' }} />
        <h4 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Database Secure</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          System is now powered by SQLite for high reliability and data persistence.
        </p>
      </div>
    </div>
  </section>
);

export default SettingsView;
