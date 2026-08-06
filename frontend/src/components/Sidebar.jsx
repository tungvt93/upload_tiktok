import React from 'react';
import { Zap, Layout, Users, Settings, Share2, ShieldCheck } from 'lucide-react';

const NAV_ITEMS = [
  { key: 'profiles', label: 'Profiles Management', icon: Layout },
  { key: 'groups', label: 'Groups', icon: Users },
  { key: 'distribution', label: 'Phân Phối Video', icon: Share2 },
  { key: 'settings', label: 'System Settings', icon: Settings }
];

// Left-hand navigation: logo, tab buttons and system status summary.
// Sticky within the viewport; the status card is pinned to the bottom via
// .sidebar-status { margin-top: auto }.
const Sidebar = ({ activeTab, onTabChange, profilesCount, maxConcurrency }) => (
  <aside className="sidebar">
    <div>
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <Zap fill="white" size={20} color="white" />
        </div>
        <h1 className="sidebar-title">
          TikTok<span style={{ color: 'var(--primary)' }}>Manager</span>
        </h1>
      </div>
      <p className="sidebar-subtitle">Enterprise Automation</p>
    </div>

    <nav className="glass sidebar-nav">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = activeTab === item.key;
        return (
          <button
            key={item.key}
            onClick={() => onTabChange(item.key)}
            className={`nav-item${active ? ' active' : ''}`}
          >
            <Icon size={20} /> {item.label}
          </button>
        );
      })}
    </nav>

    <div className="glass sidebar-status">
      <h4 className="sidebar-status-title">
        <ShieldCheck size={16} color="var(--success)" /> System Status
      </h4>
      <div className="status-row">
        <span>Active Profiles</span>
        <strong>{profilesCount}</strong>
      </div>
      <div className="status-row">
        <span>Concurrency</span>
        <strong>{maxConcurrency}</strong>
      </div>
    </div>
  </aside>
);

export default Sidebar;
