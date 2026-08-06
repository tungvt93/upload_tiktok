import React from 'react';
import { Video, AlertCircle, ShieldCheck } from 'lucide-react';

// The "System Settings" tab: global video source folder + max concurrency.
const SettingsView = ({ config, setConfig, updateConfig }) => (
  <section>
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>System Configuration</h2>
      <p style={{ color: 'var(--text-muted)' }}>Fine-tune your automation engine</p>
    </div>

    <div className="glass" style={{ padding: '32px', borderRadius: '24px', maxWidth: '600px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '10px', fontSize: '0.95rem', fontWeight: '600' }}>
            Video Source Folder
          </label>
          <div style={{ position: 'relative' }}>
            <Video size={18} style={{ position: 'absolute', left: '14px', top: '14px', color: 'var(--text-muted)' }} />
            <input
              className="input"
              style={{ paddingLeft: '44px', width: '100%' }}
              value={config.videoFolder}
              onChange={(e) => setConfig({ ...config, videoFolder: e.target.value })}
              placeholder="/Users/path/to/videos"
            />
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
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
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '8px' }}>
            Control how many browser instances run concurrently.
          </p>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', marginTop: '12px', justifyContent: 'center' }}
          onClick={updateConfig}
        >
          Save Changes
        </button>
      </div>
    </div>

    <div style={{ marginTop: '32px', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px', maxWidth: '600px' }}>
      <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
        <AlertCircle size={20} color="var(--accent)" style={{ marginBottom: '12px' }} />
        <h4 style={{ fontSize: '0.9rem', marginBottom: '6px' }}>Quick Tip</h4>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          Each profile uses a separate browser context. Make sure you have enough RAM for parallel runs.
        </p>
      </div>
      <div className="glass" style={{ padding: '20px', borderRadius: '16px' }}>
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
