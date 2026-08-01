import React from 'react';
import { Zap, Layout, Users, Settings, ShieldCheck } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'profiles', label: 'Profiles Management', icon: Layout },
  { key: 'groups', label: 'Groups', icon: Users },
  { key: 'settings', label: 'System Settings', icon: Settings }
];

// Left-hand navigation: logo, tab buttons and system status summary.
const Sidebar = ({ activeTab, onTabChange, profilesCount, maxConcurrency }) => (
  <aside style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
        <div style={{
          background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(255, 63, 182, 0.3)'
        }}>
          <Zap fill="white" size={20} color="white" />
        </div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
          TikTok<span style={{ color: 'var(--primary)' }}>Manager</span>
        </h1>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', paddingLeft: '4px' }}>Enterprise Automation</p>
    </div>

    <nav className="glass" style={{ padding: '12px', borderRadius: '20px' }}>
      {NAV_ITEMS.map((item, i) => {
        const Icon = item.icon;
        const active = activeTab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onTabChange(item.key)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 16px',
              borderRadius: '12px',
              background: active ? 'rgba(255, 63, 182, 0.1)' : 'transparent',
              color: active ? 'var(--primary)' : 'var(--text-muted)',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              marginTop: i === 0 ? 0 : '8px',
              transition: 'all 0.2s'
            }}
          >
            <Icon size={20} /> {item.label}
          </button>
        );
      })}
    </nav>

    <div className="glass" style={{ padding: '24px', borderRadius: '20px', marginTop: 'auto' }}>
      <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={16} color="var(--success)" /> System Status
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>Active Profiles</span>
          <span style={{ color: 'white' }}>{profilesCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          <span>Concurrency</span>
          <span style={{ color: 'white' }}>{maxConcurrency}</span>
        </div>
      </div>
    </div>
  </aside>
);

export default Sidebar;
