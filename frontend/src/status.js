// Shared status helpers for the TikTok Manager UI.
// Centralizes the status → color mapping and human-readable labels so that
// cards, badges and modals stay consistent.

export const STATUS_LABELS = {
  idle: 'Idle',
  uploading: 'Uploading',
  logging_in: 'Logging In',
  engaging: 'Engaging',
  changing_avatar: 'Changing Avatar',
  adding_favorite_music: 'Adding Music',
  success: 'Success',
  error: 'Error',
  no_videos: 'No Videos'
};

export const getStatusColor = (status = 'idle') => {
  switch (status) {
    case 'uploading': return 'var(--accent)';
    case 'logging_in': return 'var(--success)';
    case 'engaging': return 'var(--status-engage)';
    case 'changing_avatar': return 'var(--status-avatar)';
    case 'adding_favorite_music': return 'var(--status-music-active)';
    case 'success': return 'var(--success)';
    case 'error': return 'var(--error)';
    case 'no_videos': return 'var(--status-skip)';
    default: return 'var(--text-muted)';
  }
};

// Backwards-compatible alias.
export const statusColor = getStatusColor;
