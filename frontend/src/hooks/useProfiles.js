import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';

// Encapsulates ALL state + API handlers for the TikTok Manager dashboard.
// App.jsx consumes this hook and distributes the result to presentational
// view components, keeping data logic out of the render tree.

const useProfiles = () => {
  const [profiles, setProfiles] = useState([]);
  const [config, setConfig] = useState({ videoFolder: '', maxConcurrency: 2 });
  const [newProfileName, setNewProfileName] = useState('');
  const [newProfileGroupId, setNewProfileGroupId] = useState('');
  const [newProfileVideoFolder, setNewProfileVideoFolder] = useState('');
  const [newProfileChannelIds, setNewProfileChannelIds] = useState('');
  const [newProfileNeedsRender, setNewProfileNeedsRender] = useState(true);
  const [newProfileRemoveTitle, setNewProfileRemoveTitle] = useState(true);
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
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedForRun, setSelectedForRun] = useState(() => new Set());
  const [bulkRunMode, setBulkRunMode] = useState('parallel');
  const [engagingProfiles, setEngagingProfiles] = useState(() => new Set());

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

      // Sync engaging status from profile status field
      setEngagingProfiles(prev => {
        const next = new Set(prev);
        newProfiles.forEach(p => {
          if (p.status === 'engaging') next.add(p.id);
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
    setNewProfileRemoveTitle(true);
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
        remove_title: newProfileRemoveTitle
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

  const startAutomation = async (profileId = null, country) => {
    setIsLoading(true);
    try {
      if (profileId) {
        await axios.post('/api/start', { profileId, country: country || undefined });
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

  const openProfile = async (profileId, country) => {
    try {
      await axios.post('/api/open-profile', { profileId, country: country || undefined });
      setMessage({ type: 'success', text: 'Browser opened for profile' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to open browser' });
    }
  };

  const startEngage = async (profileId, country) => {
    try {
      await axios.post('/api/engage', { profileId, country: country || undefined });
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

  const openProfileDetail = (profile) => {
    setSelectedProfile(profile);
  };

  return {
    // data
    profiles,
    filteredProfiles,
    groups,
    config,
    activeTab,
    message,
    selectedProfile,
    selectedForRun,
    engagingProfiles,
    allFilteredSelected,
    bulkRunMode,
    groupFilter,
    isLoading,
    isSelectingFolder,
    // create profile modal
    isCreateProfileModalOpen,
    isCreatingProfile,
    newProfileName,
    newProfileGroupId,
    newProfileVideoFolder,
    newProfileChannelIds,
    newProfileNeedsRender,
    newProfileRemoveTitle,
    // groups editing
    newGroupName,
    editingGroupId,
    editingGroupValue,
    // profile name editing
    editingId,
    editingValue,
    // setters (state)
    setActiveTab,
    setMessage,
    setConfig,
    setSelectedProfile,
    setGroupFilter,
    setBulkRunMode,
    setIsCreateProfileModalOpen,
    setNewProfileName,
    setNewProfileGroupId,
    setNewProfileVideoFolder,
    setNewProfileChannelIds,
    setNewProfileNeedsRender,
    setNewProfileRemoveTitle,
    setNewGroupName,
    setEditingGroupId,
    setEditingGroupValue,
    setEditingId,
    setEditingValue,
    // actions
    fetchData,
    addGroup,
    updateGroupName,
    deleteGroup,
    updateProfileGroup,
    closeCreateProfileModal,
    addProfile,
    deleteProfile,
    updateConfig,
    startAutomation,
    toggleProfileSelectedForRun,
    toggleSelectAllFiltered,
    openProfile,
    startEngage,
    stopEngage,
    startBulkEngage,
    stopBulkEngage,
    updateProfileFolder,
    updateProfileProxy,
    updateProfileChannelIds,
    updateProfileName,
    updateProfileSchedule,
    updateProfileSchedules,
    updateProfileSetMusic,
    updateProfileNeedsRender,
    updateProfileRemoveTitle,
    updateProfileAutoIncrementSchedule,
    updateProfileUploadCount,
    handleSelectFolder,
    handleSelectFolderForCreateProfile,
    openProfileDetail
  };
};

export default useProfiles;
