import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';

// Encapsulates ALL state + API handlers for the "Douyin Downloader" feature.
// It talks to the Express backend through /api/douyin/* and keeps live job
// progress + dashboard stats in sync via a Server-Sent-Events stream.
//
// Views consume this hook and receive the result via props (same pattern as
// useProfiles.js).

const EMPTY_PAGINATION = { page: 1, pageSize: 10, total: 0, totalPages: 1 };

const upsertJob = (list, job) => {
  const idx = list.findIndex((j) => j.id === job.id);
  if (idx === -1) return [job, ...list];
  const next = [...list];
  next[idx] = { ...next[idx], ...job };
  return next;
};

const useDouyin = () => {
  /* ------------------------- download form ------------------------- */
  const [url, setUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [mode, setMode] = useState('single'); // 'single' | 'batch'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  /* ------------------------- live jobs / stats --------------------- */
  const [jobs, setJobs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(false);

  /* ------------------------- download history ---------------------- */
  const [history, setHistory] = useState({ data: [], pagination: EMPTY_PAGINATION });
  const [historyQuery, setHistoryQuery] = useState({
    page: 1,
    pageSize: 10,
    search: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
    status: 'ALL',
  });
  const [loadingHistory, setLoadingHistory] = useState(false);

  /* ------------------------- creators ------------------------------ */
  const [creators, setCreators] = useState([]);
  const [loadingCreators, setLoadingCreators] = useState(false);
  const [checkingCreatorId, setCheckingCreatorId] = useState(null);
  const [checkingAll, setCheckingAll] = useState(false);

  const sseRef = useRef(null);

  const handleError = (err) => {
    const msg = err?.response?.data?.error || err?.message || 'Unexpected error';
    setError(msg);
    return msg;
  };

  const flash = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 4000);
  };

  /* ------------------------- fetch helpers ------------------------- */

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/douyin/stats');
      setStats(data);
    } catch {
      /* stats are refreshed via SSE too */
    }
  }, []);

  const fetchJobs = useCallback(async (page = 1, pageSize = 20, status = 'ALL') => {
    try {
      setLoadingJobs(true);
      const { data } = await axios.get('/api/douyin/jobs', { params: { page, pageSize, status } });
      setJobs(data.data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  const fetchHistory = useCallback(async (query) => {
    try {
      setLoadingHistory(true);
      const q = query || historyQuery;
      const { data } = await axios.get('/api/douyin/videos', { params: q });
      setHistory(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyQuery]);

  const fetchCreators = useCallback(async () => {
    try {
      setLoadingCreators(true);
      const { data } = await axios.get('/api/douyin/creators');
      setCreators(data);
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingCreators(false);
    }
  }, []);

  /* Re-fetch history when the query changes (search / pagination / sort). */
  useEffect(() => {
    const t = setTimeout(() => fetchHistory(), 150);
    return () => clearTimeout(t);
  }, [historyQuery, fetchHistory]);

  /* ------------------------- SSE live stream ----------------------- */
  useEffect(() => {
    const es = new EventSource('/api/douyin/events');
    es.addEventListener('job', (ev) => {
      try {
        const job = JSON.parse(ev.data);
        setJobs((prev) => upsertJob(prev, job));
      } catch {
        /* ignore malformed frame */
      }
    });
    es.addEventListener('stats', (ev) => {
      try {
        setStats(JSON.parse(ev.data));
      } catch {
        /* ignore malformed frame */
      }
    });
    es.onerror = () => {
      /* EventSource auto-reconnects; nothing to do here */
    };
    sseRef.current = es;
    return () => {
      es.close();
      sseRef.current = null;
    };
  }, []);

  /* ------------------------- actions: download --------------------- */

  const downloadSingle = async (u) => {
    const target = (u || url).trim();
    if (!target) {
      setError('Please enter a Douyin URL');
      return null;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await axios.post('/api/douyin/download', { url: target });
      setUrl('');
      flash('Download job created — progress is streaming live below.');
      fetchJobs();
      fetchHistory();
      return data.job;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadBatch = async () => {
    const urls = batchText
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setError('Paste at least one URL (one per line)');
      return null;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const { data } = await axios.post('/api/douyin/download-batch', { urls });
      setBatchText('');
      flash(`${data.count} download job(s) created.`);
      fetchJobs();
      fetchHistory();
      return data;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const retryJob = async (jobId) => {
    try {
      await axios.post(`/api/douyin/jobs/${jobId}/retry`);
      flash('Job re-queued for download.');
      fetchJobs();
    } catch (err) {
      handleError(err);
    }
  };

  /* ------------------------- actions: history ---------------------- */

  const deleteVideo = async (videoId) => {
    try {
      await axios.delete(`/api/douyin/videos/${videoId}`);
      flash('Video removed from history.');
      fetchHistory();
      fetchStats();
    } catch (err) {
      handleError(err);
    }
  };

  const downloadFile = (videoId) => {
    window.open(`/api/douyin/videos/${videoId}/file`, '_blank');
  };

  /* ------------------------- actions: creators --------------------- */

  const registerCreator = async (payload) => {
    try {
      const { data } = await axios.post('/api/douyin/creators', payload);
      flash('Creator registered and being monitored.');
      fetchCreators();
      return data;
    } catch (err) {
      handleError(err);
      return null;
    }
  };

  const updateCreator = async (creatorId, patch) => {
    try {
      const { data } = await axios.patch(`/api/douyin/creators/${creatorId}`, patch);
      fetchCreators();
      return data;
    } catch (err) {
      handleError(err);
      return null;
    }
  };

  const deleteCreator = async (creatorId) => {
    try {
      await axios.delete(`/api/douyin/creators/${creatorId}`);
      flash('Creator removed.');
      fetchCreators();
      fetchStats();
    } catch (err) {
      handleError(err);
    }
  };

  const checkCreator = async (creatorId) => {
    try {
      setCheckingCreatorId(creatorId);
      const { data } = await axios.post(`/api/douyin/creators/${creatorId}/check`);
      fetchCreators();
      return data;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setCheckingCreatorId(null);
    }
  };

  const checkAllCreators = async () => {
    try {
      setCheckingAll(true);
      const { data } = await axios.post('/api/douyin/creators/check-all');
      fetchCreators();
      return data;
    } catch (err) {
      handleError(err);
      return null;
    } finally {
      setCheckingAll(false);
    }
  };

  /* ------------------------- initial load -------------------------- */
  useEffect(() => {
    fetchStats();
    fetchJobs();
    fetchCreators();
  }, [fetchStats, fetchJobs, fetchCreators]);

  return {
    // form
    url,
    setUrl,
    batchText,
    setBatchText,
    mode,
    setMode,
    isSubmitting,
    error,
    setError,
    message,
    // jobs / stats
    jobs,
    stats,
    loadingJobs,
    fetchJobs,
    // history
    history,
    historyQuery,
    setHistoryQuery,
    loadingHistory,
    fetchHistory,
    // creators
    creators,
    loadingCreators,
    checkingCreatorId,
    checkingAll,
    // actions
    downloadSingle,
    downloadBatch,
    retryJob,
    deleteVideo,
    downloadFile,
    registerCreator,
    updateCreator,
    deleteCreator,
    checkCreator,
    checkAllCreators,
  };
};

export default useDouyin;
