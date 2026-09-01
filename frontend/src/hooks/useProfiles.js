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
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
  const [statsProfileIds,  setStatsProfileIds]  = useState([]);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState(null);
  const [batchStatus, setBatchStatus] = useState(null);

  // Distribution feature state
  const [distGroupId, setDistGroupId] = useState('all');
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
      const [pRes, cRes, gRes, bRes] = await Promise.all([
        axios.get('/api/profiles'),
        axios.get('/api/config'),
        axios.get('/api/groups'),
        axios.get('/api/batch-status').catch(() => ({ data: null }))
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
      if (bRes && bRes.data) {
        setBatchStatus(bRes.data.status !== 'idle' ? bRes.data : null);
      }

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

  const openStatsModal = () => {
    if (selectedForRun.size === 0) {
      setMessage({ type: 'error', text: 'Chọn ít nhất một profile để thống kê.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setStatsProfileIds([...selectedForRun]);
    setIsStatsModalOpen(true);
  };

  const closeStatsModal = () => setIsStatsModalOpen(false);

  const openBulkEditModal = () => {
    if (selectedForRun.size === 0) {
      setMessage({ type: 'error', text: 'Vui lòng chọn ít nhất một profile để cập nhật đồng loạt.' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    setIsBulkEditModalOpen(true);
  };

  const closeBulkEditModal = () => setIsBulkEditModalOpen(false);

  const updateProfilesBulk = async (updates) => {
    const profileIds = Array.from(selectedForRun);
    if (profileIds.length === 0) return;
    try {
      await axios.post('/api/profiles/bulk-update', { profileIds, updates });
      setMessage({ type: 'success', text: `Đã cập nhật đồng loạt cho ${profileIds.length} profile.` });
      setTimeout(() => setMessage(null), 3000);
      fetchData();
      closeBulkEditModal();
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: err.response?.data?.error || 'Lỗi cập nhật đồng loạt.' });
      setTimeout(() => setMessage(null), 3000);
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

  const updateProfileUseProxy = async (id, enabled) => {
    if (processingRef.current.has(id)) return;
    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, use_proxy: enabled ? 1 : 0 } : p))
    );
    processingRef.current.add(id);
    try {
      await axios.patch(`/api/profiles/${id}`, { use_proxy: enabled });
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchData();
    } catch (err) {
      console.error(err);
      await fetchData();
    } finally {
      processingRef.current.delete(id);
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

  const handleSelectDistSourceFolder = async () => {
    setIsSelectingFolder(true);
    try {
      const selectedPath = await selectFolderPath();
      if (selectedPath) {
        setSourceFolder(selectedPath);
      }
    } finally {
      setIsSelectingFolder(false);
    }
  };

  const distGroupProfiles = useMemo(() => {
    if (distGroupId === 'all') return profiles;
    if (distGroupId === 'ungrouped') {
      return profiles.filter(p => !p.group_id);
    }
    return profiles.filter(p => p.group_id === distGroupId);
  }, [profiles, distGroupId]);

  const handleDistribute = async () => {
    if (!sourceFolder.trim()) {
      setMessage({ type: 'error', text: 'Vui lòng nhập folder nguồn' });
      return;
    }
    if (videosPerProfile < 1) {
      setMessage({ type: 'error', text: 'Số lượng video mỗi profile phải >= 1' });
      return;
    }
    if (distGroupProfiles.length === 0) {
      setMessage({ type: 'error', text: 'Nhóm đã chọn không có profile nào' });
      return;
    }

    setIsDistributing(true);
    setDistributeResult(null);
    try {
      const res = await axios.post('/api/distribution/distribute', {
        groupId: distGroupId,
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

  return {
    // data
    profiles,
    filteredProfiles,
    groups,
    config,
    activeTab,
    message,
    selectedForRun,
    engagingProfiles,
    loggingInProfiles,
    changingAvatarProfiles,
    addingFavoriteMusicProfiles,
    avatarSelections,
    musicSearchTerms,
    allFilteredSelected,
    bulkRunMode,
    groupFilter,
    isLoading,
    isSelectingFolder,
    limitUploads,
    uploadLimitCount,
    // create profile modal
    isCreateProfileModalOpen,
    isCreatingProfile,
    newProfileName,
    newProfileGroupId,
    newProfileVideoFolder,
    newProfileChannelIds,
    newProfileNeedsRender,
    newProfileRenderConcatVideo,
    newProfileRemoveTitle,
    newProfileNeedContentCheck,
    newProfileRenderVideoLong,
    // import / export modals
    isImportModalOpen,
    isImportFolderModalOpen,
    isExportFolderModalOpen,
    importCsvText,
    importFileName,
    importResults,
    isImporting,
    importFolderPath,
    exportFolderPath,
    isExporting,
    exportResults,
    // edit profile modal
    editingProfileId,
    editingProfile,
    // groups editing
    newGroupName,
    editingGroupId,
    editingGroupValue,
    // profile name editing
    editingId,
    editingValue,
    // distribution
    distGroupId,
    distGroupProfiles,
    sourceFolder,
    videosPerProfile,
    isDistributing,
    distributeResult,
    // setters
    setActiveTab,
    setMessage,
    setConfig,
    setGroupFilter,
    setBulkRunMode,
    setIsCreateProfileModalOpen,
    setNewProfileName,
    setNewProfileGroupId,
    setNewProfileVideoFolder,
    setNewProfileChannelIds,
    setNewProfileNeedsRender,
    setNewProfileRenderConcatVideo,
    setNewProfileRemoveTitle,
    setNewProfileNeedContentCheck,
    setNewProfileRenderVideoLong,
    setNewGroupName,
    setEditingGroupId,
    setEditingGroupValue,
    setEditingId,
    setEditingValue,
    setLimitUploads,
    setUploadLimitCount,
    setIsImportModalOpen,
    setIsImportFolderModalOpen,
    setIsExportFolderModalOpen,
    setImportFolderPath,
    setExportFolderPath,
    setDistGroupId,
    setSourceFolder,
    setVideosPerProfile,
    setDistributeResult,
    handleSelectDistSourceFolder,
    // actions
    fetchData,
    addGroup,
    updateGroupName,
    deleteGroup,
    updateProfileGroup,
    closeCreateProfileModal,
    addProfile,
    handleFileSelect,
    handleImportCsv,
    handleImportFolder,
    closeImportModal,
    closeImportFolderModal,
    handleExportFolder,
    closeExportFolderModal,
    deleteProfile,
    deleteSelectedProfiles,
    updateConfig,
    startAutomation,
    toggleProfileSelectedForRun,
    toggleSelectAllFiltered,
    openProfile,
    startEngage,
    stopEngage,
    startLoginTikTok,
    stopLoginTikTok,
    startBulkLogin,
    clearTrash,
    clearDebugFiles,
    startBulkEngage,
    stopBulkEngage,
    isStatsModalOpen,
    statsProfileIds,
    openStatsModal,
    closeStatsModal,
    isBulkEditModalOpen,
    openBulkEditModal,
    closeBulkEditModal,
    updateProfilesBulk,
    updateProfileFolder,
    updateProfileProxy,
    updateProfileUseProxy,
    updateProfileChannelIds,
    updateProfileName,
    updateProfileSchedule,
    updateProfileSchedules,
    updateProfileSetMusic,
    updateProfileNeedsRender,
    updateProfileRenderConcatVideo,
    updateProfileRenderVideoLong,
    updateProfileRemoveTitle,
    updateProfileNeedContentCheck,
    updateProfileAutoIncrementSchedule,
    updateProfileScheduleInterval,
    updateProfileUploadCount,
    handleSelectFolder,
    handleSelectAvatar,
    handleSelectFolderForCreateProfile,
    handleChangeAvatar,
    handleAddFavoriteMusic,
    handleUpdateMusicSearchTerm,
    handleEditProfile,
    handleCloseEditProfile,
    handleDistribute,
    getStatusColor
  };
};

export default useProfiles;
