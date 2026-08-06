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
  FolderArchive,
  Download,
  Link,
  ExternalLink,
  Edit3,
  Check,
  X,
  Users,
  Music,
  Search,
  Heart,
  StopCircle,
  Upload,
  LogIn,
  Image,
  Camera,
  Share2
} from 'lucide-react';

import { motion, AnimatePresence } from 'framer-motion';
import EditProfileModal from './components/EditProfileModal';

const ProfileCard = ({
  profile,
  isSelected,
  onToggleSelected,
  onDelete,
  onOpen,
  onStart,
  onEngage,
  onStopEngage,
  isEngaging,
  onLoginTikTok,
  onStopLoginTikTok,
  isLoggingIn,
  onUpdateName,
  onChangeAvatar,
  isChangingAvatar,
  selectedAvatarPath,
  onAddFavoriteMusic,
  isAddingFavoriteMusic,
  musicSearchTerm,
  getStatusColor,
  editingId,
  setEditingId,
  editingValue,
  setEditingValue,
  onEdit
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass card"
      style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header - click to open edit modal */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '8px'
        }}
        onClick={() => onEdit(profile.id)}
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
        </div>
      </div>

      {/* Action buttons row - always visible */}
      <div style={{
        display: 'flex',
        gap: '6px',
        flexWrap: 'wrap',
        padding: '8px 4px 4px',
        justifyContent: 'flex-end'
      }}>
        <button
          className="btn"
          onClick={() => onOpen(profile.id)}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            color: 'white',
            border: '1px solid var(--border)',
            padding: '6px 12px',
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
          disabled={profile.status === 'uploading' || isEngaging}
          style={{
            background: profile.status === 'uploading' ? 'transparent' : 'rgba(255, 255, 255, 0.05)',
            color: profile.status === 'uploading' ? 'var(--accent)' : 'white',
            border: '1px solid var(--border)',
            padding: '6px 12px',
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

        {/* Auto Engage Button */}
        <button
          className="btn"
          onClick={() => isEngaging ? onStopEngage(profile.id) : onEngage(profile.id)}
          disabled={profile.status === 'uploading'}
          title={isEngaging ? 'Dừng Auto Engage' : 'Bắt đầu xem & tương tác TikTok tự động'}
          style={{
            background: isEngaging
              ? 'rgba(239, 68, 68, 0.12)'
              : 'rgba(236, 72, 153, 0.08)',
            color: isEngaging ? '#EF4444' : '#EC4899',
            border: `1px solid ${isEngaging ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.25)'}`,
            padding: '6px 12px',
            borderRadius: '8px',
            gap: '6px',
            fontWeight: '700',
            transition: 'all 0.2s',
            cursor: profile.status === 'uploading' ? 'not-allowed' : 'pointer'
          }}
        >
          {isEngaging ? (
            <>
              <StopCircle size={14} className="animate-pulse" />
              STOP
            </>
          ) : (
            <>
              <Heart size={14} />
              ENGAGE
            </>
          )}
        </button>

        {/* Login TikTok Button */}
        <button
          className="btn"
          onClick={() => isLoggingIn ? onStopLoginTikTok(profile.id) : onLoginTikTok(profile.id)}
          disabled={profile.status === 'uploading' || (!profile.cookies && !profile.email && !profile.pass)}
          title={(!profile.cookies && !profile.email && !profile.pass) ? 'Profile chưa có cookies hoặc email/password. Import CSV trước.' : (isLoggingIn ? 'Dừng Login' : 'Login TikTok')}
          style={{
            background: isLoggingIn
              ? 'rgba(239, 68, 68, 0.12)'
              : 'rgba(16, 185, 129, 0.08)',
            color: isLoggingIn ? '#EF4444' : '#10B981',
            border: `1px solid ${isLoggingIn ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.25)'}`,
            padding: '6px 12px',
            borderRadius: '8px',
            gap: '6px',
            fontWeight: '700',
            transition: 'all 0.2s',
            cursor: (profile.status === 'uploading' || (!profile.cookies && !profile.email && !profile.pass)) ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoggingIn ? (
            <>
              <StopCircle size={14} className="animate-pulse" />
              STOP
            </>
          ) : (
            <>
              <LogIn size={14} />
              LOGIN
            </>
          )}
        </button>

        {/* Change Avatar Button */}
        <button
          className="btn"
          onClick={() => onChangeAvatar(profile.id)}
          disabled={profile.status === 'uploading' || !selectedAvatarPath || isChangingAvatar}
          title={!selectedAvatarPath ? 'Select an avatar image first' : (isChangingAvatar ? 'Avatar change in progress...' : 'Change TikTok avatar')}
          style={{
            background: isChangingAvatar
              ? 'rgba(59, 130, 246, 0.12)'
              : 'rgba(59, 130, 246, 0.08)',
            color: isChangingAvatar ? '#3B82F6' : '#60A5FA',
            border: '1px solid rgba(59,130,246,0.25)',
            padding: '6px 12px',
            borderRadius: '8px',
            gap: '6px',
            fontWeight: '700',
            transition: 'all 0.2s',
            cursor: (profile.status === 'uploading' || !selectedAvatarPath) ? 'not-allowed' : 'pointer'
          }}
        >
          {isChangingAvatar ? (
            <RefreshCw size={14} className="animate-pulse" />
          ) : (
            <Camera size={14} />
          )}
          AVATAR
        </button>

        {/* Add Favorite Music Button */}
        <button
          className="btn"
          onClick={() => onAddFavoriteMusic(profile.id, musicSearchTerm || '')}
          disabled={
            profile.status === 'uploading' ||
            !musicSearchTerm ||
            !musicSearchTerm.trim() ||
            isAddingFavoriteMusic
          }
          title={
            !musicSearchTerm || !musicSearchTerm.trim()
              ? 'Enter a search term first'
              : isAddingFavoriteMusic
              ? 'Adding favorite music...'
              : 'Search and favorite a TikTok sound'
          }
          style={{
            background: isAddingFavoriteMusic
              ? 'rgba(168, 85, 247, 0.12)'
              : 'rgba(168, 85, 247, 0.08)',
            color: isAddingFavoriteMusic ? '#A855F7' : '#C084FC',
            border: '1px solid rgba(168,85,247,0.25)',
            padding: '6px 12px',
            borderRadius: '8px',
            gap: '6px',
            fontWeight: '700',
            transition: 'all 0.2s',
            cursor: (profile.status === 'uploading' || !musicSearchTerm || !musicSearchTerm.trim())
              ? 'not-allowed'
              : 'pointer'
          }}
        >
          {isAddingFavoriteMusic ? (
            <RefreshCw size={14} className="animate-pulse" />
          ) : (
            <Music size={14} />
          )}
          FAVORITES
        </button>
      </div>
    </motion.div>
  );
};

const App = () => {
  const [profiles, setProfiles] = useState([]);
  const [config, setConfig] = useState({ videoFolder: '', maxConcurrency: 2 });
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileGroupId, setNewProfileGroupId] = useState('');
  const [newProfileVideoFolder, setNewProfileVideoFolder] = useState('');
  const [newProfileChannelIds, setNewProfileChannelIds] = useState('');
  const [newProfileNeedsRender, setNewProfileNeedsRender] = useState(true);
  const [newProfileRenderConcatVideo, setNewProfileRenderConcatVideo] = useState(false);
  const [newProfileRemoveTitle, setNewProfileRemoveTitle] = useState(true);
  const [newProfileNeedContentCheck, setNewProfileNeedContentCheck] = useState(true);
  const [newProfileRenderVideoLong, setNewProfileRenderVideoLong] = useState(false);
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
  const [engagingProfiles, setEngagingProfiles] = useState(() => new Set());
  const [loggingInProfiles, setLoggingInProfiles] = useState(() => new Set());
  const [changingAvatarProfiles, setChangingAvatarProfiles] = useState(() => new Set());
  const [addingFavoriteMusicProfiles, setAddingFavoriteMusicProfiles] = useState(() => new Set());
  const [avatarSelections, setAvatarSelections] = useState({}); // profileId -> filePath
  const [musicSearchTerms, setMusicSearchTerms] = useState({}); // profileId -> searchTerm
  const [limitUploads, setLimitUploads] = useState(false);
  const [uploadLimitCount, setUploadLimitCount] = useState(1);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportFolderModalOpen, setIsImportFolderModalOpen] = useState(false);
  const [isExportFolderModalOpen, setIsExportFolderModalOpen] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [importResults, setImportResults] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importFolderPath, setImportFolderPath] = useState('');
  const [exportFolderPath, setExportFolderPath] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResults, setExportResults] = useState(null);
  const [editingProfileId, setEditingProfileId] = useState(null);

  // Distribution feature state
  const [distributionProfiles, setDistributionProfiles] = useState([]);
  const [showAddDistProfileModal, setShowAddDistProfileModal] = useState(false);
  const [showDistributeModal, setShowDistributeModal] = useState(false);
  const [distGroupFilter, setDistGroupFilter] = useState('all');
  const [selectedProfileIds, setSelectedProfileIds] = useState(new Set());
  const [sourceFolder, setSourceFolder] = useState('');
  const [videosPerProfile, setVideosPerProfile] = useState(1);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distributeResult, setDistributeResult] = useState(null);

  const editingProfile = editingProfileId
    ? profiles.find(p => p.id === editingProfileId)
    : null;

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
      const [pRes, cRes, gRes, dpRes] = await Promise.all([
        axios.get('/api/profiles'),
        axios.get('/api/config'),
        axios.get('/api/groups'),
        axios.get('/api/distribution/profiles')
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
      setDistributionProfiles(dpRes.data || []);

      // Sync engaging status from profile status field
      setEngagingProfiles(prev => {
        const next = new Set(prev);
        newProfiles.forEach(p => {
          if (p.status === 'engaging') next.add(p.id);
          else next.delete(p.id);
        });
        return next;
      });

      // Sync login status from profile status field
      setLoggingInProfiles(prev => {
        const next = new Set(prev);
        newProfiles.forEach(p => {
          if (p.status === 'logging_in') next.add(p.id);
          else next.delete(p.id);
        });
        return next;
      });

      // Sync changing avatar status from profile status field
      setChangingAvatarProfiles(prev => {
        const next = new Set(prev);
        newProfiles.forEach(p => {
          if (p.status === 'changing_avatar') next.add(p.id);
          else next.delete(p.id);
        });
        return next;
      });

      // Sync adding favorite music status from profile status field
      setAddingFavoriteMusicProfiles(prev => {
        const next = new Set(prev);
        newProfiles.forEach(p => {
          if (p.status === 'adding_favorite_music') next.add(p.id);
          else next.delete(p.id);
        });
        return next;
      });
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
    setNewProfileChannelIds('');
    setNewProfileNeedsRender(true);
    setNewProfileRenderConcatVideo(false);
    setNewProfileRemoveTitle(true);
    setNewProfileNeedContentCheck(true);
    setNewProfileRenderVideoLong(false);
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
        video_folder: newProfileVideoFolder.trim() || null,
        channel_ids: newProfileChannelIds.trim() || null,
        needs_render: newProfileNeedsRender,
        render_concat_video: newProfileRenderConcatVideo,
        remove_title: newProfileRemoveTitle,
        need_content_check: newProfileNeedContentCheck,
        render_video_long: newProfileRenderVideoLong,
        set_music: true
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

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setImportCsvText(ev.target.result);
    };
    reader.readAsText(file);
  };

  const handleImportCsv = async () => {
    if (!importCsvText.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng chọn file CSV trước' });
      return;
    }
    setIsImporting(true);
    setImportResults(null);
    try {
      const res = await axios.post('/api/profiles/import-csv', { csvText: importCsvText });
      setImportResults(res.data);
      await fetchData();
      setMessage({
        type: 'success',
        text: `Import xong: ${res.data.imported} profiles đã tạo, ${res.data.skipped} bỏ qua`
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi import CSV' });
      setImportResults(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFolder = async () => {
    if (!importFolderPath.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập đường dẫn thư mục' });
      return;
    }
    setIsImporting(true);
    setImportResults(null);
    try {
      const res = await axios.post('/api/profiles/import-folder', { folderPath: importFolderPath });
      setImportResults(res.data);
      await fetchData();
      setMessage({
        type: 'success',
        text: `Import xong: ${res.data.imported} profiles đã tạo, ${res.data.skipped} bỏ qua`
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi import thư mục' });
      setImportResults(null);
    } finally {
      setIsImporting(false);
    }
  };

  const closeImportModal = () => {
    if (isImporting) return;
    setIsImportModalOpen(false);
    setImportCsvText('');
    setImportFileName('');
    setImportResults(null);
  };

  const closeImportFolderModal = () => {
    if (isImporting) return;
    setIsImportFolderModalOpen(false);
    setImportFolderPath('');
    setImportResults(null);
  };

  const handleExportFolder = async (downloadZip = false) => {
    if (selectedForRun.size === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất 1 profile để export' });
      return;
    }
    setIsExporting(true);
    setExportResults(null);
    try {
      const res = await axios.post('/api/profiles/export-folder', {
        profileIds: Array.from(selectedForRun),
        exportPath: exportFolderPath,
        downloadZip
      });
      setExportResults(res.data);
      if (downloadZip && res.data.downloadUrl) {
        const link = document.createElement('a');
        link.href = res.data.downloadUrl;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setMessage({
        type: 'success',
        text: `Export thành công ${res.data.total} profiles (${res.data.exportedCookies} có cookie)`
      });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi export thư mục' });
      setExportResults(null);
    } finally {
      setIsExporting(false);
    }
  };

  const closeExportFolderModal = () => {
    if (isExporting) return;
    setIsExportFolderModalOpen(false);
    setExportFolderPath('');
    setExportResults(null);
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

  const deleteSelectedProfiles = async () => {
    if (selectedForRun.size === 0) return;
    if (!window.confirm(`Bạn có chắc muốn xóa ${selectedForRun.size} profile đã chọn? Việc này cũng sẽ xóa các folder liên quan.`)) return;
    try {
      await axios.post('/api/profiles/delete-multiple', { profileIds: Array.from(selectedForRun) });
      setSelectedForRun(new Set());
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi xóa profile');
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
        await axios.post('/api/start', { 
          profileId,
          limitUploads,
          uploadLimitCount
        });
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
        await axios.post('/api/start', { 
          profileIds, 
          runMode: bulkRunMode,
          limitUploads,
          uploadLimitCount
        });
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

  const startEngage = async (profileId) => {
    try {
      await axios.post('/api/engage', { profileId });
      setEngagingProfiles(prev => new Set([...prev, profileId]));
      setMessage({ type: 'success', text: 'Auto Engage started! ♥️ TikTok sẽ tự động xem video.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to start engage' });
    }
  };

  const stopEngage = async (profileId) => {
    try {
      await axios.post('/api/engage/stop', { profileId });
      setEngagingProfiles(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      setMessage({ type: 'success', text: 'Auto Engage dừng. Browser sẽ đóng sau vài giây.' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to stop engage' });
    }
  };

  const startLoginTikTok = async (profileId) => {
    try {
      await axios.post('/api/login-tiktok', { profileId });
      setLoggingInProfiles(prev => new Set([...prev, profileId]));
      setMessage({ type: 'success', text: 'Login TikTok started! Browser will open shortly.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to start login' });
    }
  };

  const stopLoginTikTok = async (profileId) => {
    try {
      await axios.post('/api/login-tiktok/stop', { profileId });
      setLoggingInProfiles(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      setMessage({ type: 'success', text: 'Login session stopping...' });
      setTimeout(() => setMessage(null), 4000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to stop login' });
    }
  };

  const startBulkLogin = async () => {
    const profileIds = [...selectedForRun];
    if (profileIds.length === 0) {
      setMessage({ type: 'error', text: 'Chọn ít nhất một profile để Login.' });
      return;
    }
    const missing = profileIds.filter(id => {
      const p = profiles.find(pr => pr.id === id);
      return !p || (!p.cookies && (!p.email || !p.pass));
    });
    if (missing.length > 0) {
      setMessage({ type: 'error', text: `${missing.length} profile thiếu cookies hoặc email/password (cần Import CSV trước).` });
      return;
    }
    setMessage({ type: 'success', text: `Bắt đầu Login cho ${profileIds.length} profile...` });
    for (const pid of profileIds) {
      if (loggingInProfiles.has(pid)) continue;
      try {
        await axios.post('/api/login-tiktok', { profileId: pid });
        setLoggingInProfiles(prev => new Set([...prev, pid]));
      } catch (err) {
        setMessage({ type: 'error', text: `Lỗi login profile ${pid}: ${err.response?.data?.error || err.message}` });
      }
    }
    setTimeout(() => setMessage(null), 6000);
  };

  const clearTrash = async () => {
    const profileIds = [...selectedForRun];
    if (profileIds.length === 0) {
      setMessage({ type: 'error', text: 'Chọn ít nhất một profile để Clear Trash.' });
      return;
    }
    setMessage({ type: 'info', text: `Đang dọn rác cho ${profileIds.length} profile...` });
    try {
      const res = await axios.post('/api/profiles/clear-trash', { profileIds });
      const { totalFreedMB } = res.data;
      if (totalFreedMB > 0) {
        setMessage({ type: 'success', text: `Đã giải phóng ${totalFreedMB} MB từ ${profileIds.length} profile.` });
      } else {
        setMessage({ type: 'info', text: 'Không có file rác nào cần dọn.' });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi khi dọn rác' });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const clearDebugFiles = async () => {
    if (!window.confirm('Xóa toàn bộ file debug PNG và dọn automation.log?\nHành động này không ảnh hưởng đến profile hay cookie.')) return;
    setMessage({ type: 'info', text: 'Đang xóa file debug...' });
    try {
      const res = await axios.post('/api/system/clear-debug');
      const { freedMB, deletedFiles } = res.data;
      setMessage({ type: 'success', text: `Đã xóa ${deletedFiles} file debug PNG + dọn log → giải phóng ${freedMB} MB` });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi khi xóa debug' });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const startBulkEngage = async () => {
    const profileIds = [...selectedForRun];
    if (profileIds.length === 0) {
      setMessage({ type: 'error', text: 'Chọn ít nhất một profile (checkbox) để Engage hàng loạt.' });
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const errors = [];

    await Promise.all(
      profileIds.map(async (profileId) => {
        // Bỏ qua các profile đã đang engage hoặc đang upload
        if (engagingProfiles.has(profileId)) return;
        try {
          await axios.post('/api/engage', { profileId });
          setEngagingProfiles(prev => new Set([...prev, profileId]));
          successCount++;
        } catch (err) {
          failCount++;
          errors.push(err.response?.data?.error || `Profile ${profileId} failed`);
        }
      })
    );

    if (successCount > 0) {
      setMessage({
        type: 'success',
        text: `♥️ Đã bật Auto Engage cho ${successCount} profile${failCount > 0 ? ` (${failCount} thất bại)` : ''}`
      });
    } else {
      setMessage({ type: 'error', text: errors[0] || 'Không có profile nào được bật Engage' });
    }
    setTimeout(() => setMessage(null), 5000);
  };

  const stopBulkEngage = async () => {
    const engagingSelected = [...selectedForRun].filter(id => engagingProfiles.has(id));
    if (engagingSelected.length === 0) {
      setMessage({ type: 'error', text: 'Không có profile nào đang engage trong danh sách đã chọn.' });
      return;
    }
    await Promise.all(engagingSelected.map(id => stopEngage(id)));
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

  const updateProfileChannelIds = async (id, channelIds) => {
    try {
      await axios.patch(`/api/profiles/${id}`, { channel_ids: channelIds });
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

  const updateProfileNeedsRender = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, needs_render: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { needs_render: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileRenderConcatVideo = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, render_concat_video: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { render_concat_video: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileRenderVideoLong = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, render_video_long: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { render_video_long: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileRemoveTitle = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, remove_title: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { remove_title: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileNeedContentCheck = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, need_content_check: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { need_content_check: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileUseFingerprint = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, use_fingerprint: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.post(`/api/profiles/${id}/toggle-fingerprint`);
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const resetProfileFingerprint = async (id) => {
    if (processingRef.current.has(id)) return;
    processingRef.current.add(id);
    try {
      await axios.post(`/api/profiles/${id}/random-fingerprint`);
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

  const updateProfileScheduleInterval = async (id, interval) => {
    if (processingRef.current.has(id)) return;
    const intervalNum = Number(interval);
    const intervalVal = [5, 10, 15, 20].includes(intervalNum) ? intervalNum : 5;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, schedule_interval: intervalVal } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { schedule_interval: intervalVal });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
    }
  };

  const updateProfileUploadCount = async (id, count) => {
    // Optimistic update
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, upload_count: count } : p))
    );
    try {
      await axios.patch(`/api/profiles/${id}`, { upload_count: count });
      // Small delay to ensure DB consistency
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
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

  const selectAvatarPath = async () => {
    try {
      const res = await axios.post('/api/select-image-file');
      return res.data?.path || null;
    } catch (err) {
      console.error('Image file selection cancelled or failed');
      return null;
    }
  };

  const handleSelectAvatar = async (id) => {
    setIsSelectingFolder(true);
    try {
      const selectedPath = await selectAvatarPath();
      if (selectedPath) {
        setAvatarSelections(prev => ({ ...prev, [id]: selectedPath }));
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

  const handleChangeAvatar = async (profileId) => {
    const avatarImage = avatarSelections[profileId];
    if (!avatarImage) {
      setMessage({ type: 'error', text: 'Please select an avatar image first' });
      return;
    }
    try {
      setChangingAvatarProfiles(prev => new Set([...prev, profileId]));
      await axios.post('/api/change-avatar', { profileId, avatarImage });
      setMessage({ type: 'success', text: 'Avatar change started! Browser will open shortly.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setChangingAvatarProfiles(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to change avatar' });
    }
  };

  const handleAddFavoriteMusic = async (profileId, searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) {
      setMessage({ type: 'error', text: 'Please enter a search term' });
      return;
    }
    try {
      setAddingFavoriteMusicProfiles(prev => new Set([...prev, profileId]));
      await axios.post('/api/add-favorite-music', { profileId, searchTerm: searchTerm.trim() });
      setMessage({ type: 'success', text: 'Adding favorite music! Browser will open shortly.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (err) {
      setAddingFavoriteMusicProfiles(prev => {
        const next = new Set(prev);
        next.delete(profileId);
        return next;
      });
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to add favorite music' });
    }
  };

  const handleUpdateMusicSearchTerm = async (profileId, value) => {
    setMusicSearchTerms(prev => ({ ...prev, [profileId]: value }));
    try {
      await axios.patch(`/api/profiles/${profileId}`, { music_search: value });
    } catch (err) {
      console.error('Failed to save music_search:', err);
    }
  };

  const handleEditProfile = (profileId) => {
    // Load existing music_search from profile data into the edit state
    const profile = profiles.find(p => p.id === profileId);
    if (profile?.music_search) {
      setMusicSearchTerms(prev => ({ ...prev, [profileId]: profile.music_search }));
    }
    setEditingProfileId(profileId);
  };

  const handleCloseEditProfile = () => {
    setEditingProfileId(null);
  };

  const handleRemoveDistProfile = async (profileId) => {
    try {
      await axios.delete(`/api/distribution/profiles/${profileId}`);
      setDistributionProfiles(prev => prev.filter(p => p.profile_id !== profileId));
      setMessage({ type: 'success', text: 'Đã xoá profile khỏi danh sách phân phối' });
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi khi xoá profile' });
    }
  };

  const handleAddDistProfiles = async () => {
    const ids = [...selectedProfileIds];
    if (ids.length === 0) return;

    let added = 0;
    let errors = 0;
    let lastError = '';
    for (const profileId of ids) {
      try {
        await axios.post('/api/distribution/profiles', { profile_id: profileId });
        added++;
      } catch (err) {
        if (err.response?.status === 409) {
          // Already in list, skip
        } else {
          errors++;
          lastError = err.response?.data?.error || err.message;
        }
      }
    }

    setSelectedProfileIds(new Set());
    setShowAddDistProfileModal(false);

    // Refresh distribution list
    try {
      const dpRes = await axios.get('/api/distribution/profiles');
      setDistributionProfiles(dpRes.data || []);
    } catch (e) { /* ignore */ }

    if (added > 0) {
      setMessage({ type: 'success', text: `Đã thêm ${added} profile vào danh sách phân phối` });
    }
    if (errors > 0) {
      setMessage({ type: 'error', text: `Có ${errors} lỗi khi thêm profile${lastError ? ': ' + lastError : ''}` });
    }
  };

  const handleDistribute = async () => {
    if (!sourceFolder.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập folder nguồn' });
      return;
    }
    if (videosPerProfile < 1) {
      setMessage({ type: 'error', text: 'Số lượng video mỗi profile phải >= 1' });
      return;
    }

    setIsDistributing(true);
    setDistributeResult(null);
    try {
      const res = await axios.post('/api/distribution/distribute', {
        sourceFolder: sourceFolder.trim(),
        videosPerProfile
      });
      setDistributeResult(res.data);
      if (res.data.missing > 0) {
        setMessage({ type: 'warning', text: `Đã phân phối ${res.data.totalDistributed}/${res.data.totalExpected} video. Thiếu ${res.data.missing} video.` });
      } else {
        setMessage({ type: 'success', text: `Đã phân phối thành công ${res.data.totalDistributed} video!` });
      }
    } catch (err) {
      setDistributeResult({ error: err.response?.data?.error || 'Lỗi khi phân phối video' });
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi khi phân phối video' });
    } finally {
      setIsDistributing(false);
    }
  };

  // Compute profiles NOT already in distribution (for the modal)
  const availableForDist = useMemo(() => {
    const distIds = new Set(distributionProfiles.map(p => p.profile_id));
    return profiles.filter(p => !distIds.has(p.id));
  }, [profiles, distributionProfiles]);

  const filteredDistAvailable = useMemo(() => {
    if (distGroupFilter === 'all') return availableForDist;
    if (distGroupFilter === 'ungrouped') {
      return availableForDist.filter(p => !p.group_id);
    }
    return availableForDist.filter(p => p.group_id === distGroupFilter);
  }, [availableForDist, distGroupFilter]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'uploading': return 'var(--accent)';
      case 'logging_in': return '#10B981';
      case 'engaging': return '#EC4899';
      case 'changing_avatar': return '#3B82F6';
      case 'adding_favorite_music': return '#A855F7';
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
            <button
              onClick={() => setActiveTab('distribution')}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                borderRadius: '12px',
                background: activeTab === 'distribution' ? 'rgba(255, 63, 182, 0.1)' : 'transparent',
                color: activeTab === 'distribution' ? 'var(--primary)' : 'var(--text-muted)',
                border: 'none',
                cursor: 'pointer',
                fontWeight: '600',
                marginTop: '8px',
                transition: 'all 0.2s'
              }}
            >
              <Share2 size={20} /> Phân Phối Video
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
                background: message.type === 'error'
                  ? 'rgba(239, 68, 68, 0.1)'
                  : message.type === 'warning'
                    ? 'rgba(251, 191, 36, 0.1)'
                    : message.type === 'info'
                      ? 'rgba(59, 130, 246, 0.1)'
                      : 'rgba(16, 185, 129, 0.1)',
                color: message.type === 'error'
                  ? '#EF4444'
                  : message.type === 'warning'
                    ? '#FBBF24'
                    : message.type === 'info'
                      ? '#3B82F6'
                      : '#10B981',
                border: `1px solid ${
                  message.type === 'error'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : message.type === 'warning'
                      ? 'rgba(251, 191, 36, 0.2)'
                      : message.type === 'info'
                        ? 'rgba(59, 130, 246, 0.2)'
                        : 'rgba(16, 185, 129, 0.2)'
                }`,
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                zIndex: 100
              }}
            >
              {message.type === 'error' ? <AlertCircle size={20} /> : message.type === 'warning' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
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
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsCreateProfileModalOpen(true)}
                    style={{ gap: '10px' }}
                  >
                    <Plus size={18} />
                    Thêm mới
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsImportModalOpen(true)}
                    style={{ gap: '10px' }}
                  >
                    <Upload size={18} />
                    Import CSV
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsImportFolderModalOpen(true)}
                    style={{ gap: '10px' }}
                  >
                    <FolderOpen size={18} />
                    Import Folder
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setIsExportFolderModalOpen(true)}
                    disabled={selectedForRun.size === 0}
                    title={selectedForRun.size === 0 ? 'Tick checkbox trên các profile cần export' : 'Export danh sách profile đã chọn thành thư mục/ZIP theo format TikTok_Export'}
                    style={{
                      gap: '10px',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: '#3B82F6',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      fontWeight: '700',
                      opacity: selectedForRun.size === 0 ? 0.45 : 1,
                      cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Download size={18} />
                    Export Folder ({selectedForRun.size})
                  </button>
                  <button
                    className="btn"
                    onClick={clearTrash}
                    disabled={selectedForRun.size === 0}
                    title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần dọn rác' : 'Xoá cache/thùng rác của các profile đã chọn để tiết kiệm dung lượng'}
                    style={{
                      gap: '10px',
                      background: 'rgba(239, 155, 68, 0.08)',
                      color: '#F59E0B',
                      border: '1px solid rgba(245, 158, 11, 0.25)',
                      fontWeight: '700',
                      opacity: selectedForRun.size === 0 ? 0.45 : 1,
                      cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Trash2 size={18} />
                    Clear Trash
                  </button>
                  <button
                    className="btn"
                    onClick={clearDebugFiles}
                    title="Xóa file debug PNG và dọn automation.log để giải phóng dung lượng (~300-600MB)"
                    style={{
                      gap: '10px',
                      background: 'rgba(139, 92, 246, 0.08)',
                      color: '#8B5CF6',
                      border: '1px solid rgba(139, 92, 246, 0.25)',
                      fontWeight: '700',
                    }}
                  >
                    <Trash2 size={18} />
                    Clear Debug
                  </button>
                  <button
                    className="btn"
                    onClick={deleteSelectedProfiles}
                    disabled={selectedForRun.size === 0}
                    title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần xóa' : 'Xoá các profile đã chọn và folder của chúng'}
                    style={{
                      gap: '10px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#EF4444',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      fontWeight: '700',
                      opacity: selectedForRun.size === 0 ? 0.45 : 1,
                      cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Trash2 size={18} />
                    Xóa Profile
                  </button>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Giới hạn upload
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', height: '40px', padding: '0 12px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)', userSelect: 'none' }}>
                      <input
                        type="checkbox"
                        checked={limitUploads}
                        onChange={(e) => setLimitUploads(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: 'white' }}>Bật</span>
                    </label>
                  </label>
                  {limitUploads && (
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '80px' }}>
                      Số video
                      <input
                        type="number"
                        className="input"
                        style={{ padding: '10px 12px', height: '40px' }}
                        min="1"
                        value={uploadLimitCount}
                        onChange={(e) => setUploadLimitCount(parseInt(e.target.value) || 1)}
                      />
                    </label>
                  )}
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)', minWidth: '140px' }}>
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

                  {/* Bulk Login button */}
                  <button
                    className="btn"
                    onClick={startBulkLogin}
                    disabled={selectedForRun.size === 0 || isLoading}
                    title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần Login' : 'Login TikTok cho tất cả đã chọn'}
                    style={{
                      gap: '10px',
                      background: 'rgba(16, 185, 129, 0.08)',
                      color: '#10B981',
                      border: '1px solid rgba(16, 185, 129, 0.25)',
                      fontWeight: '700',
                      opacity: (selectedForRun.size === 0 || isLoading) ? 0.45 : 1,
                      cursor: (selectedForRun.size === 0 || isLoading) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <LogIn size={18} />
                    Login đã chọn
                  </button>

                  {/* Bulk Engage button */}
                  {(() => {
                    const selectedEngaging = [...selectedForRun].filter(id => engagingProfiles.has(id));
                    const allSelectedEngaging = selectedForRun.size > 0 && selectedEngaging.length === selectedForRun.size;
                    return (
                      <button
                        className="btn"
                        onClick={() => allSelectedEngaging ? stopBulkEngage() : startBulkEngage()}
                        disabled={selectedForRun.size === 0}
                        title={selectedForRun.size === 0 ? 'Tick checkbox trên từng profile cần Engage' : (allSelectedEngaging ? 'Dừng Engage tất cả đã chọn' : 'Bật Auto Engage cho tất cả đã chọn')}
                        style={{
                          gap: '10px',
                          background: allSelectedEngaging ? 'rgba(239,68,68,0.1)' : 'rgba(236,72,153,0.1)',
                          color: allSelectedEngaging ? '#EF4444' : '#EC4899',
                          border: `1px solid ${allSelectedEngaging ? 'rgba(239,68,68,0.3)' : 'rgba(236,72,153,0.3)'}`,
                          fontWeight: '700',
                          opacity: selectedForRun.size === 0 ? 0.45 : 1,
                          cursor: selectedForRun.size === 0 ? 'not-allowed' : 'pointer'
                        }}
                      >
                        {allSelectedEngaging
                          ? <><StopCircle size={18} className="animate-pulse" /> Stop Engage</>
                          : <><Heart size={18} /> Engage đã chọn</>
                        }
                      </button>
                    );
                  })()}
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
                      onEngage={startEngage}
                      onStopEngage={stopEngage}
                      isEngaging={engagingProfiles.has(profile.id)}
                      onLoginTikTok={startLoginTikTok}
                      onStopLoginTikTok={stopLoginTikTok}
                      isLoggingIn={loggingInProfiles.has(profile.id)}
                      onUpdateName={updateProfileName}
                      onChangeAvatar={handleChangeAvatar}
                      isChangingAvatar={changingAvatarProfiles.has(profile.id)}
                      selectedAvatarPath={avatarSelections[profile.id] || ''}
                      onAddFavoriteMusic={handleAddFavoriteMusic}
                      isAddingFavoriteMusic={addingFavoriteMusicProfiles.has(profile.id)}
                      musicSearchTerm={musicSearchTerms[profile.id] || ''}
                      getStatusColor={getStatusColor}
                      editingId={editingId}
                      setEditingId={setEditingId}
                      editingValue={editingValue}
                      setEditingValue={setEditingValue}
                      onEdit={handleEditProfile}
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

                        <div className="input-group">
                          <label>Channel IDs (comma separated)</label>
                          <textarea
                            className="input"
                            style={{ minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }}
                            placeholder="e.g. UC123, UC456"
                            value={newProfileChannelIds}
                            onChange={(e) => setNewProfileChannelIds(e.target.value)}
                            disabled={isCreatingProfile || isSelectingFolder}
                            rows={3}
                          />
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '8px' }}>
                            Optional. List of managed channel IDs, comma-separated.
                          </p>
                        </div>

                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                            <input
                              type="checkbox"
                              checked={newProfileNeedsRender}
                              onChange={(e) => setNewProfileNeedsRender(e.target.checked)}
                              disabled={isCreatingProfile || isSelectingFolder}
                              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Render video bypass</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mặc định bật. Tắt đi nếu muốn giữ nguyên video gốc.</span>
                            </div>
                          </label>
                        </div>

                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                            <input
                              type="checkbox"
                              checked={newProfileRenderConcatVideo}
                              onChange={(e) => setNewProfileRenderConcatVideo(e.target.checked)}
                              disabled={isCreatingProfile || isSelectingFolder}
                              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Render concat video</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Nối video tải về với 1 video ngẫu nhiên trong thư mục concat_videos.</span>
                            </div>
                          </label>
                        </div>

                        <div className="input-group" style={{ marginBottom: '12px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                            <input
                              type="checkbox"
                              checked={newProfileRemoveTitle}
                              onChange={(e) => setNewProfileRemoveTitle(e.target.checked)}
                              disabled={isCreatingProfile || isSelectingFolder}
                              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Xóa tiêu đề khi upload</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mặc định bật. Tắt đi nếu muốn giữ lại tiêu đề gốc làm caption.</span>
                            </div>
                          </label>
                        </div>

                        <div className="input-group" style={{ marginBottom: '24px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                            <input
                              type="checkbox"
                              checked={newProfileRenderVideoLong}
                              onChange={(e) => setNewProfileRenderVideoLong(e.target.checked)}
                              disabled={isCreatingProfile || isSelectingFolder}
                              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Render video dài (&gt;3p cắt nhỏ, up tất cả ngay)</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mặc định tắt. Tự động cắt video dài thành nhiều phần, upload toàn bộ.</span>
                            </div>
                          </label>
                        </div>

                        <div className="input-group" style={{ marginBottom: '24px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '10px', borderRadius: '12px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border)' }}>
                            <input
                              type="checkbox"
                              checked={newProfileNeedContentCheck}
                              onChange={(e) => setNewProfileNeedContentCheck(e.target.checked)}
                              disabled={isCreatingProfile || isSelectingFolder}
                              style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                            />
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: '700' }}>Kiểm tra nội dung (Content Check)</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Mặc định bật. Tắt đi nếu muốn bỏ qua Content Check Lite của TikTok khi upload.</span>
                            </div>
                          </label>
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

              {/* Import CSV Modal */}
              <AnimatePresence>
                {isImportModalOpen && (
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
                    onClick={() => closeImportModal()}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      className="glass"
                      style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '20px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Import CSV Profiles</h3>
                          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            Tạo hàng loạt profile từ file CSV
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => closeImportModal()}
                          disabled={isImporting}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: isImporting ? 'not-allowed' : 'pointer',
                            opacity: isImporting ? 0.45 : 1
                          }}
                          aria-label="Close import modal"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div style={{
                          padding: '20px',
                          borderRadius: '14px',
                          background: 'rgba(255,255,255,0.03)',
                          border: '2px dashed var(--border)',
                          textAlign: 'center'
                        }}>
                          <Upload size={28} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.5 }} />
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            File CSV cần có các cột:
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--accent)', fontFamily: 'monospace', marginBottom: '16px' }}>
                            profile_name, group_name, account_id, pass, email, pass_email, cookies, music_search
                          </p>
                          <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileSelect}
                            disabled={isImporting}
                            style={{
                              display: 'block',
                              width: '100%',
                              padding: '12px',
                              borderRadius: '10px',
                              background: 'rgba(0,0,0,0.3)',
                              color: 'white',
                              border: '1px solid var(--border)',
                              cursor: isImporting ? 'not-allowed' : 'pointer',
                              fontSize: '0.85rem'
                            }}
                          />
                          {importFileName && (
                            <p style={{ fontSize: '0.8rem', color: 'var(--success)', marginTop: '10px' }}>
                              Đã chọn: {importFileName}
                            </p>
                          )}
                        </div>

                        {importResults && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{
                              padding: '16px',
                              borderRadius: '12px',
                              background: importResults.errors.length > 0
                                ? 'rgba(234, 179, 8, 0.08)'
                                : 'rgba(16, 185, 129, 0.08)',
                              border: `1px solid ${importResults.errors.length > 0
                                ? 'rgba(234, 179, 8, 0.25)'
                                : 'rgba(16, 185, 129, 0.25)'}`
                            }}
                          >
                            <div style={{ display: 'flex', gap: '20px', marginBottom: importResults.errors.length > 0 ? '12px' : 0 }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                                Đã import: <strong>{importResults.imported}</strong>
                              </span>
                              <span style={{ fontSize: '0.85rem', color: '#EAB308' }}>
                                Bỏ qua: <strong>{importResults.skipped}</strong>
                              </span>
                            </div>
                            {importResults.errors.length > 0 && (
                              <div style={{
                                maxHeight: '120px',
                                overflowY: 'auto',
                                fontSize: '0.75rem',
                                color: '#EAB308',
                                lineHeight: 1.5
                              }}>
                                {importResults.errors.slice(0, 10).map((err, i) => (
                                  <div key={i}>{err}</div>
                                ))}
                                {importResults.errors.length > 10 && (
                                  <div>... và {importResults.errors.length - 10} lỗi khác</div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                          <button type="button" className="btn btn-secondary" onClick={() => closeImportModal()} disabled={isImporting}>
                            Đóng
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={handleImportCsv}
                            disabled={isImporting || !importCsvText.trim()}
                            style={{ gap: '8px' }}
                          >
                            {isImporting ? (
                              <>
                                <RefreshCw size={16} className="animate-pulse" />
                                Đang import...
                              </>
                            ) : (
                              <>
                                <Upload size={16} />
                                Import
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Import Folder Modal */}
              <AnimatePresence>
                {isImportFolderModalOpen && (
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
                    onClick={() => closeImportFolderModal()}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      className="glass"
                      style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '20px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Import Export Folder</h3>
                          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            Import danh sách tài khoản kèm cookie từ thư mục export
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => closeImportFolderModal()}
                          disabled={isImporting}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: isImporting ? 'not-allowed' : 'pointer',
                            opacity: isImporting ? 0.45 : 1
                          }}
                          aria-label="Close import folder modal"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Đường dẫn thư mục tuyệt đối trên server:
                          </label>
                          <input
                            type="text"
                            placeholder="Ví dụ: D:\TIKTOK\upload_tiktok\TikTok_Export_checked_1TK_20260724"
                            value={importFolderPath}
                            onChange={(e) => setImportFolderPath(e.target.value)}
                            disabled={isImporting}
                            style={{
                              padding: '12px',
                              borderRadius: '10px',
                              background: 'rgba(0,0,0,0.3)',
                              color: 'white',
                              border: '1px solid var(--border)',
                              fontSize: '0.85rem',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          />
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                            * Thư mục này phải chứa file <code>config.json</code> và thư mục con <code>cookies/</code> chứa các file <code>.json</code> cookie.<br/>
                            * Tài khoản nào không có cookie tương ứng sẽ bị tự động bỏ qua.
                          </p>
                        </div>

                        {importResults && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{
                              padding: '16px',
                              borderRadius: '12px',
                              background: importResults.errors.length > 0
                                ? 'rgba(234, 179, 8, 0.08)'
                                : 'rgba(16, 185, 129, 0.08)',
                              border: `1px solid ${importResults.errors.length > 0
                                ? 'rgba(234, 179, 8, 0.25)'
                                : 'rgba(16, 185, 129, 0.25)'}`
                            }}
                          >
                            <div style={{ display: 'flex', gap: '20px', marginBottom: importResults.errors.length > 0 ? '12px' : 0 }}>
                              <span style={{ fontSize: '0.85rem', color: 'var(--success)' }}>
                                Đã import: <strong>{importResults.imported}</strong>
                              </span>
                              <span style={{ fontSize: '0.85rem', color: '#EAB308' }}>
                                Bỏ qua: <strong>{importResults.skipped}</strong>
                              </span>
                            </div>
                            {importResults.errors.length > 0 && (
                              <div style={{
                                maxHeight: '120px',
                                overflowY: 'auto',
                                fontSize: '0.75rem',
                                color: '#EAB308',
                                lineHeight: 1.5
                              }}>
                                {importResults.errors.slice(0, 15).map((err, i) => (
                                  <div key={i}>{err}</div>
                                ))}
                                {importResults.errors.length > 15 && (
                                  <div>... và {importResults.errors.length - 15} lỗi khác</div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                          <button type="button" className="btn btn-secondary" onClick={() => closeImportFolderModal()} disabled={isImporting}>
                            Đóng
                          </button>
                          <button
                            className="btn btn-primary"
                            onClick={handleImportFolder}
                            disabled={isImporting || !importFolderPath.trim()}
                            style={{ gap: '8px' }}
                          >
                            {isImporting ? (
                              <>
                                <RefreshCw size={16} className="animate-pulse" />
                                Đang import...
                              </>
                            ) : (
                              <>
                                <Upload size={16} />
                                Import
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Export Folder Modal */}
              <AnimatePresence>
                {isExportFolderModalOpen && (
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
                    onClick={() => closeExportFolderModal()}
                  >
                    <motion.div
                      initial={{ opacity: 0, y: 12, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 12, scale: 0.98 }}
                      className="glass"
                      style={{ width: '100%', maxWidth: '540px', padding: '24px', borderRadius: '20px' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div>
                          <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Export Folder (Cookie Login)</h3>
                          <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            Xuất {selectedForRun.size} profile đã chọn thành thư mục chuẩn format TikTok_Export
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => closeExportFolderModal()}
                          disabled={isExporting}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: isExporting ? 'not-allowed' : 'pointer',
                            opacity: isExporting ? 0.45 : 1
                          }}
                          aria-label="Close export folder modal"
                        >
                          <X size={18} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gap: '16px' }}>
                        <div style={{ display: 'grid', gap: '8px' }}>
                          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Đường dẫn thư mục xuất tuyệt đối (Tùy chọn, để trống sẽ tự tạo thư mục mới):
                          </label>
                          <input
                            type="text"
                            placeholder={`D:\\TIKTOK\\upload_tiktok\\TikTok_Export_selected_${selectedForRun.size}TK`}
                            value={exportFolderPath}
                            onChange={(e) => setExportFolderPath(e.target.value)}
                            disabled={isExporting}
                            style={{
                              padding: '12px',
                              borderRadius: '10px',
                              background: 'rgba(0,0,0,0.3)',
                              color: 'white',
                              border: '1px solid var(--border)',
                              fontSize: '0.85rem',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          />
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                            * Kết quả xuất bao gồm file <code>config.json</code>, <code>archive.json</code> và thư mục <code>cookies/</code> chứa cookie JSON từng tài khoản.<br/>
                            * Thư mục này dùng để import trực tiếp sang máy khác thông qua nút <b>Import Folder</b>.
                          </p>
                        </div>

                        {exportResults && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{
                              padding: '16px',
                              borderRadius: '12px',
                              background: 'rgba(34, 197, 94, 0.08)',
                              border: '1px solid rgba(34, 197, 94, 0.25)',
                              fontSize: '0.85rem'
                            }}
                          >
                            <div style={{ fontWeight: '700', color: '#4ADE80', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <CheckCircle2 size={16} />
                              Export hoàn tất!
                            </div>
                            <div style={{ display: 'grid', gap: '4px', color: 'var(--text-muted)' }}>
                              <div>• Tổng profile đã chọn: <b>{exportResults.total}</b></div>
                              <div>• Cookie đã ghi ra file JSON: <b>{exportResults.exportedCookies}</b></div>
                              {exportResults.missingCookies > 0 && (
                                <div style={{ color: '#FBBF24' }}>
                                  • Profile chưa có cookie trong DB: <b>{exportResults.missingCookies}</b>
                                </div>
                              )}
                              <div style={{ marginTop: '6px', wordBreak: 'break-all' }}>
                                • Thư mục: <code style={{ color: '#60A5FA' }}>{exportResults.exportPath}</code>
                              </div>
                            </div>
                          </motion.div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => closeExportFolderModal()}
                            disabled={isExporting}
                          >
                            Đóng
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleExportFolder(false)}
                            disabled={isExporting || selectedForRun.size === 0}
                            style={{ gap: '8px' }}
                          >
                            <FolderArchive size={16} />
                            {isExporting ? 'Đang export...' : 'Xuất ra Thư mục'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => handleExportFolder(true)}
                            disabled={isExporting || selectedForRun.size === 0}
                            style={{
                              gap: '8px',
                              background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
                            }}
                          >
                            <Download size={16} />
                            {isExporting ? 'Đang export...' : 'Xuất & Tải .ZIP'}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Edit Profile Modal */}
              <EditProfileModal
                isOpen={editingProfileId !== null}
                onClose={handleCloseEditProfile}
                profile={editingProfile}
                groups={groups}
                getStatusColor={getStatusColor}
                onUpdateGroup={updateProfileGroup}
                onUpdateFolder={updateProfileFolder}
                onSelectFolder={handleSelectFolder}
                onUpdateProxy={updateProfileProxy}
                onUpdateChannelIds={updateProfileChannelIds}
                onUpdateSchedule={updateProfileSchedule}
                onUpdateSchedules={updateProfileSchedules}
                onUpdateSetMusic={updateProfileSetMusic}
                onUpdateAutoIncrementSchedule={updateProfileAutoIncrementSchedule}
                onUpdateScheduleInterval={updateProfileScheduleInterval}
                onUpdateUploadCount={updateProfileUploadCount}
                onUpdateNeedsRender={updateProfileNeedsRender}
                onUpdateRenderConcatVideo={updateProfileRenderConcatVideo}
                onUpdateRenderVideoLong={updateProfileRenderVideoLong}
                onUpdateRemoveTitle={updateProfileRemoveTitle}
                onUpdateNeedContentCheck={updateProfileNeedContentCheck}
                onUpdateUseFingerprint={updateProfileUseFingerprint}
                onResetFingerprint={resetProfileFingerprint}
                onSelectAvatar={handleSelectAvatar}
                selectedAvatarPath={editingProfileId ? (avatarSelections[editingProfileId] || '') : ''}
                musicSearchTerm={editingProfileId ? (musicSearchTerms[editingProfileId] || '') : ''}
                onUpdateMusicSearchTerm={handleUpdateMusicSearchTerm}
              />
            </section>
          ) : activeTab === 'distribution' ? (
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '4px' }}>Phân Phối Video</h2>
                  <p style={{ color: 'var(--text-muted)' }}>Chọn profile và phân phối video vào các folder upload</p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowAddDistProfileModal(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                  <Plus size={18} /> Thêm Profile
                </button>
              </div>

              {/* Distribution profile cards */}
              <div style={{ marginBottom: '24px' }}>
                {distributionProfiles.length === 0 ? (
                  <div className="glass" style={{ padding: '48px 24px', borderRadius: '20px', textAlign: 'center' }}>
                    <Share2 size={40} color="var(--text-muted)" style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <h3 style={{ fontWeight: '600', marginBottom: '8px', color: 'var(--text-muted)' }}>Chưa có profile nào được chọn</h3>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Thêm profile để bắt đầu phân phối video</p>
                    <button
                      className="btn btn-primary"
                      onClick={() => setShowAddDistProfileModal(true)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Plus size={18} /> Thêm Profile
                    </button>
                  </div>
                ) : (
                  <div className="profile-grid">
                    {distributionProfiles.map(dp => (
                      <motion.div
                        key={dp.profile_id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="glass card"
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ padding: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '1rem', marginBottom: '4px' }}>{dp.profile_name}</div>
                              {dp.group_name && (
                                <span className="badge" style={{ fontSize: '0.75rem' }}>{dp.group_name}</span>
                              )}
                            </div>
                            <button
                              onClick={() => handleRemoveDistProfile(dp.profile_id)}
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', minWidth: 'unset' }}
                              title="Xoá khỏi danh sách"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <FolderOpen size={14} />
                            <span style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>{dp.video_folder || '(default)'}</span>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Distribute button */}
              {distributionProfiles.length > 0 && (
                <div style={{ marginTop: '24px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setSourceFolder('');
                      setVideosPerProfile(1);
                      setDistributeResult(null);
                      setShowDistributeModal(true);
                    }}
                    disabled={isDistributing}
                    style={{
                      width: '100%',
                      padding: '14px 20px',
                      fontSize: '1.05rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '10px'
                    }}
                  >
                    <Share2 size={20} /> Phân Phối Video
                  </button>
                </div>
              )}
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

      {/* Add Distribution Profile Modal */}
      <AnimatePresence>
        {showAddDistProfileModal && (
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
            onClick={() => {
              setSelectedProfileIds(new Set());
              setShowAddDistProfileModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="glass"
              style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '20px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Thêm Profile</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>Chọn profile để thêm vào danh sách phân phối</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProfileIds(new Set());
                    setShowAddDistProfileModal(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Group
                  <select
                    className="input"
                    style={{ padding: '8px 12px', minWidth: '180px' }}
                    value={distGroupFilter}
                    onChange={(e) => setDistGroupFilter(e.target.value)}
                  >
                    <option value="all">Tất cả</option>
                    <option value="ungrouped">Ungrouped</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ maxHeight: '360px', overflowY: 'auto', marginBottom: '20px' }}>
                {filteredDistAvailable.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
                    <p>Không có profile nào khả dụng</p>
                  </div>
                ) : (
                  filteredDistAvailable.map(p => (
                    <label
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '12px 16px',
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                        background: selectedProfileIds.has(p.id) ? 'rgba(255, 63, 182, 0.08)' : 'transparent'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedProfileIds.has(p.id)}
                        onChange={() => {
                          setSelectedProfileIds(prev => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          });
                        }}
                        style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{p.name}</div>
                        {p.group_name && (
                          <span className="badge" style={{ fontSize: '0.7rem', marginTop: '2px' }}>{p.group_name}</span>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setSelectedProfileIds(new Set());
                    setShowAddDistProfileModal(false);
                  }}
                >
                  Huỷ
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleAddDistProfiles}
                  disabled={selectedProfileIds.size === 0}
                >
                  Thêm ({selectedProfileIds.size})
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Distribute Video Modal */}
      <AnimatePresence>
        {showDistributeModal && (
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
            onClick={() => {
              if (!isDistributing) {
                setDistributeResult(null);
                setShowDistributeModal(false);
              }
            }}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              className="glass"
              style={{ width: '100%', maxWidth: '520px', padding: '24px', borderRadius: '20px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '700' }}>Phân Phối Video</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                    {distributionProfiles.length} profile được chọn
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!isDistributing) {
                      setDistributeResult(null);
                      setShowDistributeModal(false);
                    }
                  }}
                  disabled={isDistributing}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: isDistributing ? 'not-allowed' : 'pointer',
                    opacity: isDistributing ? 0.45 : 1
                  }}
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              </div>

              {!distributeResult ? (
                <>
                  <div style={{ display: 'grid', gap: '16px', marginBottom: '20px' }}>
                    <div className="input-group">
                      <label>Folder Nguồn</label>
                      <input
                        className="input"
                        placeholder="/path/to/videos"
                        value={sourceFolder}
                        onChange={(e) => setSourceFolder(e.target.value)}
                        disabled={isDistributing}
                        autoFocus
                      />
                    </div>

                    <div className="input-group">
                      <label>Số lượng video mỗi profile</label>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        value={videosPerProfile}
                        onChange={(e) => setVideosPerProfile(Math.max(1, parseInt(e.target.value) || 1))}
                        disabled={isDistributing}
                      />
                    </div>

                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '12px',
                      background: 'rgba(99, 102, 241, 0.08)',
                      fontSize: '0.9rem',
                      color: 'var(--text-muted)'
                    }}>
                      <strong>{distributionProfiles.length}</strong> profile × <strong>{videosPerProfile}</strong> video = <strong style={{ color: 'var(--accent)' }}>{distributionProfiles.length * videosPerProfile} video</strong> cần phân phối
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setDistributeResult(null);
                        setShowDistributeModal(false);
                      }}
                      disabled={isDistributing}
                    >
                      Huỷ
                    </button>
                    <button
                      className="btn btn-primary"
                      onClick={handleDistribute}
                      disabled={isDistributing || !sourceFolder.trim()}
                      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      {isDistributing ? (
                        <>
                          <RefreshCw size={18} className="animate-pulse" />
                          Đang phân phối...
                        </>
                      ) : (
                        <>
                          <Play size={18} />
                          Phân Phối
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Result display */}
                  {distributeResult.error ? (
                    <div style={{
                      padding: '20px',
                      borderRadius: '16px',
                      background: 'rgba(239, 68, 68, 0.08)',
                      marginBottom: '20px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger)', marginBottom: '8px' }}>
                        <AlertCircle size={20} />
                        <span style={{ fontWeight: '600' }}>Lỗi</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', margin: 0 }}>{distributeResult.error}</p>
                    </div>
                  ) : (
                    <div style={{
                      padding: '20px',
                      borderRadius: '16px',
                      background: distributeResult.missing > 0
                        ? 'rgba(251, 191, 36, 0.08)'
                        : 'rgba(34, 197, 94, 0.08)',
                      marginBottom: '20px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: distributeResult.missing > 0 ? '#FBBF24' : 'var(--success)',
                        marginBottom: '12px'
                      }}>
                        {distributeResult.missing > 0 ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                        <span style={{ fontWeight: '600' }}>
                          {distributeResult.missing > 0
                            ? `Đã phân phối ${distributeResult.totalDistributed}/${distributeResult.totalExpected} video`
                            : `Đã phân phối thành công ${distributeResult.totalDistributed} video!`
                          }
                        </span>
                      </div>
                      {distributeResult.missing > 0 && (
                        <p style={{ color: 'var(--text-muted)', margin: '0 0 12px 0', fontSize: '0.9rem' }}>
                          Thiếu {distributeResult.missing} video (folder nguồn không đủ)
                        </p>
                      )}
                      {/* Per-profile breakdown */}
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {distributeResult.profiles.map(p => (
                          <div key={p.profileId} style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: '8px',
                            background: 'rgba(255,255,255,0.04)',
                            fontSize: '0.85rem'
                          }}>
                            <span style={{ fontWeight: '500' }}>{p.profileName}</span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {p.count} video → <span style={{ fontSize: '0.78rem', color: 'var(--accent)' }}>{p.folder}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setDistributeResult(null);
                        setShowDistributeModal(false);
                        setSourceFolder('');
                      }}
                    >
                      Đóng
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
