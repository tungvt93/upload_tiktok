import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Plus, 
  Play, 
  Trash2, 
  Settings, 
  Globe, 
  Video, 
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layout,
  Clock,
  ChevronRight,
  ShieldCheck,
  Zap,
  FolderOpen,
  Link,
  ExternalLink,
  Edit3,
  Check,
  X
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';

const App = () => {
  const [profiles, setProfiles] = useState([]);
  const [config, setConfig] = useState({ videoFolder: '', maxConcurrency: 2 });
  const [newProfileName, setNewProfileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('profiles');
  const [processingIds, setProcessingIds] = useState(new Set());
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [pRes, cRes] = await Promise.all([
        axios.get('/api/profiles'),
        axios.get('/api/config')
      ]);
      
      const newProfiles = pRes.data || [];
      setProfiles(prev => {
        // Don't overwrite profiles that are currently being updated
        return newProfiles.map(np => {
          if (processingIds.has(np.id)) {
            const current = prev.find(p => p.id === np.id);
            return current || np;
          }
          return np;
        });
      });
      
      setConfig(cRes.data || { videoFolder: '', maxConcurrency: 2 });
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const addProfile = async () => {
    if (!newProfileName) return;
    try {
      await axios.post('/api/profiles', { name: newProfileName });
      setNewProfileName('');
      fetchData();
      setMessage({ type: 'success', text: 'Profile added successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add profile' });
    }
  };

  const deleteProfile = async (id) => {
    if (!window.confirm('Are you sure you want to delete this profile?')) return;
    try {
      await axios.delete(`/api/profiles/${id}`);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const updateConfig = async () => {
    try {
      await axios.post('/api/config', config);
      setMessage({ type: 'success', text: 'Settings updated' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const startAutomation = async (profileId = null) => {
    setIsLoading(true);
    try {
      await axios.post('/api/start', { profileId });
      setMessage({ 
        type: 'success', 
        text: profileId ? `Automation started for profile` : 'Parallel automation started' 
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to start' });
    }
    setIsLoading(false);
  };

  const openProfile = async (profileId) => {
    try {
      await axios.post('/api/open-profile', { profileId });
      setMessage({ type: 'success', text: 'Browser opened for profile' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to open browser' });
    }
  };


  const updateProfileFolder = async (id, folder) => {
    try {
      await axios.patch(`/api/profiles/${id}`, { video_folder: folder });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const updateProfileProxy = async (id, proxy) => {
    try {
      await axios.patch(`/api/profiles/${id}`, { proxy });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const updateProfileName = async (id, newName) => {
    if (!newName.trim()) {
      setEditingId(null);
      return;
    }
    try {
      await axios.patch(`/api/profiles/${id}`, { name: newName });
      setEditingId(null);
      fetchData();
      setMessage({ type: 'success', text: 'Profile renamed successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to rename profile' });
      setEditingId(null);
    }
  };
  
  const updateProfileSchedule = async (id, is_scheduled) => {
    // Prevent multiple concurrent updates
    if (processingIds.has(id)) return;

    // Optimistic update
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_scheduled: is_scheduled ? 1 : 0 } : p));
    setProcessingIds(prev => new Set(prev).add(id));

    try {
      await axios.patch(`/api/profiles/${id}`, { is_scheduled });
      // Small delay to ensure DB is written and GET will find it
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      setProcessingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleSelectFolder = async (id = null) => {
    setIsSelectingFolder(true);
    try {
      const res = await axios.post('/api/select-folder');
      if (res.data.path) {
        if (id) {
          await updateProfileFolder(id, res.data.path);
        } else {
          const newConfig = { ...config, videoFolder: res.data.path };
          setConfig(newConfig);
          await axios.post('/api/config', newConfig);
          setMessage({ type: 'success', text: 'Default folder updated' });
          setTimeout(() => setMessage(null), 3000);
          // Auto-hide settings and go back to profiles dashboard
          setActiveTab('profiles');
        }
      }
    } catch (err) {
      console.error('Folder selection cancelled or failed');
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'uploading': return 'var(--accent)';
      case 'success': return 'var(--success)';
      case 'error': return 'var(--error)';
      case 'no_videos': return '#EAB308';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div className="container" style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Sidebar / Navigation */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '40px' }}>
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
            <button 
              onClick={() => setActiveTab('profiles')}
              style={{ 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px 16px', 
                borderRadius: '12px',
                background: activeTab === 'profiles' ? 'rgba(255, 63, 182, 0.1)' : 'transparent',
                color: activeTab === 'profiles' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                transition: 'all 0.2s'
              }}
            >
              <Layout size={20} /> Profiles Management
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              style={{ 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px 16px', 
                borderRadius: '12px',
                background: activeTab === 'settings' ? 'rgba(255, 63, 182, 0.1)' : 'transparent',
                color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                marginTop: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Settings size={20} /> System Settings
            </button>
          </nav>

          <div className="glass" style={{ padding: '24px', borderRadius: '20px', marginTop: 'auto' }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} color="var(--success)" /> System Status
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Active Profiles</span>
                <span style={{ color: 'white' }}>{profiles.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Concurrency</span>
                <span style={{ color: 'white' }}>{config.maxConcurrency}</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main>
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass"
              style={{ 
                padding: '16px 24px', 
                borderRadius: '16px', 
                background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                color: message.type === 'error' ? '#EF4444' : '#10B981',
                border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 100
              }}
            >
              {message.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
              <span style={{ fontWeight: '600' }}>{message.text}</span>
            </motion.div>
          )}

          {activeTab === 'profiles' ? (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>Profiles Dashboard</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Manage and automate your TikTok accounts</p>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div className="input-group">
                    <label>Video Source Folder</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input 
                        className="input"
                        placeholder="/path/to/videos"
                        value={config.videoFolder}
                        onChange={(e) => setConfig({ ...config, videoFolder: e.target.value })}
                        style={{ flex: 1 }}
                      />
                      <button 
                        onClick={() => handleSelectFolder()}
                        className="btn-secondary"
                        style={{ padding: '0 15px' }}
                      >
                        <FolderOpen size={18} style={{ marginRight: '8px' }} />
                        Browse
                      </button>
                    </div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                      Default location to look for .mp4 files if a profile doesn't have its own folder set.
                    </p>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
                    <input 
                      className="input" 
                      placeholder="New Profile Name..." 
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      style={{ width: '180px' }}
                    />
                    <button className="btn btn-secondary" onClick={addProfile} style={{ padding: '10px' }}>
                      <Plus size={20} />
                    </button>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={() => startAutomation()}
                    disabled={isLoading || profiles.length === 0}
                    style={{ gap: '10px' }}
                  >
                    {isLoading ? <RefreshCw className="animate-pulse" size={18} /> : <Play fill="white" size={18} />}
                    Run All Parallel
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                <AnimatePresence mode="popLayout">
                  {profiles.map((profile) => (
                    <motion.div 
                      key={profile.id}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="glass card"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ 
                            background: 'rgba(56, 189, 248, 0.1)', 
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <Globe size={24} color="var(--accent)" />
                          </div>
                          <div>
                            {editingId === profile.id ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <input 
                                  autoFocus
                                  className="input"
                                  style={{ fontSize: '0.9rem', padding: '4px 8px', width: '150px' }}
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') updateProfileName(profile.id, editingValue);
                                    if (e.key === 'Escape') setEditingId(null);
                                  }}
                                />
                                <button 
                                  onClick={() => updateProfileName(profile.id, editingValue)}
                                  style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <Check size={16} />
                                </button>
                                <button 
                                  onClick={() => setEditingId(null)}
                                  style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '700' }}>{profile.name}</h3>
                                <button 
                                  onClick={() => {
                                    setEditingId(profile.id);
                                    setEditingValue(profile.name);
                                  }}
                                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }}
                                  onMouseOver={(e) => e.target.style.opacity = 1}
                                  onMouseOut={(e) => e.target.style.opacity = 0.5}
                                >
                                  <Edit3 size={14} />
                                </button>
                              </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <Clock size={12} /> 
                              {profile.last_run ? new Date(profile.last_run).toLocaleDateString() : 'Never run'}
                            </div>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteProfile(profile.id)}
                          style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.4)', cursor: 'pointer', transition: 'color 0.2s' }}
                          onMouseOver={(e) => e.target.style.color = 'var(--error)'}
                          onMouseOut={(e) => e.target.style.color = 'rgba(239, 68, 68, 0.4)'}
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <Video size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Upload Folder</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                            className="input"
                            style={{ fontSize: '0.75rem', padding: '8px 12px', flex: 1 }}
                            placeholder="Global Default"
                            value={profile.video_folder || ''}
                            onChange={(e) => updateProfileFolder(profile.id, e.target.value)}
                          />
                          <button 
                            onClick={() => handleSelectFolder(profile.id)}
                            className="btn-secondary"
                            style={{ padding: '8px', minWidth: 'auto' }}
                            title="Browse folder"
                          >
                            <FolderOpen size={14} />
                          </button>
                        </div>
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <Link size={14} color="var(--text-muted)" />
                          <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Proxy Server (Optional)</span>
                        </div>
                        <input 
                          className="input"
                          style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                          placeholder="http://user:pass@host:port"
                          value={profile.proxy || ''}
                          onChange={(e) => updateProfileProxy(profile.id, e.target.value)}
                        />
                      </div>

                      <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                          <input 
                            type="checkbox"
                            checked={profile.is_scheduled === 1}
                            onChange={(e) => updateProfileSchedule(profile.id, e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                          />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Schedule Public Video</span>
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lên lịch công khai video</span>
                          </div>
                        </label>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: getStatusColor(profile.status) 
                          }} />
                          <span style={{ 
                            fontSize: '0.75rem', 
                            fontWeight: '700', 
                            color: getStatusColor(profile.status),
                            textTransform: 'uppercase'
                          }}>
                            {profile.status}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            className="btn"
                            onClick={() => openProfile(profile.id)}
                            style={{
                              background: 'rgba(255, 255, 255, 0.05)',
                              color: 'white',
                              border: '1px solid var(--border)',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              gap: '6px'
                            }}
                            title="Open browser"
                          >
                            <ExternalLink size={14} />
                            OPEN
                          </button>
                          
                          <button 
                            className="btn"
                            onClick={() => startAutomation(profile.id)}
                            disabled={profile.status === 'uploading'}
                            style={{
                              background: profile.status === 'uploading' ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
                              color: profile.status === 'uploading' ? 'var(--accent)' : 'white',
                              border: '1px solid var(--border)',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              gap: '6px'
                            }}
                          >
                            {profile.status === 'uploading' ? (
                              <RefreshCw size={14} className="animate-pulse" />
                            ) : (
                              <Play size={14} fill="white" />
                            )}
                            {profile.status === 'uploading' ? 'ACTIVE' : 'START'}
                          </button>
                        </div>

                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {profiles.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '80px 40px', 
                  color: 'var(--text-muted)',
                  border: '2px dashed var(--border)',
                  borderRadius: '24px',
                  marginTop: '40px'
                }}>
                  <div style={{ background: 'rgba(255,255,255,0.02)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                    <Layout size={32} opacity={0.3} />
                  </div>
                  <h3 style={{ color: 'white', marginBottom: '8px' }}>No profiles yet</h3>
                  <p>Add your first TikTok account profile to start automation.</p>
                </div>
              )}
            </section>
          ) : (
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
          )}
        </main>
      </div>
      {/* Folder Selection Loading Overlay */}
      <AnimatePresence>
        {isSelectingFolder && (
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
                <div style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  border: '4px solid rgba(255, 63, 182, 0.1)', 
                  borderRadius: '50%' 
                }} />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    border: '4px solid transparent', 
                    borderTopColor: 'var(--primary)',
                    borderRadius: '50%' 
                  }} 
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

    </div>
  );
};

export default App;
