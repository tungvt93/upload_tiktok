import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  ShieldCheck,
  Zap,
  FolderOpen,
  Link,
  ExternalLink,
  Edit3,
  Check,
  X,
  Users,
  Music,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';

const ProfileCard = ({
  profile,
  isSelected,
  onToggleSelected,
  onDelete,
  onOpen,
  onStart,
  onUpdateName,
  onUpdateGroup,
  onUpdateFolder,
  onSelectFolder,
  onUpdateProxy,
  onUpdateSchedule,
  onUpdateSchedules,
  onUpdateSetMusic,
  onUpdateAutoIncrementSchedule,
  groups,
  getStatusColor,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass card"
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header - Always Visible */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start', 
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '8px'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <label 
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => onToggleSelected(profile.id)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
            />
          </label>
          <div style={{ 
            background: 'rgba(56, 189, 248, 0.1)', 
            width: '44px',
            height: '44px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Globe size={24} color="var(--accent)" />
          </div>
          <div style={{ minWidth: 0 }}>
            {editingId === profile.id ? (
              <div 
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <input 
                  autoFocus
                  className="input"
                  style={{ fontSize: '0.9rem', padding: '4px 8px', width: '140px' }}
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onUpdateName(profile.id, editingValue);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
                <button 
                  onClick={() => onUpdateName(profile.id, editingValue)}
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
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>
                  {profile.name}
                </h3>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(profile.id);
                    setEditingValue(profile.name);
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }}
                >
                  <Edit3 size={14} />
                </button>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <Clock size={12} /> 
              {profile.last_run ? new Date(profile.last_run).toLocaleDateString() : 'Never run'}
              <div style={{ 
                width: '6px', 
                height: '6px', 
                borderRadius: '50%', 
                backgroundColor: getStatusColor(profile.status),
                marginLeft: '6px'
              }} />
            </div>
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(profile.id);
            }}
            style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.4)', cursor: 'pointer', padding: '8px' }}
          >
            <Trash2 size={18} />
          </button>
          <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{ paddingTop: '20px' }}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <FolderOpen size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Group</span>
                </div>
                <select
                  className="input"
                  style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                  value={profile.group_id || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    onUpdateGroup(profile.id, v === '' ? null : v);
                  }}
                >
                  <option value="">No group</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
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
                    onChange={(e) => onUpdateFolder(profile.id, e.target.value)}
                  />
                  <button 
                    onClick={() => onSelectFolder(profile.id)}
                    className="btn-secondary"
                    style={{ padding: '8px', minWidth: 'auto' }}
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
                  onChange={(e) => onUpdateProxy(profile.id, e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                  <input 
                    type="checkbox"
                    checked={profile.is_scheduled === 1}
                    onChange={(e) => onUpdateSchedule(profile.id, e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Schedule Public Video</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Lên lịch công khai video</span>
                  </div>
                </label>

                {profile.is_scheduled === 1 && (
                  <div style={{ marginTop: '12px', paddingLeft: '38px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-muted)' }}>Daily Times (HH:mm, HH:mm)</span>
                    </div>
                    <input 
                      className="input"
                      style={{ fontSize: '0.75rem', padding: '8px 12px', width: '100%' }}
                      placeholder="e.g. 08:00, 18:00, 22:00"
                      defaultValue={profile.schedules?.join(', ') || ''}
                      onBlur={(e) => onUpdateSchedules(profile.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateSchedules(profile.id, e.target.value);
                          e.target.blur();
                        }
                      }}
                    />
                  </div>
                )}
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                  <input 
                    type="checkbox"
                    checked={profile.auto_increment_schedule === 1}
                    onChange={(e) => onUpdateAutoIncrementSchedule(profile.id, e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Lên lịch nối tiếp (10p)</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>V1: Public, V2: Mặc định, V3+: +10 phút</span>
                  </div>
                </label>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                  <input
                    type="checkbox"
                    checked={profile.set_music === 1}
                    onChange={(e) => onUpdateSetMusic(profile.id, e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: '700' }}>
                      <Music size={14} color="var(--accent)" style={{ flexShrink: 0 }} />
                      Set nhạc khi upload
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                      Bật: mở Edit video, chọn nhạc từ Favorites rồi Save.
                    </span>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingBottom: '4px' }}>
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
                    onClick={() => onOpen(profile.id)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      border: '1px solid var(--border)',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      gap: '6px'
                    }}
                  >
                    <ExternalLink size={14} />
                    OPEN
                  </button>
                  
                  <button 
                    className="btn"
                    onClick={() => onStart(profile.id)}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const App = () => {
  const [profiles, setProfiles] = useState([]);
  const [config, setConfig] = useState({ videoFolder: '', maxConcurrency: 2 });
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileGroupId, setNewProfileGroupId] = useState('');
  const [newProfileVideoFolder, setNewProfileVideoFolder] = useState('');
  const [isCreateProfileModalOpen, setIsCreateProfileModalOpen] = useState(false);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState('profiles');
  const processingRef = useRef(new Set());
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState('');
  const [groups, setGroups] = useState([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupValue, setEditingGroupValue] = useState('');
  const [selectedForRun, setSelectedForRun] = useState(() => new Set());
  const [bulkRunMode, setBulkRunMode] = useState('parallel');

  const filteredProfiles = useMemo(() => {
    if (groupFilter === 'all') return profiles;
    if (groupFilter === 'ungrouped') {
      return profiles.filter((p) => !p.group_id);
    }
    return profiles.filter((p) => p.group_id === groupFilter);
  }, [profiles, groupFilter]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const validIds = new Set(profiles.map((p) => p.id));
    setSelectedForRun((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [profiles]);

  const fetchData = async () => {
    try {
      const [pRes, cRes, gRes] = await Promise.all([
        axios.get('/api/profiles'),
        axios.get('/api/config'),
        axios.get('/api/groups')
      ]);
      
      const newProfiles = pRes.data || [];
      setProfiles(prev => {
        // Don't overwrite profiles that are currently being updated
        return newProfiles.map(np => {
          if (processingRef.current.has(np.id)) {
            const current = prev.find(p => p.id === np.id);
            return current || np;
          }
          return np;
        });
      });
      
      setConfig(cRes.data || { videoFolder: '', maxConcurrency: 2 });
      setGroups(gRes.data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    }
  };

  const addGroup = async () => {
    const name = newGroupName.trim();
    if (!name) return;
    try {
      await axios.post('/api/groups', { name });
      setNewGroupName('');
      await fetchData();
      setMessage({ type: 'success', text: 'Group created successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to create group' });
    }
  };

  const updateGroupName = async (id, newName) => {
    if (!newName.trim()) {
      setEditingGroupId(null);
      return;
    }
    try {
      await axios.patch(`/api/groups/${id}`, { name: newName.trim() });
      setEditingGroupId(null);
      await fetchData();
      setMessage({ type: 'success', text: 'Group renamed successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to rename group' });
      setEditingGroupId(null);
    }
  };

  const deleteGroup = async (id) => {
    if (!window.confirm('Delete this group? It must have no profiles assigned.')) return;
    try {
      await axios.delete(`/api/groups/${id}`);
      if (groupFilter === id) setGroupFilter('all');
      await fetchData();
      setMessage({ type: 'success', text: 'Group deleted' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete group' });
    }
  };

  const updateProfileGroup = async (profileId, groupId) => {
    try {
      await axios.patch(`/api/profiles/${profileId}`, { group_id: groupId });
      await fetchData();
      setMessage({ type: 'success', text: 'Profile group updated' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update profile group' });
    }
  };

  const resetCreateProfileForm = () => {
    setNewProfileName('');
    setNewProfileGroupId('');
    setNewProfileVideoFolder('');
  };

  const closeCreateProfileModal = ({ force } = {}) => {
    if ((isCreatingProfile || isSelectingFolder) && !force) return;
    setIsCreateProfileModalOpen(false);
    resetCreateProfileForm();
  };

  const addProfile = async () => {
    if (isCreatingProfile) return;
    const name = newProfileName.trim();
    if (!name) return;

    setIsCreatingProfile(true);
    try {
      await axios.post('/api/profiles', {
        name,
        group_id: newProfileGroupId || null,
        video_folder: newProfileVideoFolder.trim() || null
      });
      closeCreateProfileModal({ force: true });
      await fetchData();
      setMessage({ type: 'success', text: 'Profile added successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add profile' });
    } finally {
      setIsCreatingProfile(false);
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
      if (profileId) {
        await axios.post('/api/start', { profileId });
        setMessage({
          type: 'success',
          text: 'Automation started for profile'
        });
      } else {
        const profileIds = [...selectedForRun];
        if (profileIds.length === 0) {
          setMessage({ type: 'error', text: 'Chọn ít nhất một profile (checkbox) để chạy hàng loạt.' });
          setIsLoading(false);
          return;
        }
        await axios.post('/api/start', { profileIds, runMode: bulkRunMode });
        setMessage({
          type: 'success',
          text:
            bulkRunMode === 'sequential'
              ? `Đã bật chạy tuần tự cho ${profileIds.length} profile (theo thứ tự đã chọn)`
              : `Đã bật chạy cùng lúc cho ${profileIds.length} profile đã chọn`
        });
      }
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to start' });
    }
    setIsLoading(false);
  };

  const toggleProfileSelectedForRun = (id) => {
    setSelectedForRun((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected =
    filteredProfiles.length > 0 && filteredProfiles.every((p) => selectedForRun.has(p.id));

  const toggleSelectAllFiltered = () => {
    setSelectedForRun((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredProfiles.forEach((p) => next.delete(p.id));
      } else {
        filteredProfiles.forEach((p) => next.add(p.id));
      }
      return next;
    });
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
    if (processingRef.current.has(id)) return;

    // Optimistic update
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, is_scheduled: is_scheduled ? 1 : 0 } : p));
    processingRef.current.add(id);

    try {
      await axios.patch(`/api/profiles/${id}`, { is_scheduled });
      // Small delay to ensure DB is written and GET will find it
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileSchedules = async (id, timesStr) => {
    // timesStr is comma-separated e.g. "08:00, 18:00"
    const times = timesStr.split(',').map(t => t.trim()).filter(t => /^\d{2}:\d{2}$/.test(t));
    
    try {
      await axios.post(`/api/profiles/${id}/schedules`, { times });
      await fetchData();
      setMessage({ type: 'success', text: 'Schedule times updated' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to update schedule times' });
    }
  };

  const updateProfileSetMusic = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, set_music: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { set_music: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileAutoIncrementSchedule = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, auto_increment_schedule: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { auto_increment_schedule: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const selectFolderPath = async () => {
    try {
      const res = await axios.post('/api/select-folder');
      return res.data?.path || null;
    } catch (err) {
      console.error('Folder selection cancelled or failed');
      return null;
    }
  };

  const handleSelectFolder = async (id) => {
    setIsSelectingFolder(true);
    try {
      const selectedPath = await selectFolderPath();
      if (selectedPath) {
        await updateProfileFolder(id, selectedPath);
      }
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const handleSelectFolderForCreateProfile = async () => {
    setIsSelectingFolder(true);
    try {
      const selectedPath = await selectFolderPath();
      if (selectedPath) {
        setNewProfileVideoFolder(selectedPath);
      }
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
              onClick={() => setActiveTab('groups')}
              style={{ 
                width: '100%', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px', 
                padding: '12px 16px', 
                borderRadius: '12px',
                background: activeTab === 'groups' ? 'rgba(255, 63, 182, 0.1)' : 'transparent',
                color: activeTab === 'groups' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                marginTop: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Users size={20} /> Groups
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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '16px', alignItems: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Group
                      <select
                        className="input"
                        style={{ padding: '8px 12px', minWidth: '180px' }}
                        value={groupFilter}
                        onChange={(e) => setGroupFilter(e.target.value)}
                      >
                        <option value="all">All Groups</option>
                        <option value="ungrouped">Ungrouped</option>
                        {groups.map((g) => (
                          <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                      </select>
                    </label>
                    {filteredProfiles.length > 0 && (
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                          style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        Chọn tất cả (danh sách đang hiển thị)
                      </label>
                    )}
                    {selectedForRun.size > 0 && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--accent)' }}>
                        Đã chọn {selectedForRun.size} profile
                        {bulkRunMode === 'sequential' ? ' (chạy tuần tự)' : ' (chạy cùng lúc)'}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsCreateProfileModalOpen(true)}
                    style={{ gap: '10px' }}
                  >
                    <Plus size={18} />
                    Thêm mới
                  </button>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '160px' }}>
                    Kiểu chạy
                    <select
                      className="input"
                      value={bulkRunMode}
                      onChange={(e) => setBulkRunMode(e.target.value === 'sequential' ? 'sequential' : 'parallel')}
                      style={{ padding: '10px 12px', cursor: 'pointer' }}
                    >
                      <option value="parallel">Chạy cùng lúc</option>
                      <option value="sequential">Chạy tuần tự</option>
                    </select>
                  </label>
                  <button 
                    className="btn btn-primary"
                    onClick={() => startAutomation()}
                    disabled={isLoading || selectedForRun.size === 0}
                    title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần upload' : undefined}
                    style={{ gap: '10px' }}
                  >
                    {isLoading ? <RefreshCw className="animate-pulse" size={18} /> : <Play fill="white" size={18} />}
                    Chạy đã chọn
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
                <AnimatePresence mode="popLayout">
                  {filteredProfiles.map((profile) => (
                    <ProfileCard
                      key={profile.id}
                      profile={profile}
                      isSelected={selectedForRun.has(profile.id)}
                      onToggleSelected={toggleProfileSelectedForRun}
                      onDelete={deleteProfile}
                      onOpen={openProfile}
                      onStart={startAutomation}
                      onUpdateName={updateProfileName}
                      onUpdateGroup={updateProfileGroup}
                      onUpdateFolder={updateProfileFolder}
                      onSelectFolder={handleSelectFolder}
                      onUpdateProxy={updateProfileProxy}
                      onUpdateSchedule={updateProfileSchedule}
                      onUpdateSchedules={updateProfileSchedules}
                      onUpdateSetMusic={updateProfileSetMusic}
                      onUpdateAutoIncrementSchedule={updateProfileAutoIncrementSchedule}
                      groups={groups}
                      getStatusColor={getStatusColor}
                      editingId={editingId}
                      setEditingId={setEditingId}
                      editingValue={editingValue}
                      setEditingValue={setEditingValue}
                    />
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

              {profiles.length > 0 && filteredProfiles.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '48px 24px',
                    color: 'var(--text-muted)',
                    border: '2px dashed var(--border)',
                    borderRadius: '24px',
                    marginTop: '24px'
                  }}
                >
                  <p style={{ color: 'white', marginBottom: '8px', fontWeight: '600' }}>No profiles match this filter</p>
                  <p style={{ fontSize: '0.9rem' }}>Change the group filter above to see profiles.</p>
                </div>
              )}

              <AnimatePresence>
                {isCreateProfileModalOpen && (
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
                      padding: '24px'
                    }}
                    onClick={() => closeCreateProfileModal()}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      className="glass"
                      style={{ width: '100%', maxWidth: '460px', padding: '24px', borderRadius: '20px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Create Profile</h3>
                          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Add a new TikTok profile and assign a group</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => closeCreateProfileModal()}
                          disabled={isCreatingProfile || isSelectingFolder}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: isCreatingProfile || isSelectingFolder ? 'not-allowed' : 'pointer',
                            opacity: isCreatingProfile || isSelectingFolder ? 0.45 : 1
                          }}
                          aria-label="Close create profile modal"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div className="input-group">
                          <label>Profile Name</label>
                          <input
                            autoFocus
                            className="input"
                            placeholder="Nhập tên profile"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addProfile();
                              if (e.key === 'Escape') closeCreateProfileModal();
                            }}
                            disabled={isCreatingProfile || isSelectingFolder}
                          />
                        </div>

                        <div className="input-group">
                          <label>Group</label>
                          <select
                            className="input"
                            value={newProfileGroupId}
                            onChange={(e) => setNewProfileGroupId(e.target.value)}
                            disabled={isCreatingProfile || isSelectingFolder}
                          >
                            <option value="">No group</option>
                            {groups.map((g) => (
                              <option key={g.id} value={g.id}>
                                {g.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="input-group">
                          <label>Source Folder</label>
                          <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                              className="input"
                              placeholder="/path/to/videos"
                              value={newProfileVideoFolder}
                              onChange={(e) => setNewProfileVideoFolder(e.target.value)}
                              disabled={isCreatingProfile || isSelectingFolder}
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={handleSelectFolderForCreateProfile}
                              disabled={isCreatingProfile || isSelectingFolder}
                              style={{ padding: '0 15px' }}
                            >
                              <FolderOpen size={18} style={{ marginRight: '8px' }} />
                              Browse
                            </button>
                          </div>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                            Optional. Leave empty to use the global Video Source Folder.
                          </p>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                          <button type="button" className="btn btn-secondary" onClick={() => closeCreateProfileModal()} disabled={isCreatingProfile || isSelectingFolder}>
                            Cancel
                          </button>
                          <button className="btn btn-primary" onClick={addProfile} disabled={isCreatingProfile || isSelectingFolder || !newProfileName.trim()}>
                            {isCreatingProfile ? 'Creating...' : 'Create'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          ) : activeTab === 'groups' ? (
            <section>
              <div style={{ marginBottom: '28px' }}>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '8px' }}>Groups</h2>
                <p style={{ color: 'var(--text-muted)', maxWidth: '640px', lineHeight: 1.5 }}>
                  Tạo và đổi tên nhóm để gom profile. Gán profile vào nhóm từ tab Profiles; xóa nhóm chỉ khi không còn profile gán.
                </p>
              </div>

              <div className="glass" style={{ padding: '20px 24px', borderRadius: '20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <input
                    className="input"
                    placeholder="Tên nhóm mới..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    style={{ flex: '1 1 220px', minWidth: '200px', padding: '10px 14px' }}
                    onKeyDown={(e) => e.key === 'Enter' && addGroup()}
                  />
                  <button type="button" className="btn btn-primary" onClick={addGroup} style={{ padding: '10px 20px', gap: '8px' }}>
                    <Plus size={18} />
                    Create
                  </button>
                </div>
              </div>

              {groups.length === 0 ? (
                <div
                  className="glass"
                  style={{
                    textAlign: 'center',
                    padding: '56px 32px',
                    borderRadius: '24px',
                    color: 'var(--text-muted)',
                    border: '2px dashed var(--border)'
                  }}
                >
                  <Users size={40} style={{ margin: '0 auto 16px', opacity: 0.35 }} />
                  <p style={{ color: 'white', fontWeight: '600', marginBottom: '8px' }}>Chưa có nhóm</p>
                  <p style={{ fontSize: '0.9rem' }}>Nhập tên và bấm Create để thêm nhóm đầu tiên.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {groups.map((g) => (
                    <div
                      key={g.id}
                      className="glass"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        flexWrap: 'wrap',
                        padding: '16px 20px',
                        borderRadius: '16px',
                        border: '1px solid var(--border)'
                      }}
                    >
                      {editingGroupId === g.id ? (
                        <>
                          <input
                            autoFocus
                            className="input"
                            style={{ flex: '1 1 240px', padding: '8px 12px' }}
                            value={editingGroupValue}
                            onChange={(e) => setEditingGroupValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') updateGroupName(g.id, editingGroupValue);
                              if (e.key === 'Escape') setEditingGroupId(null);
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => updateGroupName(g.id, editingGroupValue)}
                            style={{ background: 'none', border: 'none', color: 'var(--success)', cursor: 'pointer', padding: '4px' }}
                            aria-label="Save name"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingGroupId(null)}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}
                            aria-label="Cancel rename"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <span style={{ flex: '1 1 180px', fontWeight: '700', fontSize: '1rem' }}>{g.name}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                            {g.profile_count ?? 0} profile{g.profile_count === 1 ? '' : 's'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGroupId(g.id);
                              setEditingGroupValue(g.name);
                            }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
                            aria-label="Rename group"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteGroup(g.id)}
                            style={{ background: 'none', border: 'none', color: 'rgba(239, 68, 68, 0.65)', cursor: 'pointer', padding: '6px' }}
                            aria-label="Delete group"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  ))}
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
